import { useEffect, useRef, useState, type DragEvent } from 'react';
import { active, moving, openTab, restore, useBrowser, views } from './browser';
import { Bookmarks } from './components/Bookmarks';
import { FindBar } from './components/FindBar';
import { Home } from './components/Home';
import { Icon } from './components/Icon';
import { Menu } from './components/Menu';
import { NavBar, Suggestions } from './components/NavBar';
import { TabBar } from './components/TabBar';

export function App() {
  useBrowser();
  const [overlay, setOverlay] = useState(false);
  const [shield, setShield] = useState(false);
  const resizing = useRef(false);

  useEffect(() => {
    restore();
    // Drag & drop links / URLs / files → when dragging into the window, an overlay covers the page to catch the drop
    const prevent = (e: Event) => e.preventDefault();
    const enter = (e: Event) => { e.preventDefault(); if (!moving) setOverlay(true); };
    const stop = () => { if (resizing.current) { resizing.current = false; setShield(false); dock.resizeEnd(); } };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    window.addEventListener('dragenter', enter);
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
  }, []);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOverlay(false);
    const d = e.dataTransfer;
    let u = (d.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
    if (!u) u = d.getData('text/plain');
    if (!u && d.files.length) {
      const p = dock.filePath(d.files[0]);
      if (p) u = 'file:///' + p.replace(/\\/g, '/').replace(/^\/+/, '');
    }
    if (u) openTab(u);
  };

  return (
    <>
      <div id="app">
        <TabBar />
        <NavBar />
        <Bookmarks />
        {/* The webviews' box is added once and never moved (that would reload every page) */}
        <div id="views" ref={(el) => { if (el && !views.isConnected) el.prepend(views); }}>
          {/* No tabs, or the active tab is a blank "New tab" */}
          {!active?.url && <Home />}
          <FindBar />
        </div>
      </div>
      {/* Drag the bottom-right corner to resize (in addition to dragging the window edges) */}
      <div
        id="corner"
        title="Kéo để đổi kích thước"
        onMouseDown={(e) => { e.preventDefault(); resizing.current = true; setShield(true); dock.resizeStart(); }}
      />
      <div
        id="overlay"
        className={overlay ? 'on' : ''}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(e) => { if (e.target === e.currentTarget) setOverlay(false); }}
        onDrop={drop}
      >
        Thả để mở tab
      </div>
      <div id="shield" className={shield ? 'on' : ''} />
      <Suggestions />
      <Menu />
      <div id="ghost"><Icon name="ghost" />Đang xuyên chuột · Ctrl+Alt+Space để tắt</div>
    </>
  );
}
