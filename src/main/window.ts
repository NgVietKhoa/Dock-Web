/// <reference types="electron-vite/node" />
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, screen, Tray, type NativeImage, type Rectangle } from 'electron';
import path from 'path';
import iconFile from '../../build/icon.ico?asset'; // same icon as the installer; .ico holds every size 16–256px
import type { GlobalKeys, Theme, UiEvents } from '../shared/ipc';
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
    show: !process.argv.includes('--hidden'), // started with Windows → only the tray icon
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
  win.on('moved', snap);
  win.on('maximize', sendState);
  win.on('unmaximize', sendState);
  // ✕ / Alt+F4 only hides to the tray; quit for real via the ⋯ menu or the tray icon
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); hide(); } });
  return win;
}
app.on('before-quit', () => { quitting = true; });

// Dock to the screen edge: dropped within 16px of an edge → stick to it
function snap() {
  if (win.isMaximized()) return;
  const b = win.getBounds(), w = screen.getDisplayMatching(b).workArea, near = (a: number, c: number) => Math.abs(a - c) < 16;
  const x = near(b.x, w.x) ? w.x : near(b.x + b.width, w.x + w.width) ? w.x + w.width - b.width : b.x;
  const y = near(b.y, w.y) ? w.y : near(b.y + b.height, w.y + w.height) ? w.y + w.height - b.height : b.y;
  if (x !== b.x || y !== b.y) win.setPosition(x, y);
}

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
  send('state', { opacity: cfg.opacity, pinned: cfg.pinned, ghost, maximized: win.isMaximized(), theme: cfg.theme, adblock: cfg.adblock, autoStart: autoStart(), keys: cfg.keys });
  tray?.setContextMenu(trayMenu());
}

export function show() { win.show(); win.focus(); }
function hide() {
  win.hide();
  if (!cfg.trayHinted) {
    cfg.trayHinted = true;
    saveCfg();
    tray.displayBalloon({ iconType: 'info', title: 'Dock Web vẫn đang chạy', content: `Bấm icon ở khay hoặc ${cfg.keys.toggle} để mở lại.` });
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

// Start with Windows, only the tray icon showing. Installed build only: under `npm start` it would register electron.exe
const LOGIN = { args: ['--hidden'] };
const autoStart = () => (app.isPackaged ? app.getLoginItemSettings(LOGIN).openAtLogin : undefined);
function toggleAutoStart() {
  app.setLoginItemSettings({ ...LOGIN, openAtLogin: !autoStart() });
  sendState();
}

// Global shortcuts. One already taken by another app (Unikey, screenshot tools…) fails to register → false
const GLOBAL: Record<keyof GlobalKeys, () => void> = { toggle, ghost: toggleGhost };
const accel = (key: string) => key.replace('Ctrl', 'CommandOrControl');
function register(action: keyof GlobalKeys, key: string) {
  try { return globalShortcut.register(accel(key), GLOBAL[action]); } catch { return false; } // throws on keys Electron can't name
}
export const registerKeys = () => (Object.keys(GLOBAL) as (keyof GlobalKeys)[]).filter((a) => !register(a, cfg.keys[a])).map((a) => cfg.keys[a]);
ipcMain.handle('global-key', (_e, action: keyof GlobalKeys, key: string) => {
  if (key === cfg.keys[action]) return true;
  if (!register(action, key)) return false;
  globalShortcut.unregister(accel(cfg.keys[action]));
  cfg.keys[action] = key;
  saveCfg();
  sendState();
  return true;
});

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Mở Dock Web', accelerator: accel(cfg.keys.toggle), registerAccelerator: false, click: show },
    { label: 'Xuyên chuột', type: 'checkbox', checked: ghost, accelerator: accel(cfg.keys.ghost), registerAccelerator: false, click: toggleGhost },
    { label: 'Luôn nằm trên cùng', type: 'checkbox', checked: cfg.pinned, click: togglePin },
    { label: 'Khởi động cùng Windows', type: 'checkbox', checked: !!autoStart(), visible: app.isPackaged, click: toggleAutoStart },
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
ipcMain.on('auto-start', toggleAutoStart);
ipcMain.on('minimize', () => win.minimize());
ipcMain.on('maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('hide', hide);
ipcMain.on('quit', () => app.quit());
ipcMain.handle('pip', async (_e, id: number) => { if (await togglePip(id)) fadePip(opacity()); });
