import { desktopCapturer, Menu, type DesktopCapturerSource, type MenuItemConstructorOptions, type Session } from 'electron';
import { win } from './window';

// Screen sharing (Meet, Zoom web…): Electron refuses every getDisplayMedia() until the app picks a source →
// menu of screens and windows at the cursor. On Windows an item's click runs before the menu's close callback,
// so closed without a click = cancelled
export function screenShare(ses: Session) {
  ses.setDisplayMediaRequestHandler(async (req, cb) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
    const screens = sources.filter((s) => s.id.startsWith('screen:'));
    let picked = false;
    const item = (s: DesktopCapturerSource, label: string): MenuItemConstructorOptions => ({
      label: label.replace(/&/g, '&&'), // & would underline the next letter in a Windows menu
      click: () => {
        picked = true;
        // System sound only comes with a whole screen: Windows can't capture a single window's audio
        cb(req.audioRequested && screens.includes(s) ? { video: s, audio: 'loopback' } : { video: s });
      },
    });
    Menu.buildFromTemplate([
      ...screens.map((s, i) => item(s, screens.length > 1 ? `Màn hình ${i + 1}` : 'Chia sẻ toàn bộ màn hình')),
      { type: 'separator' },
      ...sources.filter((s) => !screens.includes(s) && s.name).map((s) => item(s, s.name.length > 60 ? s.name.slice(0, 60) + '…' : s.name)),
    ]).popup({ window: win, callback: () => { if (!picked) cb(null); } });
  });
}
