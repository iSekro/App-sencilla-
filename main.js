'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { DownloadManager } = require('./download-engine');

let mainWindow;
let manager;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (_) { /* ignore */ }
  return {
    savePath: path.join(app.getPath('downloads')),
    maxConcurrent: 3,
    connections: 8,
    showSpeed: true,
    startMinimized: false,
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (_) { /* ignore */ }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    icon: null,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
}

function setupIPC() {
  const settings = loadSettings();
  manager = new DownloadManager({
    maxConcurrent: settings.maxConcurrent,
    defaultConnections: settings.connections,
    defaultSavePath: settings.savePath,
  });

  manager.on('progress', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', data);
    }
  });

  manager.on('statusChange', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:statusChange', data);
    }
  });

  manager.on('downloadError', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:error', data);
    }
  });

  ipcMain.handle('download:add', (_event, options) => {
    const s = loadSettings();
    return manager.addDownload({
      url: options.url,
      savePath: options.savePath || s.savePath,
      fileName: options.fileName || '',
      connections: options.connections || s.connections,
    });
  });

  ipcMain.handle('download:pause', (_event, id) => {
    manager.pauseDownload(id);
    return true;
  });

  ipcMain.handle('download:resume', (_event, id) => {
    manager.resumeDownload(id);
    return true;
  });

  ipcMain.handle('download:cancel', (_event, id) => {
    manager.cancelDownload(id);
    return true;
  });

  ipcMain.handle('download:remove', (_event, id) => {
    manager.removeDownload(id);
    return true;
  });

  ipcMain.handle('download:getAll', () => {
    return manager.getAllProgress();
  });

  ipcMain.handle('download:getStats', () => {
    return manager.getStats();
  });

  ipcMain.handle('download:openFile', (_event, filePath) => {
    shell.openPath(filePath);
    return true;
  });

  ipcMain.handle('download:openFolder', (_event, filePath) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('download:getDefaultPath', () => {
    return loadSettings().savePath;
  });

  ipcMain.handle('settings:get', () => {
    return loadSettings();
  });

  ipcMain.handle('settings:save', (_event, newSettings) => {
    const current = loadSettings();
    const merged = { ...current, ...newSettings };
    saveSettings(merged);
    manager.maxConcurrent = merged.maxConcurrent;
    manager.defaultConnections = merged.connections;
    manager.defaultSavePath = merged.savePath;
    return merged;
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
