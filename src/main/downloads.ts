import { app, ipcMain, shell, type DownloadItem, type Session, type WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import type { Download } from '../shared/ipc';
import { send, win } from './window';

// Like Chrome: saved straight into Downloads (no "Save as" box), progress on the address bar's ⬇ button and the taskbar
const items = new Map<number, DownloadItem>();
const sessions = new Map<number, Session>(); // id → the session it came from (normal or incognito), to download it again
let nextId = Date.now(); // the renderer keeps finished downloads across launches → ids must not repeat
const askWhere = new Set<string>(); // URLs from "Lưu … thành…" in the right-click menu → Windows save box

export function handleDownloads(ses: Session) {
  ses.on('will-download', (_e, item) => {
    const id = nextId++;
    items.set(id, item);
    sessions.set(id, ses);
    const target = path.join(app.getPath('downloads'), item.getFilename());
    // No save path set → Electron shows the save box
    if (askWhere.delete(item.getURLChain()[0])) item.setSaveDialogOptions({ defaultPath: target });
    else item.setSavePath(freePath(target));
    const update = (state: Download['state']) => {
      // Save path is empty until the save box is answered
      send('download', { id, name: path.basename(item.getSavePath() || item.getFilename()), path: item.getSavePath(), received: item.getReceivedBytes(), total: item.getTotalBytes(), state });
      taskbar();
    };
    item.on('updated', (_e, state) => update(state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'));
    item.once('done', (_e, state) => update(state));
    update('progressing');
  });
}

export function saveAs(contents: WebContents, url: string) {
  askWhere.add(url);
  contents.downloadURL(url);
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

ipcMain.on('download', (_e, id: number, action: 'pause' | 'resume' | 'cancel') => {
  const item = items.get(id);
  if (!item) return;
  if (action === 'pause') item.pause();
  else if (action === 'cancel') item.cancel();
  // Interrupted (network dropped…) and the server can't continue it → download it again from the start
  else if (item.canResume()) item.resume();
  else sessions.get(id)?.downloadURL(item.getURL());
});
ipcMain.on('open-file', (_e, p: string) => shell.openPath(p));
ipcMain.on('downloads-folder', () => shell.openPath(app.getPath('downloads')));
