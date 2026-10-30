import { useLayoutEffect, useRef } from 'react';
import { active, back, forget, forward, go, hideSug, marks, pip, reload, setUrlIn, suggest, sugIn, sugItems, sugSel, toggleStar, urlIn, urlKey, zoom, zooms } from '../browser';
import { hostOf, pretty } from '../url';
import { Icon } from './Icon';

// Row 2: ← → ⟳ + address bar
export function NavBar() {
  const z = active ? zooms[hostOf(active.url)] || 1 : 1;
  const starred = !!active && marks.some((m) => m.url === active!.url);
  return (
    <div id="nav">
      <button id="back" title="Lùi (Alt+←)" disabled={!active?.canBack} onClick={back}><Icon name="back" /></button>
      <button id="fwd" title="Tới (Alt+→)" disabled={!active?.canFwd} onClick={forward}><Icon name="forward" /></button>
      <button id="reload" title="Tải lại (F5)" onClick={reload}><Icon name="reload" /></button>
      <div className="omni">
        <input
          id="url"
          ref={setUrlIn}
          placeholder="Tìm trên Google hoặc nhập URL…"
          spellCheck={false}
          // First click in the address bar selects everything like Chrome → typing replaces the old URL
          onMouseDown={(e) => {
            if (document.activeElement === urlIn) return;
            e.preventDefault();
            urlIn.focus();
            urlIn.select();
          }}
          onInput={suggest}
          onBlur={hideSug}
          onKeyDown={urlKey}
        />
        <button id="zoom" hidden={z === 1} title="Đưa về 100% (Ctrl+0)" onClick={() => zoom(0)}>{Math.round(z * 100)}%</button>
        <button id="pip" hidden={!active?.media} title="Ghim video ra góc màn hình (bấm lần nữa để bỏ ghim)" onClick={pip}><Icon name="pip" /></button>
        <button id="star" className={starred ? 'on' : ''} title={(starred ? 'Bỏ khỏi thanh dấu trang' : 'Lưu vào thanh dấu trang') + ' (Ctrl+D)'} onClick={toggleStar}>
          <Icon name="star" />
        </button>
      </div>
    </div>
  );
}

const SUG_ICON = { search: 'search', google: 'search', url: 'globe', hist: 'history' };

// Suggestions under the box being typed in (address bar or home page search): typed text, history, Google search suggestions
export function Suggestions() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!sugItems.length) return;
    const r = sugIn.parentElement!.getBoundingClientRect(), s = ref.current!.style;
    s.left = r.left + 'px';
    s.top = r.bottom + 2 + 'px';
    s.width = Math.min(r.width, innerWidth - r.left - 6) + 'px';
    s.maxHeight = innerHeight - r.bottom - 10 + 'px';
    ref.current!.children[sugSel]?.scrollIntoView({ block: 'nearest' });
  });
  return (
    <div id="sug" ref={ref} className={sugItems.length ? 'on' : ''}>
      {sugItems.map((it, i) => {
        const [ti, u] = it.kind === 'hist' ? [it.h!.title || pretty(it.url), it.h!.title ? pretty(it.url) : '']
          : it.kind === 'search' ? [it.text, '— Tìm trên Google']
          : it.kind === 'url' ? [pretty(it.url), '— Mở trang']
          : [it.text, ''];
        return (
          // mousedown + preventDefault so the URL box doesn't lose focus before the click completes
          <div key={i} className={i === sugSel ? 'sel' : ''} title={it.url} onMouseDown={(e) => { e.preventDefault(); go(it.url); }}>
            <i><Icon name={SUG_ICON[it.kind]} /></i>
            <span className="ti">{ti}</span>
            <span className="u">{u}</span>
            {it.kind === 'hist' && (
              <b title="Xoá khỏi lịch sử" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); forget(it.h!); }}><Icon name="x" /></b>
            )}
          </div>
        );
      })}
    </div>
  );
}
