(function () {
  'use strict';

  const ICON_MAP = {
    video: '🎬',
    audio: '🎵',
    document: '📄',
    image: '🖼️',
    archive: '📦',
    program: '💻',
    general: '📁',
  };

  const STATUS_LABELS = {
    queued: 'En Cola',
    downloading: 'Descargando',
    paused: 'Pausado',
    completed: 'Completado',
    error: 'Error',
    merging: 'Uniendo',
  };

  let currentView = 'downloads';
  let downloads = [];

  // DOM Elements
  const btnAdd = document.getElementById('btn-add-download');
  const btnResumeAll = document.getElementById('btn-resume-all');
  const btnPauseAll = document.getElementById('btn-pause-all');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalStart = document.getElementById('btn-modal-start');
  const btnBrowseModal = document.getElementById('btn-browse-modal');
  const inputUrl = document.getElementById('input-url');
  const inputFilename = document.getElementById('input-filename');
  const inputSavePath = document.getElementById('input-savepath');
  const inputConnections = document.getElementById('input-connections');
  const statSpeed = document.getElementById('stat-speed');
  const statActive = document.getElementById('stat-active');
  const downloadListEl = document.getElementById('download-list');
  const completedListEl = document.getElementById('completed-list');
  const sidebarBtns = document.querySelectorAll('.sidebar-btn');

  // Settings DOM
  const settingPath = document.getElementById('setting-path');
  const settingConcurrent = document.getElementById('setting-concurrent');
  const settingConnections = document.getElementById('setting-connections');
  const btnBrowse = document.getElementById('btn-browse');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Window controls
  btnMinimize.addEventListener('click', () => window.downloadAPI.minimizeWindow());
  btnMaximize.addEventListener('click', () => window.downloadAPI.maximizeWindow());
  btnClose.addEventListener('click', () => window.downloadAPI.closeWindow());

  // Sidebar navigation
  sidebarBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view) return;
      switchView(view);
    });
  });

  function switchView(view) {
    currentView = view;
    sidebarBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    if (view === 'settings') loadSettingsUI();
    if (view === 'categories') updateCategories();
    if (view === 'completed') renderCompletedList();
  }

  // Modal
  function openModal() {
    modalOverlay.classList.add('show');
    inputUrl.value = '';
    inputFilename.value = '';
    inputUrl.focus();

    window.downloadAPI.getDefaultPath().then((p) => {
      inputSavePath.value = p || '';
    });
  }

  function closeModal() {
    modalOverlay.classList.remove('show');
  }

  btnAdd.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  btnModalCancel.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  btnBrowseModal.addEventListener('click', async () => {
    const folder = await window.downloadAPI.selectFolder();
    if (folder) inputSavePath.value = folder;
  });

  // Start download
  btnModalStart.addEventListener('click', async () => {
    const url = inputUrl.value.trim();
    if (!url) {
      inputUrl.focus();
      return;
    }

    try {
      new URL(url);
    } catch {
      inputUrl.style.borderColor = 'var(--red)';
      setTimeout(() => { inputUrl.style.borderColor = ''; }, 2000);
      return;
    }

    const options = {
      url,
      fileName: inputFilename.value.trim() || '',
      savePath: inputSavePath.value || '',
      connections: parseInt(inputConnections.value, 10) || 8,
    };

    await window.downloadAPI.addDownload(options);
    closeModal();
    switchView('downloads');
    refreshDownloads();
  });

  // Resume/Pause All
  btnResumeAll.addEventListener('click', () => {
    downloads.forEach((d) => {
      if (d.status === 'paused') {
        window.downloadAPI.resumeDownload(d.id);
      }
    });
  });

  btnPauseAll.addEventListener('click', () => {
    downloads.forEach((d) => {
      if (d.status === 'downloading') {
        window.downloadAPI.pauseDownload(d.id);
      }
    });
  });

  // Format helpers
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSec) {
    return formatBytes(bytesPerSec) + '/s';
  }

  function formatETA(seconds) {
    if (!seconds || seconds <= 0) return '--';
    if (seconds > 86400) return Math.floor(seconds / 86400) + 'd';
    if (seconds > 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h + 'h ' + m + 'm';
    }
    if (seconds > 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m + 'm ' + s + 's';
    }
    return seconds + 's';
  }

  // Render download item
  function createDownloadElement(dl) {
    const div = document.createElement('div');
    div.className = 'download-item';
    div.dataset.id = dl.id;

    const progressClass =
      dl.status === 'completed' ? 'completed' :
      dl.status === 'error' ? 'error' :
      dl.status === 'paused' ? 'paused' : '';

    const sizeText = dl.totalSize > 0
      ? formatBytes(dl.downloadedSize) + ' / ' + formatBytes(dl.totalSize)
      : formatBytes(dl.downloadedSize);

    const speedText = dl.status === 'downloading' ? formatSpeed(dl.speed) : '';
    const etaText = dl.status === 'downloading' && dl.eta > 0 ? formatETA(dl.eta) : '';

    let metaParts = [sizeText];
    if (speedText) metaParts.push(speedText);
    if (etaText) metaParts.push(etaText);

    let actionsHtml = '';

    if (dl.status === 'downloading') {
      actionsHtml = `
        <button class="download-action" data-action="pause" title="Pausar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="download-action danger" data-action="cancel" title="Cancelar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>`;
    } else if (dl.status === 'paused') {
      actionsHtml = `
        <button class="download-action" data-action="resume" title="Reanudar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="download-action danger" data-action="cancel" title="Cancelar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>`;
    } else if (dl.status === 'completed') {
      actionsHtml = `
        <button class="download-action" data-action="open" title="Abrir archivo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
        <button class="download-action" data-action="folder" title="Abrir carpeta">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="download-action danger" data-action="remove" title="Eliminar de la lista">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>`;
    } else if (dl.status === 'error') {
      actionsHtml = `
        <button class="download-action" data-action="retry" title="Reintentar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <button class="download-action danger" data-action="remove" title="Eliminar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>`;
    } else if (dl.status === 'queued') {
      actionsHtml = `
        <button class="download-action danger" data-action="cancel" title="Cancelar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>`;
    }

    div.innerHTML = `
      <div class="download-item-header">
        <div class="download-icon ${dl.category}">${ICON_MAP[dl.category] || '📁'}</div>
        <div class="download-info">
          <div class="download-name" title="${dl.fileName}">${dl.fileName}</div>
          <div class="download-meta">
            <span class="status-badge ${dl.status}">${STATUS_LABELS[dl.status] || dl.status}</span>
            ${metaParts.map((p) => '<span>' + p + '</span>').join('')}
          </div>
        </div>
        <div class="download-actions">${actionsHtml}</div>
      </div>
      <div class="download-progress-row">
        <div class="progress-bar-container">
          <div class="progress-bar ${progressClass}" style="width: ${dl.percent}%"></div>
        </div>
        <span class="progress-percent">${dl.percent.toFixed(1)}%</span>
      </div>`;

    // Action handlers
    div.querySelectorAll('.download-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        handleAction(dl.id, action, dl);
      });
    });

    return div;
  }

  function handleAction(id, action, dl) {
    switch (action) {
      case 'pause':
        window.downloadAPI.pauseDownload(id);
        break;
      case 'resume':
        window.downloadAPI.resumeDownload(id);
        break;
      case 'cancel':
        window.downloadAPI.cancelDownload(id);
        setTimeout(refreshDownloads, 300);
        break;
      case 'remove':
        window.downloadAPI.removeDownload(id);
        setTimeout(refreshDownloads, 300);
        break;
      case 'open':
        if (dl) {
          window.downloadAPI.openFile(dl.savePath || '');
        }
        break;
      case 'folder':
        if (dl) {
          window.downloadAPI.openFolder(dl.savePath || '');
        }
        break;
      case 'retry':
        window.downloadAPI.resumeDownload(id);
        break;
    }
  }

  // Render lists
  function renderDownloadList() {
    const active = downloads.filter(
      (d) => d.status !== 'completed'
    );

    if (active.length === 0) {
      downloadListEl.innerHTML = '';
      const empty = document.getElementById('empty-state');
      if (empty) empty.style.display = '';
      downloadListEl.appendChild(createEmptyState());
      return;
    }

    downloadListEl.innerHTML = '';
    active.forEach((dl) => {
      downloadListEl.appendChild(createDownloadElement(dl));
    });
  }

  function renderCompletedList() {
    const completed = downloads.filter((d) => d.status === 'completed');
    if (completed.length === 0) {
      completedListEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>No hay descargas completadas</p>
        </div>`;
      return;
    }

    completedListEl.innerHTML = '';
    completed.forEach((dl) => {
      completedListEl.appendChild(createDownloadElement(dl));
    });
  }

  function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <p>No hay descargas activas</p>
      <p class="sub">Haz clic en <strong>"Nueva Descarga"</strong> para empezar</p>`;
    return div;
  }

  // Update stats
  function updateStats() {
    let totalSpeed = 0;
    let activeCount = 0;
    downloads.forEach((d) => {
      if (d.status === 'downloading') {
        totalSpeed += d.speed || 0;
        activeCount++;
      }
    });
    statSpeed.textContent = formatSpeed(totalSpeed);
    statActive.textContent = activeCount + ' activa' + (activeCount !== 1 ? 's' : '');
  }

  // Update categories
  function updateCategories() {
    const counts = { video: 0, audio: 0, document: 0, image: 0, archive: 0, program: 0, general: 0 };
    downloads.forEach((d) => {
      if (counts[d.category] !== undefined) counts[d.category]++;
    });
    Object.entries(counts).forEach(([cat, count]) => {
      const el = document.getElementById('cat-' + cat);
      if (el) el.textContent = count;
    });
  }

  // Refresh
  async function refreshDownloads() {
    downloads = await window.downloadAPI.getAllDownloads();
    renderDownloadList();
    updateStats();
    if (currentView === 'completed') renderCompletedList();
    if (currentView === 'categories') updateCategories();
  }

  // IPC listeners
  let removeProgressListener;
  let removeStatusListener;
  let removeErrorListener;

  function setupListeners() {
    removeProgressListener = window.downloadAPI.onProgress((data) => {
      const idx = downloads.findIndex((d) => d.id === data.id);
      if (idx >= 0) {
        downloads[idx] = { ...downloads[idx], ...data };
      }

      const item = downloadListEl.querySelector(`[data-id="${data.id}"]`);
      if (item) {
        const bar = item.querySelector('.progress-bar');
        const pct = item.querySelector('.progress-percent');
        const meta = item.querySelector('.download-meta');

        if (bar) bar.style.width = data.percent + '%';
        if (pct) pct.textContent = data.percent.toFixed(1) + '%';
        if (meta) {
          const sizeText = data.totalSize > 0
            ? formatBytes(data.downloadedSize) + ' / ' + formatBytes(data.totalSize)
            : formatBytes(data.downloadedSize);
          const speedText = data.status === 'downloading' ? formatSpeed(data.speed) : '';
          const etaText = data.status === 'downloading' && data.eta > 0 ? formatETA(data.eta) : '';

          let parts = [`<span class="status-badge ${data.status}">${STATUS_LABELS[data.status]}</span>`];
          parts.push('<span>' + sizeText + '</span>');
          if (speedText) parts.push('<span>' + speedText + '</span>');
          if (etaText) parts.push('<span>' + etaText + '</span>');
          meta.innerHTML = parts.join('');
        }
      }

      updateStats();
    });

    removeStatusListener = window.downloadAPI.onStatusChange(() => {
      refreshDownloads();
    });

    removeErrorListener = window.downloadAPI.onError(() => {
      refreshDownloads();
    });
  }

  // Settings
  async function loadSettingsUI() {
    const s = await window.downloadAPI.getSettings();
    settingPath.value = s.savePath || '';
    settingConcurrent.value = String(s.maxConcurrent || 3);
    settingConnections.value = String(s.connections || 8);
  }

  btnBrowse.addEventListener('click', async () => {
    const folder = await window.downloadAPI.selectFolder();
    if (folder) settingPath.value = folder;
  });

  btnSaveSettings.addEventListener('click', async () => {
    await window.downloadAPI.saveSettings({
      savePath: settingPath.value,
      maxConcurrent: parseInt(settingConcurrent.value, 10),
      connections: parseInt(settingConnections.value, 10),
    });
    btnSaveSettings.textContent = 'Guardado';
    setTimeout(() => { btnSaveSettings.textContent = 'Guardar Cambios'; }, 1500);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('show')) {
      closeModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openModal();
    }
  });

  // Init
  setupListeners();
  refreshDownloads();

  setInterval(refreshDownloads, 3000);
})();
