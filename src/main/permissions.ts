import { dialog, type Session } from 'electron';
import { cfg, saveCfg } from './store';
import { win } from './window';

// Electron grants every permission without asking → ask like Chrome for these, and remember the answer per site.
// media is split into camera / micro so allowing the micro doesn't also allow the camera
const ASK: Record<string, string> = {
  video: 'dùng camera',
  audio: 'dùng micro',
  geolocation: 'biết vị trí của bạn',
  notifications: 'gửi thông báo',
  'clipboard-read': 'đọc nội dung đã sao chép',
  midi: 'dùng thiết bị MIDI',
  midiSysex: 'dùng thiết bị MIDI',
};
const asked = (permission: string, mediaTypes: string[] = []) =>
  (permission === 'media' ? mediaTypes : [permission]).filter((p) => p in ASK);
const originOf = (url: string) => { try { return new URL(url).origin; } catch { return url; } };

export function askPermissions(ses: Session) {
  ses.setPermissionRequestHandler(async (_wc, permission, cb, d) => {
    const origin = originOf(d.requestingUrl);
    const perms = asked(permission, 'mediaTypes' in d ? d.mediaTypes : []).filter((p) => cfg.perms[`${origin} ${p}`] !== true);
    if (!perms.length) return cb(true);
    if (perms.some((p) => cfg.perms[`${origin} ${p}`] === false)) return cb(false);
    const { response, checkboxChecked } = await dialog.showMessageBox(win, {
      type: 'question',
      title: 'Dock Web',
      message: `${origin.replace(/^[a-z]+:\/\//, '')} muốn ${[...new Set(perms.map((p) => ASK[p]))].join(' và ')}`,
      buttons: ['Cho phép', 'Chặn'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      checkboxLabel: 'Nhớ lựa chọn cho trang này',
      checkboxChecked: true,
    });
    if (checkboxChecked) {
      perms.forEach((p) => { cfg.perms[`${origin} ${p}`] = response === 0; });
      saveCfg();
    }
    cb(response === 0);
  });
  // Checks never block a request (camera/micro/location still go through the handler above) — except notifications:
  // a page that sees "granted" shows them without ever asking → undecided counts as not allowed
  ses.setPermissionCheckHandler((_wc, permission, origin, d) =>
    asked(permission, [d.mediaType ?? '']).every((p) => cfg.perms[`${originOf(origin)} ${p}`] ?? p !== 'notifications'));
}
