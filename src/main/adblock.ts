import { ElectronBlocker, Request } from '@ghostery/adblocker-electron';
import { app, ipcMain, net, type Session } from 'electron';
import fs from 'fs';
import path from 'path';
import { cfg, saveCfg } from './store';
import { sendState } from './window';

// Ads + trackers blocked with Ghostery's prebuilt lists (EasyList, uBlock Origin…). The compiled lists are cached in
// userData and fetched again after a week so new ad domains get blocked
let blocker: ElectronBlocker | undefined;
let sessions: Session[] = []; // normal + incognito tabs
let pageScripts: (url: string) => string[] = () => [];

export async function adblock(s: Session[]) {
  sessions = s;
  const cache = path.join(app.getPath('userData'), 'adblock.bin');
  try { if (Date.now() - fs.statSync(cache).mtimeMs > 7 * 864e5) fs.unlinkSync(cache); } catch {}
  let b: ElectronBlocker;
  try {
    blocker = b = await ElectronBlocker.fromPrebuiltAdsAndTracking(net.fetch, { path: cache, read: fs.promises.readFile, write: fs.promises.writeFile });
  } catch { return; } // no network and no cache yet → try again next launch
  // Scriptlets (the lists' tricks that defuse "turn off your ad blocker" checks) only work if they run before the
  // page's own scripts. Ghostery's preload asks for them asynchronously → too late, the page has already checked.
  // preload/page.ts asks synchronously instead; Ghostery's own injection keeps only the CSS that hides ads
  const get = b.getCosmeticsFilters.bind(b);
  b.getCosmeticsFilters = (o) => get({ ...o, getInjectionRules: false });
  pageScripts = (url) => {
    const { hostname, domain } = Request.fromRawDetails({ url });
    return get({ url, hostname, domain, getBaseRules: false, getInjectionRules: true, getExtendedRules: false, getRulesFromDOM: false, getRulesFromHostname: true }).scripts;
  };
  if (cfg.adblock) sessions.forEach((ses) => enable(b, ses));
}

// Ghostery registers its IPC handlers app-wide each time it is enabled in a session → the 2nd session (incognito)
// would throw. The handlers don't depend on the session, so drop them before each enable
function enable(b: ElectronBlocker, ses: Session) {
  ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters');
  ipcMain.removeHandler('@ghostery/adblocker/is-mutation-observer-enabled');
  b.enableBlockingInSession(ses);
}

ipcMain.on('adblock-scripts', (e, url: string) => { e.returnValue = cfg.adblock ? pageScripts(url) : []; });

ipcMain.on('adblock', () => {
  cfg.adblock = !cfg.adblock;
  saveCfg();
  const b = blocker;
  if (b) sessions.forEach((ses) => (cfg.adblock ? enable(b, ses) : b.disableBlockingInSession(ses)));
  sendState();
});
