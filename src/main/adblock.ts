import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, ipcMain, net, type Session } from 'electron';
import fs from 'fs';
import path from 'path';
import { cfg, saveCfg } from './store';
import { sendState } from './window';

// Ads + trackers blocked with Ghostery's prebuilt lists (EasyList…). The compiled lists are cached in userData and
// fetched again after a week so new ad domains get blocked
let blocker: ElectronBlocker | undefined;
let ses: Session;

export async function adblock(s: Session) {
  ses = s;
  const cache = path.join(app.getPath('userData'), 'adblock.bin');
  try { if (Date.now() - fs.statSync(cache).mtimeMs > 7 * 864e5) fs.unlinkSync(cache); } catch {}
  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(net.fetch, { path: cache, read: fs.promises.readFile, write: fs.promises.writeFile });
  } catch { return; } // no network and no cache yet → try again next launch
  if (cfg.adblock) blocker.enableBlockingInSession(ses);
}

ipcMain.on('adblock', () => {
  cfg.adblock = !cfg.adblock;
  saveCfg();
  if (blocker) cfg.adblock ? blocker.enableBlockingInSession(ses) : blocker.disableBlockingInSession(ses);
  sendState();
});
