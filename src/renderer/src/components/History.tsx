import { Fragment, useState } from 'react';
import { forget, go, hist, openTab, toggleHistory } from '../browser';
import { hostOf, pretty } from '../url';
import { Fav, Icon } from './Icon';

const DAY = 864e5;
function dayLabel(t: number) {
  const d = new Date(t);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Ctrl+H: visited pages, newest first, grouped by day. History keeps only the last visit of each URL → one row per page
export function History() {
  const [q, setQ] = useState('');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = hist
    .filter((h) => words.every((w) => (pretty(h.url) + ' ' + h.title).toLowerCase().includes(w)))
    .sort((a, b) => b.t - a.t);
  let day = '';
  return (
    <div id="hist" onKeyDown={(e) => { if (e.key === 'Escape') toggleHistory(); }}>
      <div className="hhead">
        <b>Lịch sử</b>
        <label className="hsearch">
          <Icon name="search" />
          <input autoFocus placeholder="Tìm trong lịch sử" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button title="Đóng (Esc)" onClick={toggleHistory}><Icon name="x" /></button>
      </div>
      <div className="hlist">
        {list.map((h) => {
          const d = dayLabel(h.t), head = d !== day;
          day = d;
          return (
            <Fragment key={h.url}>
              {head && <h4>{d}</h4>}
              <div className="hrow" title={h.url} onClick={() => go(h.url)} onAuxClick={(e) => { if (e.button === 1) openTab(h.url); }}>
                <small>{new Date(h.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
                <Fav className="fav" src={h.icon} />
                <span>{h.title || pretty(h.url)}</span>
                <span className="u">{hostOf(h.url)}</span>
                <b title="Xoá khỏi lịch sử" onClick={(e) => { e.stopPropagation(); forget(h); }}><Icon name="x" /></b>
              </div>
            </Fragment>
          );
        })}
        {!list.length && <p className="empty">{q ? 'Không tìm thấy trang nào' : 'Chưa có lịch sử duyệt web'}</p>}
      </div>
    </div>
  );
}
