// Contract between main, preload and renderer: shared types for IPC payloads

export type Theme = 'system' | 'light' | 'dark';

export interface DockState {
  opacity: number;
  pinned: boolean;
  ghost: boolean;
  maximized: boolean;
  theme: Theme;
}

// Shortcuts caught in main and run by the renderer. tab1…tab9 = Ctrl+1…9
export type KeyAction =
  | 'reopen' | 'hardReload' | 'reload' | 'newTab' | 'closeTab' | 'focusUrl' | 'back' | 'forward'
  | 'prevTab' | 'nextTab' | 'bookmark' | 'find' | 'zoomIn' | 'zoomOut' | 'zoomReset' | `tab${number}`;

export interface HistoryEntry { url: string; title: string; icon?: string; n: number; t: number } // n = visit count, t = last visit
export interface Bookmark { url: string; title: string; icon: string }

// userData/store.json
export interface Saved {
  tabs?: string[];
  active?: number;
  history?: HistoryEntry[];
  marks?: Bookmark[];
  zoom?: Record<string, number>; // host → zoom factor
  hiddenSites?: string[]; // hosts removed from the home page's site tiles
}

// main → renderer messages: channel → arguments
export interface UiEvents {
  state: [DockState];
  key: [KeyAction];
  'open-tab': [url: string];
  update: [version: string];
  audio: [webContentsId: number, audible: boolean];
}
