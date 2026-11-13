import { app, clipboard, dialog, ipcMain, Menu, safeStorage, type MenuItemConstructorOptions, type Session, type WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import { win } from './window';

// Saved passwords, like Chrome. The page side lives in preload/page.ts.
// Each password is encrypted with safeStorage (Windows DPAPI): only this Windows account can read it back
interface Login { origin: string; username: string; password: string; t: number } // password = encrypted, base64 · t = last used
const file = () => path.join(app.getPath('userData'), 'passwords.json');
let data: { logins: Login[]; never: string[] } = { logins: [], never: [] };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify(data)); } catch {} };
const enc = async (s: string) => (await safeStorage.encryptStringAsync(s)).toString('base64');
const dec = async (s: string) => (await safeStorage.decryptStringAsync(Buffer.from(s, 'base64'))).result;
const site = (origin: string) => origin.replace(/^[a-z]+:\/\//, '');
const NO_NAME = '(không có tên đăng nhập)';

// Sign-in just sent by a tab → asked about once that tab navigates (a failed sign-in usually stays on the page)
const pending = new Map<number, { origin: string; username: string; password: string }>();

export function passwords(ses: Session) {
  try { data = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch {}
  ses.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, '../preload/page.js') });
}

export function askToSave(contents: WebContents) {
  const ask = () => {
    const p = pending.get(contents.id);
    pending.delete(contents.id);
    if (p) prompt(p);
  };
  contents.on('did-navigate', ask);
  contents.on('did-navigate-in-page', (_e, _url, isMainFrame) => { if (isMainFrame) ask(); });
  contents.once('destroyed', () => pending.delete(contents.id));
}

async function prompt({ origin, username, password }: { origin: string; username: string; password: string }) {
  const old = data.logins.find((l) => l.origin === origin && l.username === username);
  if (old && await dec(old.password) === password) return;
  const who = `${site(origin)} (${username || NO_NAME})`;
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Dock Web',
    message: old ? `Cập nhật mật khẩu đã lưu cho ${who}?` : `Lưu mật khẩu cho ${who}?`,
    buttons: old ? ['Cập nhật', 'Không'] : ['Lưu', 'Không lưu', 'Không bao giờ với trang này'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response === 1) return;
  if (response === 2) data.never.push(origin);
  else if (old) { old.password = await enc(password); old.t = Date.now(); }
  else data.logins.push({ origin, username, password: await enc(password), t: Date.now() });
  save();
}

// The site comes from the frame that sent the message, never from what the page says
ipcMain.on('pw-sent', (e, username: string, password: string) => {
  const origin = e.senderFrame?.origin;
  if (origin && !data.never.includes(origin)) pending.set(e.sender.id, { origin, username, password });
});

// Click in a sign-in box → menu of this site's saved accounts at the cursor; the chosen one is sent back to that frame only
ipcMain.on('pw-pick', (e) => {
  const frame = e.senderFrame;
  const list = data.logins.filter((l) => l.origin === frame?.origin).sort((a, b) => b.t - a.t);
  if (!frame || !list.length) return;
  Menu.buildFromTemplate(list.map((l) => ({
    label: l.username || NO_NAME,
    click: async () => {
      l.t = Date.now();
      save();
      const password = await dec(l.password);
      if (!frame.isDestroyed()) frame.send('pw-fill', l.username, password);
    },
  }))).popup({ window: win });
});

// ⋯ → "Mật khẩu đã lưu": every account with copy / delete, then the sites set to never save
ipcMain.on('passwords', () => {
  const items: MenuItemConstructorOptions[] = [...data.logins]
    .sort((a, b) => site(a.origin).localeCompare(site(b.origin)))
    .map((l) => ({
      label: `${site(l.origin)} · ${l.username || NO_NAME}`,
      submenu: [
        { label: 'Sao chép tên đăng nhập', enabled: !!l.username, click: () => clipboard.writeText(l.username) },
        { label: 'Sao chép mật khẩu', click: async () => clipboard.writeText(await dec(l.password)) },
        { type: 'separator' },
        { label: 'Xoá', click: () => { data.logins = data.logins.filter((x) => x !== l); save(); } },
      ],
    }));
  if (!items.length) items.push({ label: 'Chưa lưu mật khẩu nào', enabled: false });
  if (data.never.length) items.push({ type: 'separator' }, {
    label: 'Không bao giờ lưu',
    submenu: data.never.map((o) => ({ label: `${site(o)} · bấm để bỏ`, click: () => { data.never = data.never.filter((x) => x !== o); save(); } })),
  });
  Menu.buildFromTemplate(items).popup({ window: win });
});
