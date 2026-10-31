import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DockState, Download, KeyAction, Saved, Theme } from '../shared/ipc';

const api = {
  resizeStart: () => ipcRenderer.send('resize-start'),
  resizeEnd: () => ipcRenderer.send('resize-end'),
  opacity: (v: number) => ipcRenderer.send('opacity', v),
  pin: () => ipcRenderer.send('pin'),
  theme: (v: Theme) => ipcRenderer.send('theme', v),
  ghost: () => ipcRenderer.send('ghost'),
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  installUpdate: () => ipcRenderer.send('install-update'),
  filePath: (file: File) => webUtils.getPathForFile(file),
  download: (id: number, action: 'open' | 'cancel') => ipcRenderer.send('download', id, action),
  downloadsFolder: () => ipcRenderer.send('downloads-folder'),
  suggest: (q: string): Promise<string[]> => ipcRenderer.invoke('suggest', q),
  pip: (id: number): Promise<void> => ipcRenderer.invoke('pip', id),
  storeGet: (): Promise<Saved | null> => ipcRenderer.invoke('store-get'),
  storeSet: (data: Saved) => ipcRenderer.send('store-set', data),
  onState: (cb: (s: DockState) => void) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onOpenTab: (cb: (url: string) => void) => ipcRenderer.on('open-tab', (_e, url) => cb(url)),
  onKey: (cb: (action: KeyAction) => void) => ipcRenderer.on('key', (_e, action) => cb(action)),
  onUpdate: (cb: (version: string) => void) => ipcRenderer.on('update', (_e, version) => cb(version)),
  onAudio: (cb: (id: number, audible: boolean) => void) => ipcRenderer.on('audio', (_e, id, audible) => cb(id, audible)),
  onDownload: (cb: (d: Download) => void) => ipcRenderer.on('download', (_e, d) => cb(d)),
};
contextBridge.exposeInMainWorld('dock', api);

export type DockApi = typeof api;
