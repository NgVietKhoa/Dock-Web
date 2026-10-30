import { BrowserWindow, webContents } from 'electron';
import koffi from 'koffi';

// Pin video: Chromium's Picture-in-Picture window (floats in a screen corner, draggable). Clicking again unpins.
// Runs in every frame because movie sites often embed the player in an iframe; userGesture = true or Chromium refuses PiP
const PIP = `(async () => {
  if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return true; }
  const v = [...document.querySelectorAll('video')].filter(v => v.readyState && !v.disablePictureInPicture)
    .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
  if (!v) return false;
  await v.requestPictureInPicture();
  return true;
})()`;
export async function togglePip(id: number) {
  for (const f of webContents.fromId(id)?.mainFrame.framesInSubtree ?? []) {
    try { if (await f.executeJavaScript(PIP, true)) return true; } catch {}
  }
  return false;
}

// The PiP window is Chromium's own, not a BrowserWindow → Electron can't fade it; set its opacity through the Win32 API
const user32 = koffi.load('user32.dll');
const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(void *hwnd, intptr_t lp)');
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr_t lp)');
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32 *pid)');
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hwnd)');
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int index)');
const SetWindowLongPtrW = user32.func('intptr_t __stdcall SetWindowLongPtrW(void *hwnd, int index, intptr_t value)');
const SetLayeredWindowAttributes = user32.func('bool __stdcall SetLayeredWindowAttributes(void *hwnd, uint32 key, uint8 alpha, uint32 flags)');
const GWL_EXSTYLE = -20, WS_EX_LAYERED = 0x80000, LWA_ALPHA = 2;

// Visible windows of this process that aren't BrowserWindows = the PiP window (title is localized, so not matched by name)
export function fadePip(opacity: number) {
  const ours = BrowserWindow.getAllWindows().map((w) => w.getNativeWindowHandle().readBigUInt64LE());
  EnumWindows((h: unknown) => {
    const pid = [0];
    GetWindowThreadProcessId(h, pid);
    if (pid[0] === process.pid && IsWindowVisible(h) && !ours.includes(BigInt(koffi.address(h)))) {
      SetWindowLongPtrW(h, GWL_EXSTYLE, GetWindowLongPtrW(h, GWL_EXSTYLE) | WS_EX_LAYERED);
      SetLayeredWindowAttributes(h, 0, Math.round(opacity * 255), LWA_ALPHA);
    }
    return true;
  }, 0);
}
