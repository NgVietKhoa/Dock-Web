import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DockState, Download, GlobalKeys, KeyAction, Saved, Theme } from '../shared/ipc';

const api = {
  resizeStart: () => ipcRenderer.send('resize-start'),
  resizeEnd: () => ipcRenderer.send('resize-end'),
  opacity: (v: number) => ipcRenderer.send('opacity', v),
  pin: () => ipcRenderer.send('pin'),
  theme: (v: Theme) => ipcRenderer.send('theme', v),
  ghost: () => ipcRenderer.send('ghost'),
  autoStart: () => ipcRenderer.send('auto-start'),
  globalKey: (action: keyof GlobalKeys, key: string): Promise<boolean> => ipcRenderer.invoke('global-key', action, key),
  clearData: (): Promise<void> => ipcRenderer.invoke('clear-data'),
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  installUpdate: () => ipcRenderer.send('install-update'),
  filePath: (file: File) => webUtils.getPathForFile(file),
  download: (id: number, action: 'pause' | 'resume' | 'cancel') => ipcRenderer.send('download', id, action),
  openFile: (path: string) => ipcRenderer.send('open-file', path),
  certOk: (host: string) => ipcRenderer.send('cert-ok', host),
  downloadsFolder: () => ipcRenderer.send('downloads-folder'),
  passwords: () => ipcRenderer.send('passwords'),
  suggest: (q: string): Promise<string[]> => ipcRenderer.invoke('suggest', q),
  pip: (id: number): Promise<void> => ipcRenderer.invoke('pip', id),
  storeGet: (): Promise<Saved | null> => ipcRenderer.invoke('store-get'),
  storeSet: (data: Saved) => ipcRenderer.send('store-set', data),
  onState: (cb: (s: DockState) => void) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onOpenTab: (cb: (url: string, incognito?: boolean) => void) => ipcRenderer.on('open-tab', (_e, url, incognito) => cb(url, incognito)),
  onKey: (cb: (action: KeyAction) => void) => ipcRenderer.on('key', (_e, action) => cb(action)),
  onUpdate: (cb: (version: string) => void) => ipcRenderer.on('update', (_e, version) => cb(version)),
  onAudio: (cb: (id: number, audible: boolean) => void) => ipcRenderer.on('audio', (_e, id, audible) => cb(id, audible)),
  onDownload: (cb: (d: Download) => void) => ipcRenderer.on('download', (_e, d) => cb(d)),
  onLogin: (cb: (id: number, host: string, realm: string) => void) => ipcRenderer.on('login', (_e, id, host, realm) => cb(id, host, realm)),
  login: (id: number, username?: string, password?: string) => ipcRenderer.send('login', id, username, password),
};
contextBridge.exposeInMainWorld('dock', api);

export type DockApi = typeof api;
