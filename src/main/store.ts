import { app, ipcMain, type Rectangle } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Saved, Theme } from '../shared/ipc';

const cfgFile = () => path.join(app.getPath('userData'), 'float-config.json');
export const cfg = {
  bounds: null as Rectangle | null, opacity: 1, pinned: true, trayHinted: false, theme: 'system' as Theme,
  perms: {} as Record<string, boolean>, // "origin permission" → allowed, see permissions.ts
};
let saveTimer: NodeJS.Timeout | undefined;

export function loadCfg() {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgFile(), 'utf8'))); } catch {}
}
export function saveCfg() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)); } catch {}
  }, 300);
}

// Tabs, history, bookmarks, zoom: kept here instead of the page's localStorage so they don't depend on where the UI
// is loaded from (dev server or file). The renderer already batches writes (≤ 1 per 0.5s) → write straight to disk
const storeFile = () => path.join(app.getPath('userData'), 'store.json');
let store: Saved = {};
ipcMain.handle('store-get', () => {
  try { return (store = JSON.parse(fs.readFileSync(storeFile(), 'utf8'))); } catch { return null; }
});
ipcMain.on('store-set', (_e, data: Saved) => {
  Object.assign(store, data);
  try { fs.writeFileSync(storeFile(), JSON.stringify(store)); } catch {}
});
