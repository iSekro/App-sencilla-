'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const url = require('url');

const STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  MERGING: 'merging',
};

class DownloadTask extends EventEmitter {
  constructor(options) {
    super();
    this.id = options.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    this.url = options.url;
    this.savePath = options.savePath;
    this.fileName = options.fileName || path.basename(new URL(options.url).pathname) || 'download';
    this.totalSize = 0;
    this.downloadedSize = 0;
    this.status = STATUS.QUEUED;
    this.connections = options.connections || 8;
    this.chunks = [];
    this.activeRequests = [];
    this.speedSamples = [];
    this.speed = 0;
    this.eta = 0;
    this.startTime = null;
    this.supportsRange = false;
    this.error = null;
    this.category = this._detectCategory(this.fileName);
    this.createdAt = Date.now();
    this._speedInterval = null;
  }

  _detectCategory(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const categories = {
      video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp'],
      audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.csv'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
      archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso'],
      program: ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.apk', '.appimage'],
    };
    for (const [cat, exts] of Object.entries(categories)) {
      if (exts.includes(ext)) return cat;
    }
    return 'general';
  }

  _getProtocol(downloadUrl) {
    return downloadUrl.startsWith('https') ? https : http;
  }

  _followRedirects(downloadUrl, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        reject(new Error('Too many redirects'));
        return;
      }
      const protocol = this._getProtocol(downloadUrl);
      const opts = new URL(downloadUrl);
      const reqOptions = {
        hostname: opts.hostname,
        port: opts.port,
        path: opts.pathname + opts.search,
        method: 'HEAD',
        headers: {
          'User-Agent': 'SekroDownloadManager/1.0',
        },
        timeout: 15000,
      };

      const req = protocol.request(reqOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = `${opts.protocol}//${opts.host}${redirectUrl}`;
          }
          this._followRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        } else {
          resolve({
            finalUrl: downloadUrl,
            headers: res.headers,
            statusCode: res.statusCode,
          });
        }
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.end();
    });
  }

  async probe() {
    const result = await this._followRedirects(this.url);
    this.url = result.finalUrl;
    const contentLength = parseInt(result.headers['content-length'], 10);
    this.totalSize = isNaN(contentLength) ? 0 : contentLength;
    this.supportsRange = result.headers['accept-ranges'] === 'bytes' && this.totalSize > 0;

    if (!this.fileName || this.fileName === 'download') {
      const disposition = result.headers['content-disposition'];
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/i);
        if (match) this.fileName = match[1].trim();
      }
      if (!this.fileName || this.fileName === 'download') {
        this.fileName = path.basename(new URL(this.url).pathname) || 'download';
      }
    }

    return {
      totalSize: this.totalSize,
      supportsRange: this.supportsRange,
      fileName: this.fileName,
    };
  }

  async start() {
    if (this.status === STATUS.DOWNLOADING) return;

    try {
      await this.probe();
    } catch (err) {
      this.status = STATUS.ERROR;
      this.error = err.message;
      this.emit('error', err);
      return;
    }

    this.status = STATUS.DOWNLOADING;
    this.startTime = Date.now();
    this.emit('statusChange', this.status);

    this._startSpeedTracker();

    const fullPath = path.join(this.savePath, this.fileName);

    if (this.supportsRange && this.totalSize > 0 && this.connections > 1) {
      await this._multiConnectionDownload(fullPath);
    } else {
      await this._singleConnectionDownload(fullPath);
    }
  }

  _startSpeedTracker() {
    let lastBytes = this.downloadedSize;
    this._speedInterval = setInterval(() => {
      const currentBytes = this.downloadedSize;
      const delta = currentBytes - lastBytes;
      this.speedSamples.push(delta);
      if (this.speedSamples.length > 5) this.speedSamples.shift();
      this.speed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
      if (this.speed > 0 && this.totalSize > 0) {
        this.eta = Math.round((this.totalSize - this.downloadedSize) / this.speed);
      } else {
        this.eta = 0;
      }
      lastBytes = currentBytes;
      this.emit('progress', this.getProgress());
    }, 1000);
  }

  _stopSpeedTracker() {
    if (this._speedInterval) {
      clearInterval(this._speedInterval);
      this._speedInterval = null;
    }
  }

  async _singleConnectionDownload(fullPath) {
    return new Promise((resolve, reject) => {
      const protocol = this._getProtocol(this.url);
      const opts = new URL(this.url);
      const reqOptions = {
        hostname: opts.hostname,
        port: opts.port,
        path: opts.pathname + opts.search,
        method: 'GET',
        headers: {
          'User-Agent': 'SekroDownloadManager/1.0',
        },
        timeout: 30000,
      };

      const req = protocol.request(reqOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = `${opts.protocol}//${opts.host}${redirectUrl}`;
          }
          this.url = redirectUrl;
          this._singleConnectionDownload(fullPath).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          this.status = STATUS.ERROR;
          this.error = `HTTP ${res.statusCode}`;
          this._stopSpeedTracker();
          this.emit('statusChange', this.status);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        if (!this.totalSize) {
          const cl = parseInt(res.headers['content-length'], 10);
          if (!isNaN(cl)) this.totalSize = cl;
        }

        const fileStream = fs.createWriteStream(fullPath);
        this.activeRequests = [req];

        res.on('data', (chunk) => {
          if (this.status === STATUS.PAUSED) {
            req.destroy();
            fileStream.end();
            return;
          }
          this.downloadedSize += chunk.length;
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          if (this.status !== STATUS.PAUSED) {
            this.status = STATUS.COMPLETED;
            this._stopSpeedTracker();
            this.emit('statusChange', this.status);
            this.emit('progress', this.getProgress());
          }
          resolve();
        });

        fileStream.on('error', (err) => {
          this.status = STATUS.ERROR;
          this.error = err.message;
          this._stopSpeedTracker();
          this.emit('statusChange', this.status);
          reject(err);
        });
      });

      req.on('error', (err) => {
        this.status = STATUS.ERROR;
        this.error = err.message;
        this._stopSpeedTracker();
        this.emit('statusChange', this.status);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        this.status = STATUS.ERROR;
        this.error = 'Connection timed out';
        this._stopSpeedTracker();
        this.emit('statusChange', this.status);
        reject(new Error('Connection timed out'));
      });

      req.end();
    });
  }

  async _multiConnectionDownload(fullPath) {
    const chunkSize = Math.ceil(this.totalSize / this.connections);
    this.chunks = [];

    for (let i = 0; i < this.connections; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, this.totalSize - 1);
      this.chunks.push({
        index: i,
        start,
        end,
        downloaded: 0,
        total: end - start + 1,
        path: `${fullPath}.part${i}`,
        completed: false,
      });
    }

    const downloadChunk = (chunk) => {
      return new Promise((resolve, reject) => {
        if (this.status === STATUS.PAUSED) {
          resolve();
          return;
        }

        const protocol = this._getProtocol(this.url);
        const opts = new URL(this.url);
        const currentStart = chunk.start + chunk.downloaded;

        const reqOptions = {
          hostname: opts.hostname,
          port: opts.port,
          path: opts.pathname + opts.search,
          method: 'GET',
          headers: {
            'User-Agent': 'SekroDownloadManager/1.0',
            Range: `bytes=${currentStart}-${chunk.end}`,
          },
          timeout: 30000,
        };

        const req = protocol.request(reqOptions, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let redirectUrl = res.headers.location;
            if (redirectUrl.startsWith('/')) {
              redirectUrl = `${opts.protocol}//${opts.host}${redirectUrl}`;
            }
            this.url = redirectUrl;
            downloadChunk(chunk).then(resolve).catch(reject);
            return;
          }

          if (res.statusCode !== 206 && res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for chunk ${chunk.index}`));
            return;
          }

          const flags = chunk.downloaded > 0 ? 'a' : 'w';
          const fileStream = fs.createWriteStream(chunk.path, { flags });

          res.on('data', (data) => {
            if (this.status === STATUS.PAUSED) {
              req.destroy();
              fileStream.end();
              return;
            }
            chunk.downloaded += data.length;
            this.downloadedSize += data.length;
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            if (this.status !== STATUS.PAUSED) {
              chunk.completed = true;
            }
            resolve();
          });

          fileStream.on('error', reject);
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Chunk download timed out'));
        });
        this.activeRequests.push(req);
        req.end();
      });
    };

    try {
      await Promise.all(this.chunks.map(downloadChunk));

      if (this.status === STATUS.PAUSED) return;

      this.status = STATUS.MERGING;
      this.emit('statusChange', this.status);

      await this._mergeChunks(fullPath);

      this.status = STATUS.COMPLETED;
      this._stopSpeedTracker();
      this.emit('statusChange', this.status);
      this.emit('progress', this.getProgress());
    } catch (err) {
      if (this.status !== STATUS.PAUSED) {
        this.status = STATUS.ERROR;
        this.error = err.message;
        this._stopSpeedTracker();
        this.emit('statusChange', this.status);
      }
    }
  }

  _mergeChunks(fullPath) {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(fullPath);
      let currentIndex = 0;

      const writeNext = () => {
        if (currentIndex >= this.chunks.length) {
          writeStream.end();
          return;
        }
        const chunk = this.chunks[currentIndex];
        const readStream = fs.createReadStream(chunk.path);
        readStream.on('error', reject);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          try { fs.unlinkSync(chunk.path); } catch (_) { /* ignore */ }
          currentIndex++;
          writeNext();
        });
      };

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeNext();
    });
  }

  pause() {
    if (this.status !== STATUS.DOWNLOADING) return;
    this.status = STATUS.PAUSED;
    this._stopSpeedTracker();
    this.activeRequests.forEach((req) => {
      try { req.destroy(); } catch (_) { /* ignore */ }
    });
    this.activeRequests = [];
    this.speed = 0;
    this.emit('statusChange', this.status);
    this.emit('progress', this.getProgress());
  }

  async resume() {
    if (this.status !== STATUS.PAUSED) return;

    this.status = STATUS.DOWNLOADING;
    this.emit('statusChange', this.status);
    this._startSpeedTracker();

    const fullPath = path.join(this.savePath, this.fileName);

    if (this.chunks.length > 0) {
      const remaining = this.chunks.filter((c) => !c.completed);
      if (remaining.length === 0) {
        this.status = STATUS.MERGING;
        this.emit('statusChange', this.status);
        await this._mergeChunks(fullPath);
        this.status = STATUS.COMPLETED;
        this._stopSpeedTracker();
        this.emit('statusChange', this.status);
        return;
      }

      const downloadChunk = (chunk) => {
        return new Promise((resolve, reject) => {
          if (this.status === STATUS.PAUSED) { resolve(); return; }
          const protocol = this._getProtocol(this.url);
          const opts = new URL(this.url);
          const currentStart = chunk.start + chunk.downloaded;
          const reqOptions = {
            hostname: opts.hostname,
            port: opts.port,
            path: opts.pathname + opts.search,
            method: 'GET',
            headers: {
              'User-Agent': 'SekroDownloadManager/1.0',
              Range: `bytes=${currentStart}-${chunk.end}`,
            },
            timeout: 30000,
          };
          const req = protocol.request(reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              let redirectUrl = res.headers.location;
              if (redirectUrl.startsWith('/')) {
                redirectUrl = `${opts.protocol}//${opts.host}${redirectUrl}`;
              }
              this.url = redirectUrl;
              downloadChunk(chunk).then(resolve).catch(reject);
              return;
            }
            const fileStream = fs.createWriteStream(chunk.path, { flags: 'a' });
            res.on('data', (data) => {
              if (this.status === STATUS.PAUSED) { req.destroy(); fileStream.end(); return; }
              chunk.downloaded += data.length;
              this.downloadedSize += data.length;
            });
            res.pipe(fileStream);
            fileStream.on('finish', () => { chunk.completed = (this.status !== STATUS.PAUSED); resolve(); });
            fileStream.on('error', reject);
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('Chunk timed out')); });
          this.activeRequests.push(req);
          req.end();
        });
      };

      try {
        await Promise.all(remaining.map(downloadChunk));
        if (this.status === STATUS.PAUSED) return;
        this.status = STATUS.MERGING;
        this.emit('statusChange', this.status);
        await this._mergeChunks(fullPath);
        this.status = STATUS.COMPLETED;
        this._stopSpeedTracker();
        this.emit('statusChange', this.status);
        this.emit('progress', this.getProgress());
      } catch (err) {
        if (this.status !== STATUS.PAUSED) {
          this.status = STATUS.ERROR;
          this.error = err.message;
          this._stopSpeedTracker();
          this.emit('statusChange', this.status);
        }
      }
    } else {
      await this._singleConnectionDownload(fullPath);
    }
  }

  cancel() {
    this._stopSpeedTracker();
    this.activeRequests.forEach((req) => {
      try { req.destroy(); } catch (_) { /* ignore */ }
    });
    this.activeRequests = [];

    if (this.chunks.length > 0) {
      this.chunks.forEach((chunk) => {
        try { fs.unlinkSync(chunk.path); } catch (_) { /* ignore */ }
      });
    }

    const fullPath = path.join(this.savePath, this.fileName);
    try { fs.unlinkSync(fullPath); } catch (_) { /* ignore */ }

    this.status = STATUS.ERROR;
    this.error = 'Cancelled';
    this.emit('statusChange', this.status);
  }

  getProgress() {
    const percent = this.totalSize > 0 ? Math.min(100, (this.downloadedSize / this.totalSize) * 100) : 0;
    return {
      id: this.id,
      url: this.url,
      fileName: this.fileName,
      status: this.status,
      totalSize: this.totalSize,
      downloadedSize: this.downloadedSize,
      percent: Math.round(percent * 10) / 10,
      speed: this.speed,
      eta: this.eta,
      connections: this.connections,
      category: this.category,
      error: this.error,
      createdAt: this.createdAt,
    };
  }
}

class DownloadManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.downloads = new Map();
    this.maxConcurrent = options.maxConcurrent || 3;
    this.defaultConnections = options.defaultConnections || 8;
    this.defaultSavePath = options.defaultSavePath || '';
    this.history = [];
  }

  addDownload(options) {
    const task = new DownloadTask({
      url: options.url,
      savePath: options.savePath || this.defaultSavePath,
      fileName: options.fileName || '',
      connections: options.connections || this.defaultConnections,
      id: options.id,
    });

    task.on('progress', (progress) => {
      this.emit('progress', progress);
    });

    task.on('statusChange', (status) => {
      this.emit('statusChange', { id: task.id, status });
      if (status === STATUS.COMPLETED || status === STATUS.ERROR) {
        this._processQueue();
      }
    });

    task.on('error', (err) => {
      this.emit('downloadError', { id: task.id, error: err.message });
    });

    this.downloads.set(task.id, task);
    this._processQueue();
    return task.getProgress();
  }

  _getActiveCount() {
    let count = 0;
    for (const task of this.downloads.values()) {
      if (task.status === STATUS.DOWNLOADING || task.status === STATUS.MERGING) count++;
    }
    return count;
  }

  _processQueue() {
    const active = this._getActiveCount();
    if (active >= this.maxConcurrent) return;

    for (const task of this.downloads.values()) {
      if (task.status === STATUS.QUEUED) {
        task.start().catch(() => {});
        if (this._getActiveCount() >= this.maxConcurrent) break;
      }
    }
  }

  pauseDownload(id) {
    const task = this.downloads.get(id);
    if (task) task.pause();
  }

  resumeDownload(id) {
    const task = this.downloads.get(id);
    if (task) {
      task.resume().catch(() => {});
    }
  }

  cancelDownload(id) {
    const task = this.downloads.get(id);
    if (task) {
      task.cancel();
      this.downloads.delete(id);
    }
  }

  removeDownload(id) {
    const task = this.downloads.get(id);
    if (task) {
      if (task.status === STATUS.DOWNLOADING) {
        task.cancel();
      }
      this.downloads.delete(id);
    }
  }

  getAllProgress() {
    const list = [];
    for (const task of this.downloads.values()) {
      list.push(task.getProgress());
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  getStats() {
    let totalSpeed = 0;
    let activeCount = 0;
    let totalDownloads = this.downloads.size;

    for (const task of this.downloads.values()) {
      if (task.status === STATUS.DOWNLOADING) {
        totalSpeed += task.speed;
        activeCount++;
      }
    }

    return { totalSpeed, activeCount, totalDownloads };
  }
}

module.exports = { DownloadManager, DownloadTask, STATUS };
