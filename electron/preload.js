const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monml', {
  platform: 'electron',
  version: () => ipcRenderer.invoke('app-version'),
  saveFile: (name, content) => ipcRenderer.invoke('save-file', { name, content }),
  onUpdate: cb => ipcRenderer.on('update', (_e, d) => cb(d)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
});
