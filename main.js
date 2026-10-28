const { app, BrowserWindow, screen, globalShortcut, ipcMain, Tray, Menu, nativeImage, net, session } = require('electron');
const path = require('path');
const fs = require('fs');

// The installed build is named "Dock Web" → by default it stores data somewhere other than `npm start`.
// Pin one folder so both share tabs, bookmarks, history and logins
app.setPath('userData', path.join(app.getPath('appData'), 'dock-web'));

const cfgFile = () => path.join(app.getPath('userData'), 'float-config.json');
let cfg = { bounds: null, opacity: 1, pinned: true, trayHinted: false };
let win, tray, icon, saveTimer, resizeTimer;
let ghost = false, quitting = false;

function loadCfg() {
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch {}
}
function saveCfg() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)); } catch {}
  }, 300);
}

// Icon drawn in code (rounded square + white bar = dock panel) → no image file needed
function makeIcon() {
  const S = 32, r = 7, buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const cx = Math.min(Math.max(x + 0.5, r), S - r), cy = Math.min(Math.max(y + 0.5, r), S - r);
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
    const bar = y >= 19 && y < 25 && x >= 7 && x < 25;
    const [R, G, B] = bar ? [255, 255, 255] : [0x58, 0x65, 0xf2];
    buf.set([B, G, R, 255], (y * S + x) * 4); // raw BGRA bitmap
  }
  return nativeImage.createFromBitmap(buf, { width: S, height: S, scaleFactor: 2 });
}

// Default position: lower half of the primary display
function defaultBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.round(wa.width * 0.6), height = Math.round(wa.height * 0.45);
  return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + wa.height - height - 20, width, height };
}

// Discard the saved position if it lies outside the current displays (e.g. a secondary monitor was unplugged)
function validBounds(b) {
  if (!b || b.width < 240 || b.height < 160) return null;
  const visible = screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 60 && b.x + b.width > w.x + 60 &&
    b.y >= w.y - 10 && b.y < w.y + w.height - 40);
  return visible ? b : null;
}

function createWindow() {
  win = new BrowserWindow({
    ...(validBounds(cfg.bounds) || defaultBounds()),
    minWidth: 240,
    minHeight: 160,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    icon,
    backgroundColor: '#1e1f22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  applyPin();
  win.setOpacity(cfg.opacity);
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', sendState);
  hookKeys(win.webContents);

  const remember = () => { if (!win.isMinimized()) { cfg.bounds = win.getBounds(); saveCfg(); } };
  win.on('move', remember);
  win.on('resize', remember);
  // ✕ / Alt+F4 only hides to the tray; quit for real via the ⋯ menu or the tray icon
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); hide(); } });
}

function applyPin() {
  // 'screen-saver' = highest level, stays above even fullscreen apps
  win.setAlwaysOnTop(cfg.pinned, 'screen-saver');
  win.setVisibleOnAllWorkspaces(cfg.pinned, { visibleOnFullScreen: true });
}

function sendState() {
  win.webContents.send('state', { opacity: cfg.opacity, pinned: cfg.pinned, ghost });
  tray?.setContextMenu(trayMenu());
}

function show() { win.show(); win.focus(); }
function hide() {
  win.hide();
  if (!cfg.trayHinted) {
    cfg.trayHinted = true;
    saveCfg();
    tray.displayBalloon({ iconType: 'info', title: 'Dock Web vẫn đang chạy', content: 'Bấm icon ở khay hoặc Ctrl+Shift+Space để mở lại.' });
  }
}
function toggle() {
  if (win.isVisible() && (win.isFocused() || ghost)) hide();
  else show();
}

function togglePin() {
  cfg.pinned = !cfg.pinned;
  if (!ghost) applyPin();
  saveCfg();
  sendState();
}

// Click-through: the window fades and every click falls through to the app underneath
function toggleGhost() {
  ghost = !ghost;
  win.setIgnoreMouseEvents(ghost);
  win.setOpacity(ghost ? Math.min(cfg.opacity, 0.6) : cfg.opacity);
  if (ghost) {
    win.setAlwaysOnTop(true, 'screen-saver');
    if (!win.isVisible()) win.showInactive();
    win.blur();
  } else applyPin();
  sendState();
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Mở Dock Web', accelerator: 'CommandOrControl+Shift+Space', registerAccelerator: false, click: show },
    { label: 'Xuyên chuột', type: 'checkbox', checked: ghost, accelerator: 'CommandOrControl+Alt+Space', registerAccelerator: false, click: toggleGhost },
    { label: 'Luôn nằm trên cùng', type: 'checkbox', checked: cfg.pinned, click: togglePin },
    { type: 'separator' },
    { label: 'Thoát', click: () => app.quit() },
  ]);
}

// Snap to a screen edge (the window can still be dragged freely afterwards)
function snap(side) {
  const wa = screen.getDisplayMatching(win.getBounds()).workArea;
  const b = win.getBounds();
  const w = Math.min(b.width, wa.width), h = Math.min(b.height, wa.height);
  const map = {
    left:   { x: wa.x, y: wa.y, width: w, height: wa.height },
    right:  { x: wa.x + wa.width - w, y: wa.y, width: w, height: wa.height },
    bottom: { x: wa.x, y: wa.y + wa.height - h, width: wa.width, height: h },
    top:    { x: wa.x, y: wa.y, width: wa.width, height: h },
  };
  if (map[side]) win.setBounds(map[side]);
}

// Shortcuts: caught in main because while focus is inside a page, the webview swallows all keys
function keyAction(i) {
  if (i.type !== 'keyDown') return null;
  const k = i.key.length === 1 ? i.key.toLowerCase() : i.key;
  const c = i.control || i.meta;
  if (c && i.shift && k === 't') return 'reopen';
  if ((c && i.shift && k === 'r') || (c && k === 'F5')) return 'hardReload';
  if (k === 'F5' || (c && k === 'r')) return 'reload';
  if (c && k === 't') return 'newTab';
  if (c && k === 'w') return 'closeTab';
  if ((c && k === 'l') || k === 'F6' || (i.alt && k === 'd')) return 'focusUrl';
  if (i.alt && k === 'ArrowLeft') return 'back';
  if (i.alt && k === 'ArrowRight') return 'forward';
  if (c && k === 'Tab') return i.shift ? 'prevTab' : 'nextTab';
  if (c && /^[1-9]$/.test(k)) return 'tab' + k;
  if (c && k === 'd') return 'bookmark';
  if (c && k === 'f') return 'find';
  if (c && (k === '=' || k === '+')) return 'zoomIn';
  if (c && k === '-') return 'zoomOut';
  if (c && k === '0') return 'zoomReset';
  return null;
}
function hookKeys(contents) {
  contents.on('before-input-event', (e, input) => {
    const a = keyAction(input);
    if (a) { e.preventDefault(); win?.webContents.send('key', a); }
  });
}

// Corner-drag resize: main reads the real cursor position → no drift at Windows 125%/150% scaling
ipcMain.on('resize-start', () => {
  const start = screen.getCursorScreenPoint();
  const b0 = win.getBounds();
  const [minW, minH] = win.getMinimumSize();
  clearInterval(resizeTimer);
  resizeTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    win.setBounds({
      x: b0.x, y: b0.y,
      width: Math.max(minW, b0.width + p.x - start.x),
      height: Math.max(minH, b0.height + p.y - start.y),
    });
  }, 16);
});
ipcMain.on('resize-end', () => clearInterval(resizeTimer));

ipcMain.on('snap', (_e, side) => snap(side));
ipcMain.on('opacity', (_e, v) => { cfg.opacity = v; win.setOpacity(ghost ? Math.min(v, 0.6) : v); saveCfg(); });
ipcMain.on('pin', togglePin);
ipcMain.on('ghost', toggleGhost);
ipcMain.on('maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('hide', hide);
ipcMain.on('quit', () => app.quit());

// Google search suggestions for the address bar (fetched from main because the file:// page is blocked by CORS)
ipcMain.handle('suggest', async (_e, q) => {
  try {
    const r = await net.fetch('https://suggestqueries.google.com/complete/search?client=chrome&hl=vi&ie=utf-8&oe=utf-8&q=' + encodeURIComponent(q));
    return (await r.json())[1] || [];
  } catch { return []; }
});

// Google blocks sign-in inside embedded browsers ("This browser or app may not be secure").
// Same trick as Ferdium/Rambox: identify as Firefox on the Google sign-in page only
const GOOGLE_LOGIN = 'https://accounts.google.com/';
const FIREFOX_UA = (() => {
  // Firefox ships a new version every ~4 weeks; step by 30 days so we never claim an unreleased version
  const v = 128 + Math.floor((Date.now() - Date.UTC(2024, 6, 9)) / (30 * 864e5));
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;
})();

// Headers: swap User-Agent + drop Sec-CH-UA* (Firefox never sends these; leaving them exposes Chromium)
function googleLoginHeaders(ses) {
  ses.webRequest.onBeforeSendHeaders({ urls: [GOOGLE_LOGIN + '*'] }, (d, cb) => {
    const h = d.requestHeaders;
    h['User-Agent'] = FIREFOX_UA;
    for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
    cb({ requestHeaders: h });
  });
}
// navigator.userAgent in the page: swap on entering the sign-in page, restore the original UA on leaving
function googleLoginUA(contents) {
  let orig = null;
  contents.on('did-start-navigation', ({ url, isMainFrame }) => {
    if (!isMainFrame) return;
    const login = url.startsWith(GOOGLE_LOGIN);
    if (login && orig === null) { orig = contents.getUserAgent(); contents.setUserAgent(FIREFOX_UA); }
    else if (!login && orig !== null) { contents.setUserAgent(orig); orig = null; }
  });
}

app.on('web-contents-created', (_e, contents) => {
  googleLoginUA(contents); // both tabs and sign-in popup windows
  if (contents.getType() !== 'webview') return;
  hookKeys(contents);
  // Ctrl + mouse wheel in the page → renderer zooms per domain
  contents.on('zoom-changed', (_e, dir) => win?.webContents.send('key', dir === 'in' ? 'zoomIn' : 'zoomOut'));
  contents.on('audio-state-changed', (e) => win?.webContents.send('audio', contents.id, e.audible));
  // Sized popups (e.g. "Sign in with Google") → a real child window so the opener page receives the result.
  // target=_blank links → new tab
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (disposition === 'new-window') {
      return { action: 'allow', overrideBrowserWindowOptions: { parent: win, icon, autoHideMenuBar: true, width: 520, height: 680 } };
    }
    win?.webContents.send('open-tab', url);
    return { action: 'deny' };
  });
});

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => win && show());

app.whenReady().then(() => {
  // UA like real Chrome: drop "Electron/…" + the app name, and keep only the major version (Chrome/156.0.0.0) —
  // real Chrome never sends the full build number; Google treats that as a sign of an embedded browser
  app.userAgentFallback = app.userAgentFallback
    .replace(/ Electron\/\S+/, '')
    .replace(` ${app.getName()}/${app.getVersion()}`, '')
    .replace(/Chrome\/(\d+)[\d.]*/, 'Chrome/$1.0.0.0');
  googleLoginHeaders(session.fromPartition('persist:dock'));
  loadCfg();
  icon = makeIcon();
  tray = new Tray(icon);
  tray.setToolTip('Dock Web');
  tray.on('click', show);
  tray.setContextMenu(trayMenu());
  createWindow();
  // Global shortcuts may already be taken by other apps (Unikey, screenshot tools…) → notify instead of failing silently
  const taken = [['Ctrl+Shift+Space', toggle], ['Ctrl+Alt+Space', toggleGhost]]
    .filter(([k, fn]) => !globalShortcut.register(k.replace('Ctrl', 'CommandOrControl'), fn))
    .map(([k]) => k);
  if (taken.length) {
    tray.displayBalloon({ iconType: 'warning', title: 'Phím tắt bị app khác chiếm', content: `${taken.join(', ')} không dùng được. Dùng icon ở khay thay thế.` });
  }
});
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
