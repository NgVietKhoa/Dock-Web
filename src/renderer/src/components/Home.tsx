import { useEffect, useState } from 'react';
import { go, hideSite, hideSug, openTab, showSites, suggest, topSites, urlKey } from '../browser';
import logo from '../../../../build/icon.ico'; // the app icon, same file as the installer's
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
  // Host just hidden → notice with "Hoàn tác" / "Khôi phục tất cả" for a few seconds, like Chrome
  const [undo, setUndo] = useState('');
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(''), 6000);
    return () => clearTimeout(t);
  }, [undo]);
  const sites = topSites();
  return (
    <div id="home">
      <div className="clock">
        <div className="brand"><img src={logo} alt="" /><span>Dock <b>Web</b></span></div>
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>
      {/* Same suggestions and keys as the address bar, shown under this box */}
      <label className="hsearch">
        <Icon name="search" />
        <input placeholder="Tìm trên Google hoặc nhập URL" spellCheck={false} onInput={suggest} onBlur={hideSug} onKeyDown={urlKey} />
      </label>
      {sites.length > 0 && (
        // Up to 4 per row (2 rows, like Chrome); tiles shrink rather than wrap when the window is narrow
        <div className="sites" style={{ gridTemplateColumns: `repeat(${Math.min(4, sites.length)}, minmax(0, 92px))` }}>
          {sites.map((s) => (
            <div key={s.host} className="site" title={s.url} onClick={() => go(s.url)} onAuxClick={(e) => { if (e.button === 1) openTab(s.url); }}>
              {/* No favicon → first letter, like Chrome's tiles */}
              <Fav className="sico" src={s.icon} fallback={s.title[0].toUpperCase()} />
              <span>{s.title}</span>
              <b title="Ẩn khỏi trang chủ" onClick={(e) => { e.stopPropagation(); hideSite(s.host); setUndo(s.host); }}><Icon name="x" /></b>
            </div>
          ))}
        </div>
      )}
      {undo ? (
        <div className="toast">
          Đã ẩn trang
          <button onClick={() => { showSites(undo); setUndo(''); }}>Hoàn tác</button>
          <button onClick={() => { showSites(); setUndo(''); }}>Khôi phục tất cả</button>
        </div>
      ) : (
        <div className="hint">
          Kéo link thả vào cửa sổ để mở · nắm chỗ trống trên thanh để di chuyển · kéo mép hoặc góc để đổi kích thước<br />
          Ctrl + Shift + Space: ẩn/hiện · Ctrl + Alt + Space: xuyên chuột
        </div>
      )}
    </div>
  );
}
