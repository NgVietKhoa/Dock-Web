import type { WebviewTag } from 'electron';
import type { DragEvent, KeyboardEvent, ReactElement } from 'react';
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { Bookmark, DockState, HistoryEntry, KeyAction, Saved } from '../../shared/ipc';
import { hostOf, norm, pretty, SEARCH } from './url';

// All UI state lives in this module; components read it directly and re-render on emit().
// flushSync: the DOM is up to date as soon as an action returns (focus(), measuring… right after work as before)
let version = 0;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export const useBrowser = () => useSyncExternalStore(subscribe, () => version);
export function emit() {
  version++;
  flushSync(() => listeners.forEach((f) => f()));
}

export interface Tab {
  id: number;
  url: string; // '' = blank "New tab"
  wv: WebviewTag;
  title?: string;
  icon?: string;
  lazy: boolean; // restored tab whose page isn't loaded until clicked
  ready?: boolean; // dom-ready fired → webview methods can be called
  wcId?: number;
  media?: boolean;
  audible?: boolean;
  muted?: boolean;
}
export interface SugItem { kind: 'search' | 'url' | 'hist' | 'google'; text?: string; url: string; h?: HistoryEntry }
// '-' = separator · ReactElement = custom row · fav = favicon URL (instead of icon) · aux = middle-click
export type MenuItem = { label: string; icon?: string; fav?: string; tip?: string; hint?: string; on?: boolean; run: () => void; aux?: () => void } | '-' | ReactElement;

export let tabs: Tab[] = [], active: Tab | null = null;
let closed: string[] = [];
export let hist: HistoryEntry[] = [];
export let marks: Bookmark[] = [];
export let zooms: Record<string, number> = {};
let hiddenSites: string[] = [];
export let state: Partial<DockState> = {};
export let update = ''; // version downloaded by the auto-updater
export let sugItems: SugItem[] = [], sugSel = -1;
export const find = { open: false, n: '' };
export let menu: { items: MenuItem[]; x: number; y: number; alignRight: boolean; owner: string } | null = null;
export let moving: { kind: string; item: unknown } | null = null; // internal drag (tab/bookmark) in progress

// Webviews are created here and never touched by React: moving a webview in the DOM reloads its page
export const views = document.createElement('div');
views.className = 'wvs';
// Inputs the actions focus/fill directly (uncontrolled), set by their components
export let urlIn: HTMLInputElement, findIn: HTMLInputElement;
export const setUrlIn = (el: HTMLInputElement | null) => { if (el) urlIn = el; };
export const setFindIn = (el: HTMLInputElement | null) => { if (el) findIn = el; };

const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

// Batch writes to main's store to at most once per 0.5s: sites like TikTok/YouTube change the URL constantly while scrolling,
// and writing directly would serialize the whole history (~1000 entries) on every change. Values are read at flush time → always latest
const pending = new Map<keyof Saved, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function store<K extends keyof Saved>(k: K, v: Saved[K]) {
  pending.set(k, v);
  flushTimer ??= setTimeout(flush, 500);
}
function flush() {
  if (pending.size) dock.storeSet(Object.fromEntries(pending));
  pending.clear();
  flushTimer = null;
}

export function save() {
  const kept = tabs.filter((t) => t.url); // new tabs that never loaded a page don't need to be remembered
  store('tabs', kept.map((t) => t.url));
  store('active', active ? kept.indexOf(active) : -1);
}

function visit(url: string) {
  if (!/^(https?|file):/i.test(url)) return;
  const h = hist.find((x) => x.url === url);
  if (h) { h.n++; h.t = Date.now(); }
  else hist.push({ url, title: '', n: 1, t: Date.now() });
  if (hist.length > 1000) hist = hist.sort((a, b) => b.t - a.t).slice(0, 800);
  store('history', hist);
}
// Title / favicon of a visited page
function visitSet(url: string, key: 'title' | 'icon', value: string) {
  const h = hist.find((x) => x.url === url);
  if (h && h[key] !== value) { h[key] = value; store('history', hist); }
}
export function forget(h: HistoryEntry) {
  hist = hist.filter((x) => x !== h);
  store('history', hist);
  suggest();
}
export function clearHistory() {
  if (confirm('Xoá toàn bộ lịch sử duyệt web?')) { hist = []; store('history', hist); emit(); }
}

// Home page tiles: most visited sites. Grouped by host, otherwise single YouTube/TikTok videos would fill every tile
export function topSites() {
  const sites = new Map<string, { host: string; url: string; title: string; icon?: string; n: number }>();
  for (const h of hist) {
    if (!/^https?:/i.test(h.url)) continue;
    const u = new URL(h.url);
    if (hiddenSites.includes(u.hostname)) continue;
    let s = sites.get(u.hostname);
    if (!s) sites.set(u.hostname, (s = { host: u.hostname, url: u.origin + '/', title: u.hostname.replace(/^www\./, ''), n: 0 }));
    s.n += h.n;
    if (u.pathname === '/' && h.title) s.title = h.title; // the site's home page title names it best ("YouTube", "Facebook")
    s.icon ||= h.icon;
  }
  return [...sites.values()].sort((a, b) => b.n - a.n).slice(0, 8);
}
// Like Chrome's "Remove": only hides the tile, history is kept
export function hideSite(host: string) {
  hiddenSites.push(host);
  store('hiddenSites', hiddenSites);
  emit();
}

// ---------- Tab ----------
// Empty raw = blank "New tab" like Chrome: the webview has no src yet; typing an address opens it in this tab.
// lazy = don't load the page until the tab is clicked (restoring old tabs on launch)
let nextId = 1;
export function openTab(raw?: string, focus = true, lazy = false) {
  const url = raw ? norm(raw) : '';
  if (url === null) return;
  const wv = document.createElement('webview') as WebviewTag;
  if (url && !lazy) wv.setAttribute('src', url);
  wv.setAttribute('partition', 'persist:dock'); // keep logins/cookies
  wv.setAttribute('allowpopups', '');
  const h = url ? hist.find((x) => x.url === url) : undefined; // unloaded tabs take their old title/icon from history
  const t: Tab = { id: nextId++, url, wv, title: h?.title, icon: h?.icon, lazy: lazy && !!url };
  wv.addEventListener('dom-ready', () => { t.ready = true; t.wcId = wv.getWebContentsId(); applyZoom(t); emit(); });
  wv.addEventListener('page-title-updated', (e) => { t.title = e.title; visitSet(t.url, 'title', e.title); emit(); });
  wv.addEventListener('page-favicon-updated', (e) => {
    t.icon = e.favicons[0];
    if (t.icon && !t.icon.startsWith('data:')) visitSet(t.url, 'icon', t.icon); // data: icons can be large → not kept in history
    // Bookmark saved before the page had an icon → fill it in
    const m = marks.find((x) => x.url === t.url && !x.icon);
    if (m && t.icon) { m.icon = t.icon; store('marks', marks); }
    emit();
  });
  wv.addEventListener('found-in-page', (e) => {
    if (t !== active) return;
    find.n = `${e.result.activeMatchOrdinal ?? 0}/${e.result.matches}`;
    emit();
    if (find.open) findIn.focus(); // pages tend to grab focus after a find → give it back to the find box
  });
  const nav = (e: { url: string }) => {
    const sameHost = hostOf(e.url) === hostOf(t.url);
    t.url = e.url;
    if (active === t) {
      // Don't overwrite the address bar while the user is typing (the page may redirect/change URL meanwhile)
      if (document.activeElement !== urlIn) urlIn.value = e.url;
      wv.classList.add('on');
    }
    if (!sameHost) { applyZoom(t); t.icon = ''; } // zoom is remembered per host → only reapply when the host changes; the new site sends its own favicon
    visit(e.url);
    save();
    emit();
  };
  // Pin video button only shows on pages that have played media (a new page starts without it)
  wv.addEventListener('media-started-playing', () => { t.media = true; emit(); });
  wv.addEventListener('did-navigate', (e) => { t.media = false; nav(e); });
  wv.addEventListener('did-navigate-in-page', (e) => e.isMainFrame && nav(e));
  views.appendChild(wv);
  tabs.push(t);
  if (focus) select(t);
  save();
  emit();
  return t;
}

export function newTab() {
  openTab();
  urlIn.focus();
}

// Like Chrome: after switching tabs, Enter in the address bar, ← → ⟳… keys (↑ ↓ Space PgDn) go to the page
export function focusPage() { if (active?.url) active.wv.focus(); }

export function select(t: Tab) {
  if (active !== t) closeFind();
  active = t;
  if (t.lazy) { t.lazy = false; t.wv.setAttribute('src', t.url); }
  tabs.forEach((x) => x.wv.classList.toggle('on', x === t && !!x.url));
  urlIn.value = t.url;
  emit();
  focusPage();
  save();
}

export function close(t: Tab) {
  if (active === t) closeFind();
  if (t.url) closed.push(t.url);
  if (closed.length > 20) closed.shift();
  const i = tabs.indexOf(t);
  t.wv.remove();
  tabs.splice(i, 1);
  if (active === t) { active = null; if (tabs.length) select(tabs[Math.max(0, i - 1)]); }
  if (!tabs.length) urlIn.value = '';
  save();
  emit();
}

function cycle(d: number) {
  if (tabs.length) select(tabs[(tabs.indexOf(active!) + d + tabs.length) % tabs.length]);
}

export function mute(t: Tab) {
  if (!t.ready) return;
  t.muted = !t.muted;
  t.wv.setAudioMuted(t.muted);
  emit();
}

export const back = () => { if (active?.ready && active.wv.canGoBack()) active.wv.goBack(); focusPage(); };
export const forward = () => { if (active?.ready && active.wv.canGoForward()) active.wv.goForward(); focusPage(); };
export const reload = () => { if (active?.ready) active.wv.reload(); focusPage(); };

// ---------- Address bar (like Chrome) ----------
export function go(raw: string) {
  const u = norm(raw);
  if (!u) return;
  urlIn.value = u;
  urlIn.blur(); // like Chrome: leave the address bar after Enter (hides suggestions) → the final URL after redirects is shown
  if (!active) openTab(u);
  else if (!active.ready) active.wv.setAttribute('src', u); // blank "New tab" that hasn't loaded anything yet
  else active.wv.loadURL(u);
  active?.wv.focus(); // not focusPage(): a blank tab only gets its url on did-navigate
}

// Suggestions only show while typing: first row = the exact typed text (Enter opens it),
// then pages from history, then Google search suggestions
let sugTimer: ReturnType<typeof setTimeout> | undefined;
export function suggest() {
  const raw = urlIn.value.trim(), q = raw.toLowerCase();
  clearTimeout(sugTimer);
  if (!raw) return hideSug();
  const words = q.split(/\s+/).filter(Boolean);
  // decode each URL once (previously done inside the sort comparator → thousands of times per keystroke)
  const hits: { h: HistoryEntry; pre: number }[] = [];
  for (const h of hist) {
    const u = pretty(h.url).toLowerCase();
    const s = u + ' ' + h.title.toLowerCase();
    if (words.every((w) => s.includes(w))) hits.push({ h, pre: u.startsWith(q) ? 1 : 0 });
  }
  hits.sort((a, b) => (b.pre - a.pre) || (b.h.n - a.h.n) || (b.h.t - a.h.t));
  const url = norm(raw)!;
  sugItems = [
    { kind: url.startsWith(SEARCH) ? 'search' : 'url', text: raw, url },
    ...hits.slice(0, 5).map(({ h }) => ({ kind: 'hist' as const, h, url: h.url })),
  ];
  sugSel = 0;
  emit();

  sugTimer = setTimeout(async () => {
    const list = await dock.suggest(raw);
    if (urlIn.value.trim() !== raw || document.activeElement !== urlIn) return; // user kept typing → drop stale results
    sugItems = sugItems.filter((x) => x.kind !== 'google').concat(
      list.filter((s) => s.toLowerCase() !== q).slice(0, 5).map((s) => ({ kind: 'google' as const, text: s, url: SEARCH + encodeURIComponent(s) })));
    emit();
  }, 150);
}
export function hideSug() {
  sugItems = [];
  sugSel = -1;
  emit();
}

export function urlKey(e: KeyboardEvent) {
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugItems.length) {
    e.preventDefault();
    const n = sugItems.length;
    sugSel = e.key === 'ArrowDown' ? (sugSel + 1) % n : (sugSel - 1 + n) % n;
    emit();
  } else if (e.key === 'Escape') {
    // Like Chrome: 1st Esc drops what was typed, 2nd Esc goes back to the page
    const cur = active?.url || '';
    hideSug();
    if (urlIn.value !== cur) { urlIn.value = cur; urlIn.select(); } else focusPage();
  } else if (e.key === 'Enter') go(sugSel >= 0 ? sugItems[sugSel].url : urlIn.value);
}

// ---------- Zoom: remembered per host, like Chrome ----------
function applyZoom(t: Tab) {
  if (t.ready) t.wv.setZoomFactor(zooms[hostOf(t.url)] || 1);
}
export function zoom(dir: number) {
  if (!active?.url) return;
  const h = hostOf(active.url), cur = zooms[h] || 1;
  const next = dir === 0 ? 1
    : dir > 0 ? ZOOMS.find((z) => z > cur + 0.001) ?? ZOOMS.at(-1)!
    : ZOOMS.findLast((z) => z < cur - 0.001) ?? ZOOMS[0];
  if (next === 1) delete zooms[h]; else zooms[h] = next;
  store('zoom', zooms);
  tabs.forEach((t) => hostOf(t.url) === h && applyZoom(t));
  emit();
}

export function pip() { if (active?.ready) dock.pip(active.wcId!); }

// ---------- Find in page ----------
export function openFind() {
  if (!active) return;
  find.open = true;
  emit();
  findIn.focus();
  findIn.select();
  if (findIn.value) runFind(true, true);
}
export function closeFind() {
  if (!find.open) return;
  find.open = false;
  find.n = '';
  // Only the active tab can have a find in progress (switching tabs closes the find bar first)
  if (active?.ready) active.wv.stopFindInPage('clearSelection');
  emit();
}
// fresh = true: start a new search (query changed); false: jump to the next match
export function runFind(forward = true, fresh = false) {
  if (!active?.ready) return;
  if (!findIn.value) { active.wv.stopFindInPage('clearSelection'); find.n = ''; emit(); return; }
  active.wv.findInPage(findIn.value, { forward, findNext: fresh });
}

// ---------- Bookmarks ----------
export function saveMarks() { store('marks', marks); emit(); }
export function toggleStar() {
  if (!active?.url) return;
  const i = marks.findIndex((m) => m.url === active!.url);
  if (i >= 0) marks.splice(i, 1);
  else marks.push({ url: active.url, title: active.title || '', icon: active.icon || '' });
  saveMarks();
}
export function removeMark(m: Bookmark) { marks = marks.filter((x) => x !== m); saveMarks(); }

// ---------- Drag to reorder tabs / bookmarks ----------
// The `moving` flag keeps the "drop to open tab" overlay from appearing during internal drags
export function sortable<T>(kind: string, item: T, list: () => T[], done: () => void) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => { moving = { kind, item }; e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: () => { moving = null; },
    onDragOver: (e: DragEvent) => { if (moving?.kind === kind) { e.preventDefault(); e.stopPropagation(); } },
    onDrop: (e: DragEvent) => {
      if (moving?.kind !== kind) return;
      e.preventDefault(); e.stopPropagation();
      const arr = list(), from = arr.indexOf(moving.item as T), to = arr.indexOf(item);
      if (from < 0 || to < 0 || from === to) return;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      done();
      emit();
    },
  };
}

// ---------- Popup menu: ⋯, », tab right-click, bookmark right-click ----------
export function popMenu(items: MenuItem[], x: number, y: number, alignRight = false, owner = '') {
  menu = { items, x, y, alignRight, owner };
  emit();
}
export function hideMenu() {
  if (!menu) return;
  menu = null;
  emit();
}
// Button that opens a menu below itself (⋯, »): 2nd click closes it
export function toggleMenu(btn: HTMLElement, items: () => MenuItem[]) {
  if (menu?.owner === btn.id) return hideMenu();
  const r = btn.getBoundingClientRect();
  popMenu(items(), r.right, r.bottom + 2, true, btn.id);
}

// ---------- Messages from main ----------
// Registered at load, before the window's did-finish-load sends the first state
dock.onState((s) => {
  state = s;
  document.body.classList.toggle('ghost', s.ghost);
  emit();
});
dock.onOpenTab((url) => openTab(url));
dock.onUpdate((v) => { update = v; emit(); });
dock.onAudio((id, audible) => {
  const t = tabs.find((x) => x.wcId === id);
  if (t) { t.audible = audible; emit(); }
});

const keys: Partial<Record<KeyAction, () => void>> = {
  newTab,
  closeTab: () => active && close(active),
  reopen: () => { if (closed.length) openTab(closed.pop()); },
  focusUrl: () => { urlIn.focus(); urlIn.select(); },
  reload,
  hardReload: () => active?.ready && active.wv.reloadIgnoringCache(),
  back,
  forward,
  nextTab: () => cycle(1),
  prevTab: () => cycle(-1),
  bookmark: toggleStar,
  find: openFind,
  zoomIn: () => zoom(1),
  zoomOut: () => zoom(-1),
  zoomReset: () => zoom(0),
};
dock.onKey((a) => {
  const n = /^tab(\d)$/.exec(a);
  if (!n) return keys[a]?.();
  const t = n[1] === '9' ? tabs.at(-1) : tabs[+n[1] - 1]; // Ctrl+9 = last tab, like Chrome
  if (t) select(t);
});
window.addEventListener('beforeunload', flush);
window.addEventListener('resize', hideSug);

// Restore bookmarks + tabs from last session. Called once the UI is mounted (needs the address bar)
export async function restore() {
  let s = await dock.storeGet();
  // No store yet: up to 0.2.6 everything lived in localStorage → copy it over once (localStorage is left as is)
  if (!s) {
    s = {};
    for (const k of ['tabs', 'active', 'history', 'marks', 'zoom'] as const) {
      try { const v = JSON.parse(localStorage.getItem(k)!); if (v !== null) { s[k] = v; store(k, v); } } catch {}
    }
  }
  hist = s.history ?? [];
  marks = s.marks ?? [];
  zooms = s.zoom ?? {};
  hiddenSites = s.hiddenSites ?? [];
  // Zoom used to be keyed by host:port → re-key by hostname (see hostOf)
  for (const k of Object.keys(zooms)) {
    const h = hostOf('http://' + k);
    if (h !== k) { zooms[h] ??= zooms[k]; delete zooms[k]; store('zoom', zooms); }
  }
  // Only load the active tab's page; others load when clicked (each page = 1 process, loading all at once is heavy)
  (s.tabs ?? []).forEach((u) => openTab(u, false, true));
  if (tabs.length) select(tabs[s.active ?? 0] ?? tabs[0]);
  emit();
}
