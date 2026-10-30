const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('dock', {
  resizeStart: () => ipcRenderer.send('resize-start'),
  resizeEnd: () => ipcRenderer.send('resize-end'),
  opacity: (v) => ipcRenderer.send('opacity', v),
  pin: () => ipcRenderer.send('pin'),
  theme: (v) => ipcRenderer.send('theme', v),
  ghost: () => ipcRenderer.send('ghost'),
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  installUpdate: () => ipcRenderer.send('install-update'),
  filePath: (file) => webUtils.getPathForFile(file),
  suggest: (q) => ipcRenderer.invoke('suggest', q),
  pip: (id) => ipcRenderer.invoke('pip', id),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onOpenTab: (cb) => ipcRenderer.on('open-tab', (_e, url) => cb(url)),
  onKey: (cb) => ipcRenderer.on('key', (_e, action) => cb(action)),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, version) => cb(version)),
  onAudio: (cb) => ipcRenderer.on('audio', (_e, id, audible) => cb(id, audible)),
});
