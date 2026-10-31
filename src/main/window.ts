/// <reference types="electron-vite/node" />
import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, screen, Tray, type NativeImage, type Rectangle } from 'electron';
import path from 'path';
import iconFile from '../../build/icon.ico?asset'; // same icon as the installer; .ico holds every size 16–256px
import type { Theme, UiEvents } from '../shared/ipc';
import { fadePip, togglePip } from './pip';
import { cfg, saveCfg } from './store';

export let win: BrowserWindow;
export let tray: Tray;
export let icon: NativeImage;
let resizeTimer: NodeJS.Timeout | undefined;
let ghost = false, quitting = false;

// Message to the UI; channels and their arguments are listed in shared/ipc.ts
export function send<K extends keyof UiEvents>(channel: K, ...args: UiEvents[K]) {
  win?.webContents.send(channel, ...args);
}

// Default position: lower half of the primary display
function defaultBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.round(wa.width * 0.6), height = Math.round(wa.height * 0.45);
  return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + wa.height - height - 20, width, height };
}

// Discard the saved position if it lies outside the current displays (e.g. a secondary monitor was unplugged)
function validBounds(b: Rectangle | null) {
  if (!b || b.width < 240 || b.height < 160) return null;
  const visible = screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 60 && b.x + b.width > w.x + 60 &&
    b.y >= w.y - 10 && b.y < w.y + w.height - 40);
  return visible ? b : null;
}

export function createWindow() {
  win = new BrowserWindow({
    ...(validBounds(cfg.bounds) || defaultBounds()),
    minWidth: 240,
    minHeight: 160,
    frame: false,
    icon,
    backgroundColor: bgColor(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  applyPin();
  applyOpacity();
  // `npm start` serves the UI from Vite's dev server (hot reload); the installed build loads the bundled file
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.on('did-finish-load', sendState);

  const remember = () => { if (!win.isMinimized()) { cfg.bounds = win.getBounds(); saveCfg(); } };
  win.on('move', remember);
  win.on('resize', remember);
  win.on('maximize', sendState);
  win.on('unmaximize', sendState);
  // ✕ / Alt+F4 only hides to the tray; quit for real via the ⋯ menu or the tray icon
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); hide(); } });
  return win;
}
app.on('before-quit', () => { quitting = true; });

export function createTray() {
  icon = nativeImage.createFromPath(iconFile);
  tray = new Tray(icon);
  tray.setToolTip('Dock Web');
  tray.on('click', show);
  tray.setContextMenu(trayMenu());
}

// 'system' | 'light' | 'dark' — like Chrome's Appearance setting: drives prefers-color-scheme for the UI and for web pages
export function applyTheme() { nativeTheme.themeSource = cfg.theme; }
// Matches --bg in style.css → no flash of the wrong color while the window opens or resizes
const bgColor = () => (nativeTheme.shouldUseDarkColors ? '#1e1f22' : '#f1f3f4');

function applyPin() {
  // 'screen-saver' = highest level, stays above even fullscreen apps
  win.setAlwaysOnTop(cfg.pinned, 'screen-saver');
  win.setVisibleOnAllWorkspaces(cfg.pinned, { visibleOnFullScreen: true });
}

export function sendState() {
  send('state', { opacity: cfg.opacity, pinned: cfg.pinned, ghost, maximized: win.isMaximized(), theme: cfg.theme, adblock: cfg.adblock });
  tray?.setContextMenu(trayMenu());
}

export function show() { win.show(); win.focus(); }
function hide() {
  win.hide();
  if (!cfg.trayHinted) {
    cfg.trayHinted = true;
    saveCfg();
    tray.displayBalloon({ iconType: 'info', title: 'Dock Web vẫn đang chạy', content: 'Bấm icon ở khay hoặc Ctrl+Shift+Space để mở lại.' });
  }
}
export function toggle() {
  if (win.isVisible() && (win.isFocused() || ghost)) hide();
  else show();
}

function togglePin() {
  cfg.pinned = !cfg.pinned;
  if (!ghost) applyPin();
  saveCfg();
  sendState();
}

// Click-through: the window fades (at most 60% opacity) and every click falls through to the app underneath
const opacity = () => (ghost ? Math.min(cfg.opacity, 0.6) : cfg.opacity);
function applyOpacity() {
  win.setOpacity(opacity());
  fadePip(opacity());
}
export function toggleGhost() {
  ghost = !ghost;
  win.setIgnoreMouseEvents(ghost);
  applyOpacity();
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

ipcMain.on('opacity', (_e, v: number) => { cfg.opacity = v; applyOpacity(); saveCfg(); });
ipcMain.on('theme', (_e, v: Theme) => { cfg.theme = v; applyTheme(); saveCfg(); sendState(); });
nativeTheme.on('updated', () => win?.setBackgroundColor(bgColor())); // our choice, or Windows switching light/dark in 'system' mode
ipcMain.on('pin', togglePin);
ipcMain.on('ghost', toggleGhost);
ipcMain.on('minimize', () => win.minimize());
ipcMain.on('maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('hide', hide);
ipcMain.on('quit', () => app.quit());
ipcMain.handle('pip', async (_e, id: number) => { if (await togglePip(id)) fadePip(opacity()); });
