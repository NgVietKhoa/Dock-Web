import type { Input, WebContents } from 'electron';
import type { KeyAction } from '../shared/ipc';
import { send } from './window';

// Shortcuts: caught in main because while focus is inside a page, the webview swallows all keys
function keyAction(i: Input): KeyAction | null {
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
  if (c && /^[1-9]$/.test(k)) return `tab${+k}`;
  if (c && k === 'd') return 'bookmark';
  if (c && k === 'f') return 'find';
  if (c && (k === '=' || k === '+')) return 'zoomIn';
  if (c && k === '-') return 'zoomOut';
  if (c && k === '0') return 'zoomReset';
  if (c && k === 'p') return 'print';
  if (k === 'F12' || (c && i.shift && k === 'i')) return 'devtools';
  return null;
}
export function hookKeys(contents: WebContents) {
  contents.on('before-input-event', (e, input) => {
    const a = keyAction(input);
    if (a) { e.preventDefault(); send('key', a); }
  });
  // Mouse side buttons (Back/Forward) → same as Alt+← / Alt+→ ('app-command' doesn't fire over a webview).
  // Electron's typings only list left/middle/right, but back/forward do arrive
  contents.on('before-mouse-event', (_e, m) => {
    const button = m.button as string;
    if (m.type === 'mouseUp' && (button === 'back' || button === 'forward')) send('key', button);
  });
}
