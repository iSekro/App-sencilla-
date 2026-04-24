'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloadAPI', {
  addDownload: (options) => ipcRenderer.invoke('download:add', options),
  pauseDownload: (id) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  removeDownload: (id) => ipcRenderer.invoke('download:remove', id),
  getAllDownloads: () => ipcRenderer.invoke('download:getAll'),
  getStats: () => ipcRenderer.invoke('download:getStats'),
  openFile: (filePath) => ipcRenderer.invoke('download:openFile', filePath),
  openFolder: (filePath) => ipcRenderer.invoke('download:openFolder', filePath),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  getDefaultPath: () => ipcRenderer.invoke('download:getDefaultPath'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onStatusChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:statusChange', handler);
    return () => ipcRenderer.removeListener('download:statusChange', handler);
  },
  onError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:error', handler);
    return () => ipcRenderer.removeListener('download:error', handler);
  },
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
});
