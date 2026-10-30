import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { send } from './window';

// Auto-update from GitHub Releases (latest.yml uploaded next to the installer): downloads in the background, then the
// "Cập nhật" button shows; it also installs on quit. Checked again every 6h because the app lives in the tray for days
export function checkUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.on('update-downloaded', (i) => send('update', i.version));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 6 * 3600e3);
}
ipcMain.on('install-update', () => autoUpdater.quitAndInstall());
