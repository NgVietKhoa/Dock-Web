import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Bookmark } from '../../../shared/ipc';
import { go, marks, openTab, popMenu, removeMark, saveMarks, sortable, toggleMenu } from '../browser';
import { pretty } from '../url';
import { Fav, Icon } from './Icon';

// Bookmarks bar (like Chrome), shown only when there is at least 1 bookmark.
// ☆ saves the current page · click opens in the current tab · middle-click opens a new tab · right-click: menu · drag to reorder
export function Bookmarks() {
  const bar = useRef<HTMLDivElement>(null), more = useRef<HTMLButtonElement>(null);
  // Like Chrome: bookmarks that don't fit are hidden from the bar and listed under » instead.
  // Hidden flags are set on the DOM directly (React doesn't manage them) since they depend on measured widths
  const fit = () => {
    const el = bar.current!, btn = more.current!;
    const els = [...el.querySelectorAll<HTMLElement>('.mark')];
    els.forEach((x) => (x.hidden = false));
    btn.hidden = el.scrollWidth <= el.clientWidth;
    if (btn.hidden) return;
    // » still sits past the overflowing items here → measure from the bar's right edge instead
    const limit = el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight) - btn.offsetWidth - 2;
    const i = els.findIndex((x) => x.getBoundingClientRect().right > limit);
    if (i >= 0) els.slice(i).forEach((x) => (x.hidden = true));
  };
  // Re-measure only when what's shown changes (texts/order); window resizes are handled by the ResizeObserver
  useLayoutEffect(fit, [marks.map((m) => m.title || m.url).join('\n')]);
  useEffect(() => {
    const ro = new ResizeObserver(fit);
    ro.observe(bar.current!);
    return () => ro.disconnect();
  }, []);
  const overflow = () => marks.filter((_, i) => (bar.current!.children[i] as HTMLElement).hidden).map((m) => ({
    label: m.title || pretty(m.url), tip: m.url, fav: m.icon,
    run: () => go(m.url), aux: () => openTab(m.url),
  }));
  return (
    <div id="marks" ref={bar} className={marks.length ? 'on' : ''}>
      {marks.map((m) => <Mark key={m.url} m={m} />)}
      <button id="marksMore" ref={more} className="mbtn" title="Các dấu trang khác" onClick={(e) => toggleMenu(e.currentTarget, overflow)}>
        <Icon name="chevrons" />
      </button>
    </div>
  );
}

function Mark({ m }: { m: Bookmark }) {
  const [editing, setEditing] = useState(false);
  const span = useRef<HTMLSpanElement>(null);
  const open = useRef(false); // removing the focused span can fire blur → done() must run once
  useLayoutEffect(() => {
    if (!editing) return;
    span.current!.focus();
    getSelection()!.selectAllChildren(span.current!);
  }, [editing]);
  // Rename inline on the bar: Enter/click outside = save, Esc = cancel
  const rename = () => { open.current = true; setEditing(true); };
  const done = (ok: boolean) => {
    if (!open.current) return;
    open.current = false;
    if (ok) m.title = span.current!.textContent!.trim();
    setEditing(false);
    saveMarks();
  };
  const text = m.title || pretty(m.url);
  return (
    <div
      className="mark"
      title={(m.title ? m.title + '\n' : '') + m.url}
      onClick={() => go(m.url)}
      onAuxClick={(e) => { if (e.button === 1) openTab(m.url); }}
      onContextMenu={(e) => {
        e.preventDefault();
        popMenu([
          { label: 'Mở trong tab mới', icon: 'plus', run: () => openTab(m.url) },
          { label: 'Đổi tên', icon: 'pencil', run: rename },
          { label: 'Xoá', icon: 'trash', run: () => removeMark(m) },
        ], e.clientX, e.clientY);
      }}
      {...sortable('marks', m, () => marks, saveMarks)}
    >
      <Fav src={m.icon} />
      {/* New span per mode: the user edits the editable one's text directly, so React must not reuse it */}
      {editing ? (
        <span
          key="edit"
          ref={span}
          contentEditable
          suppressContentEditableWarning
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); done(e.key === 'Enter'); } }}
          onBlur={() => done(true)}
        >
          {text}
        </span>
      ) : <span key="view">{text}</span>}
    </div>
  );
}
