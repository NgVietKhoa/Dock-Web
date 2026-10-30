import { useEffect, useState } from 'react';
import { go, hideSite, openTab, topSites, urlIn } from '../browser';
import { Fav, Icon } from './Icon';

// One string → React skips re-rendering until the minute changes
const now = () => {
  const d = new Date();
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + '|' +
    d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Home page shown on a blank tab, like Chrome's new tab page: clock, search box, most visited sites
export function Home() {
  const [clock, setClock] = useState(now);
  const [time, date] = clock.split('|');
  useEffect(() => {
    const t = setInterval(() => setClock(now), 1000);
    return () => clearInterval(t);
  }, []);
  const sites = topSites();
  return (
    <div id="home">
      <div className="clock">
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>
      {/* Stand-in box like Chrome's: typing happens in the address bar, which already has suggestions and Enter/Esc */}
      <div className="hsearch" onMouseDown={(e) => { e.preventDefault(); urlIn.focus(); urlIn.select(); }}>
        <Icon name="search" />
        Tìm trên Google hoặc nhập URL
      </div>
      {sites.length > 0 && (
        // Up to 4 per row (2 rows, like Chrome); tiles shrink rather than wrap when the window is narrow
        <div className="sites" style={{ gridTemplateColumns: `repeat(${Math.min(4, sites.length)}, minmax(0, 92px))` }}>
          {sites.map((s) => (
            <div key={s.host} className="site" title={s.url} onClick={() => go(s.url)} onAuxClick={(e) => { if (e.button === 1) openTab(s.url); }}>
              {/* No favicon → first letter, like Chrome's tiles */}
              <Fav className="sico" src={s.icon} fallback={s.title[0].toUpperCase()} />
              <span>{s.title}</span>
              <b title="Ẩn khỏi trang chủ" onClick={(e) => { e.stopPropagation(); hideSite(s.host); }}><Icon name="x" /></b>
            </div>
          ))}
        </div>
      )}
      <div className="hint">
        Kéo link thả vào cửa sổ để mở · nắm chỗ trống trên thanh để di chuyển · kéo mép hoặc góc để đổi kích thước<br />
        Ctrl + Shift + Space: ẩn/hiện · Ctrl + Alt + Space: xuyên chuột
      </div>
    </div>
  );
}
