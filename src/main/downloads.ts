import { app, ipcMain, shell, type DownloadItem, type Session } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Download } from '../shared/ipc';
import { send, win } from './window';

// Like Chrome: saved straight into Downloads (no "Save as" box), progress on the address bar's ⬇ button and the taskbar
const items = new Map<number, DownloadItem>();
let nextId = 1;

export function handleDownloads(ses: Session) {
  ses.on('will-download', (_e, item) => {
    const id = nextId++;
    items.set(id, item);
    item.setSavePath(freePath(path.join(app.getPath('downloads'), item.getFilename())));
    const update = (state: Download['state']) => {
      send('download', { id, name: path.basename(item.getSavePath()), received: item.getReceivedBytes(), total: item.getTotalBytes(), state });
      taskbar();
    };
    item.on('updated', (_e, state) => update(state === 'interrupted' ? 'interrupted' : 'progressing'));
    item.once('done', (_e, state) => update(state));
    update('progressing');
  });
}

// "a.zip" already there → "a (1).zip", like Chrome
function freePath(p: string) {
  const { dir, name, ext } = path.parse(p);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${name} (${i})${ext}`);
  return p;
}

function taskbar() {
  const running = [...items.values()].filter((i) => i.getState() === 'progressing');
  const total = running.reduce((s, i) => s + i.getTotalBytes(), 0);
  if (!running.length) win.setProgressBar(-1);
  else if (running.some((i) => !i.getTotalBytes())) win.setProgressBar(2); // size unknown → indeterminate
  else win.setProgressBar(running.reduce((s, i) => s + i.getReceivedBytes(), 0) / total);
}

ipcMain.on('download', (_e, id: number, action: 'open' | 'cancel') => {
  const item = items.get(id);
  if (action === 'cancel') item?.cancel();
  else if (item) shell.openPath(item.getSavePath());
});
ipcMain.on('downloads-folder', () => shell.openPath(app.getPath('downloads')));
