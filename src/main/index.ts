import { app, globalShortcut, ipcMain, net, session } from 'electron';
import path from 'path';
import { hostOf } from '../renderer/src/url';
import { contextMenu } from './context-menu';
import { handleDownloads } from './downloads';
import { googleLoginHeaders, googleLoginUA } from './google-login';
import { hookKeys } from './keys';
import { askToSave, passwords } from './passwords';
import { askPermissions } from './permissions';
import { screenShare } from './screen-share';
import { cfg, loadCfg, saveCfg } from './store';
import { checkUpdate } from './updater';
import { applyTheme, createTray, createWindow, icon, registerKeys, send, show, tray, win } from './window';

// The installed build is named "Dock Web" → by default it stores data somewhere other than `npm start`.
// Pin one folder so both share tabs, bookmarks, history and logins
app.setPath('userData', path.join(app.getPath('appData'), 'dock-web'));

// Google search suggestions for the address bar (fetched from main because the page is blocked by CORS)
ipcMain.handle('suggest', async (_e, q: string) => {
  try {
    const r = await net.fetch('https://suggestqueries.google.com/complete/search?client=chrome&hl=vi&ie=utf-8&oe=utf-8&q=' + encodeURIComponent(q));
    return (await r.json())[1] || [];
  } catch { return []; }
});

// ⋯ → "Xoá cookie và dữ liệu trang web": signs out of every site and forgets the camera/micro/… answers
ipcMain.handle('clear-data', async () => {
  const ses = session.fromPartition('persist:dock');
  await ses.clearStorageData();
  await ses.clearCache();
  cfg.perms = {};
  saveCfg();
});

// Sites that ask for a username/password over HTTP (router pages, intranet, proxies) → box in the UI.
// Answered with nothing = cancelled → the site shows its "401" page
const logins = new Map<number, (username?: string, password?: string) => void>();
let nextLogin = 1;
app.on('login', (e, _contents, _details, info, cb) => {
  e.preventDefault();
  logins.set(nextLogin, cb);
  send('login', nextLogin++, info.host, info.realm);
});
ipcMain.on('login', (_e, id: number, username?: string, password?: string) => {
  logins.get(id)?.(username, password);
  logins.delete(id);
});

// Broken HTTPS certificate: blocked like Chrome; "Vẫn tiếp tục" on the error page allows that host until the app quits
const certOk = new Set<string>();
app.on('certificate-error', (e, _contents, url, _error, _cert, cb) => {
  if (!certOk.has(hostOf(url))) return cb(false);
  e.preventDefault();
  cb(true);
});
ipcMain.on('cert-ok', (_e, host: string) => certOk.add(host));

app.on('web-contents-created', (_e, contents) => {
  googleLoginUA(contents); // both tabs and sign-in popup windows
  if (contents.getType() !== 'webview') return;
  hookKeys(contents);
  contextMenu(contents);
  askToSave(contents);
  // Ctrl + mouse wheel in the page → renderer zooms per domain
  contents.on('zoom-changed', (_e, dir) => send('key', dir === 'in' ? 'zoomIn' : 'zoomOut'));
  contents.on('audio-state-changed', (e) => send('audio', contents.id, e.audible));
  // Sized popups (e.g. "Sign in with Google") → a real child window so the opener page receives the result.
  // target=_blank links → new tab
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (disposition === 'new-window') {
      return { action: 'allow', overrideBrowserWindowOptions: { parent: win, icon, autoHideMenuBar: true, width: 520, height: 680 } };
    }
    send('open-tab', url, !contents.session.isPersistent());
    return { action: 'deny' };
  });
});

// Links and files opened from other apps once Dock Web is picked as the browser in Windows (see build/installer.nsh).
// Skips the exe (+ the app folder under `npm start`) and Chromium/our flags; file paths become file:/// in the renderer
const openArgs = (argv: string[]) => argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-')).forEach((u) => send('open-tab', u));

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => {
  if (!win) return;
  show();
  openArgs(argv);
});

app.whenReady().then(() => {
  // UA like real Chrome: drop "Electron/…" + the app name, and keep only the major version (Chrome/156.0.0.0) —
  // real Chrome never sends the full build number; Google treats that as a sign of an embedded browser
  app.userAgentFallback = app.userAgentFallback
    .replace(/ Electron\/\S+/, '')
    .replace(` ${app.getName()}/${app.getVersion()}`, '')
    .replace(/Chrome\/(\d+)[\d.]*/, 'Chrome/$1.0.0.0');
  // Normal tabs + incognito tabs (in memory only: gone when the app quits)
  const sessions = [session.fromPartition('persist:dock'), session.fromPartition('incognito')];
  for (const ses of sessions) {
    googleLoginHeaders(ses);
    askPermissions(ses);
    screenShare(ses);
    handleDownloads(ses);
    passwords(ses);
  }
  loadCfg();
  applyTheme();
  createTray();
  const w = createWindow();
  w.webContents.once('did-finish-load', () => openArgs(process.argv));
  hookKeys(w.webContents);
  contextMenu(w.webContents); // address bar, find box, bookmark rename (tab/bookmark menus preventDefault → never reach here)
  checkUpdate();
  // Global shortcuts may already be taken by other apps → notify instead of failing silently
  const taken = registerKeys();
  if (taken.length) {
    tray.displayBalloon({ iconType: 'warning', title: 'Phím tắt bị app khác chiếm', content: `${taken.join(', ')} không dùng được. Đổi phím trong menu ⋯ của Dock Web.` });
  }
});
app.on('will-quit', () => globalShortcut.unregisterAll());
