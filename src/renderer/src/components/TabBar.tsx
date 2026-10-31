import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import type { GlobalKeys, Theme } from '../../../shared/ipc';
import { active, clearData, clearHistory, close, mute, newTab, popMenu, save, select, sortable, state, tabs, toggleMenu, update, useBrowser, type MenuItem, type Tab } from '../browser';
import { pretty } from '../url';
import { Fav, Icon } from './Icon';

// Row 1 (like Chrome): tabs + window buttons. Empty space = handle for dragging the window
export function TabBar() {
  return (
    <div id="bar">
      <span id="grab" title="Nắm chỗ này (hoặc chỗ trống trên thanh) để kéo cửa sổ"><Icon name="grip" /></span>
      <div id="tabs">{tabs.map((t) => <TabItem key={t.id} t={t} />)}</div>
      <button id="add" title="Tab mới (Ctrl+T)" onClick={newTab}><Icon name="plus" /></button>
      <div className="win">
        <button id="update" className="on" hidden={!update} title={`Đã tải bản ${update} · bấm để khởi động lại và cập nhật`} onClick={() => dock.installUpdate()}>Cập nhật</button>
        <button id="pin" className={state.pinned ? 'on' : ''} title="Luôn nằm trên cùng" onClick={() => dock.pin()}><Icon name="pin" /></button>
        <button id="more" className="mbtn" title="Thêm" onClick={(e) => toggleMenu(e.currentTarget, moreMenu)}><Icon name="more" /></button>
        <button id="min" title="Thu nhỏ" onClick={() => dock.minimize()}><Icon name="minimize" /></button>
        <button id="max" title={(state.maximized ? 'Thu lại' : 'Phóng to') + ' (hoặc nhấp đúp thanh)'} onClick={() => dock.maximize()}>
          <Icon name={state.maximized ? 'restore' : 'maximize'} />
        </button>
        <button id="close" title={`Ẩn xuống khay (${state.keys?.toggle} để mở lại)`} onClick={() => dock.hide()}><Icon name="x" /></button>
      </div>
    </div>
  );
}

function TabItem({ t }: { t: Tab }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = t === active;
  // block defaults to 'start' → can shift the whole page a few px even with body overflow:hidden
  useLayoutEffect(() => { if (on) ref.current!.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [on]);
  const title = t.title || (t.url ? pretty(t.url) : 'Tab mới');
  return (
    <div
      ref={ref}
      className={'tab' + (on ? ' on' : '') + (t.audible ? ' audible' : '') + (t.muted ? ' muted' : '')}
      title={t.title || ''}
      onClick={() => select(t)}
      onAuxClick={(e) => { if (e.button === 1) close(t); }}
      onContextMenu={(e) => { e.preventDefault(); tabMenu(t, e); }}
      // Only reorder the tab buttons; webviews stay in place (moving a webview in the DOM reloads the page)
      {...sortable('tabs', t, () => tabs, save)}
    >
      {t.loading ? <i className="fav spin" /> : <Fav className="fav" src={t.icon} />}
      <span>{title}</span>
      <i className="snd" title={t.muted ? 'Bật tiếng tab' : 'Tắt tiếng tab'} onClick={(e) => { e.stopPropagation(); mute(t); }}>
        <Icon name={t.muted ? 'mute' : 'volume'} />
      </i>
      <b title="Đóng (Ctrl+W)" onClick={(e) => { e.stopPropagation(); close(t); }}><Icon name="x" /></b>
    </div>
  );
}

function tabMenu(t: Tab, e: MouseEvent) {
  popMenu([
    { label: 'Tải lại', icon: 'reload', hint: 'F5', run: () => t.ready && t.wv.reload() },
    { label: t.muted ? 'Bật tiếng tab' : 'Tắt tiếng tab', icon: t.muted ? 'volume' : 'mute', run: () => mute(t) },
    '-',
    { label: 'Đóng tab', icon: 'x', hint: 'Ctrl+W', run: () => close(t) },
  ], e.clientX, e.clientY);
}

function moreMenu(): MenuItem[] {
  const theme = (v: Theme, label: string, icon: string) => ({ label, icon, on: (state.theme ?? 'system') === v, run: () => dock.theme(v) });
  return [
    theme('system', 'Giao diện theo hệ thống', 'monitor'),
    theme('light', 'Giao diện sáng', 'sun'),
    theme('dark', 'Giao diện tối', 'moon'),
    '-',
    <label>
      Độ trong suốt{' '}
      <input type="range" min="0.3" max="1" step="0.05" defaultValue={state.opacity ?? 1}
        onInput={(e) => { state.opacity = parseFloat(e.currentTarget.value); dock.opacity(state.opacity); }} />
    </label>,
    { label: 'Xuyên chuột', icon: 'ghost', on: state.ghost, hint: state.keys?.ghost, run: () => dock.ghost() },
    '-',
    { label: 'Chặn quảng cáo', icon: 'shield', on: state.adblock, run: () => dock.adblock() },
    ...(state.autoStart === undefined ? [] : [{ label: 'Khởi động cùng Windows', icon: 'power', on: state.autoStart, run: () => dock.autoStart() }]),
    <label>Phím ẩn/hiện <KeyInput action="toggle" /></label>,
    <label>Phím xuyên chuột <KeyInput action="ghost" /></label>,
    '-',
    { label: 'Xoá lịch sử duyệt web', icon: 'trash', run: clearHistory },
    { label: 'Xoá cookie và dữ liệu trang web', icon: 'trash', run: clearData },
    { label: 'Thoát hẳn', icon: 'power', run: () => dock.quit() },
  ];
}

// Global shortcut box: focus it and press the new combo. Needs Ctrl or Alt so it can't fire while typing in another app
function KeyInput({ action }: { action: keyof GlobalKeys }) {
  useBrowser(); // menu rows are built when the menu opens → subscribe to show the new key while it stays open
  return (
    <input className="key" readOnly value={state.keys?.[action] ?? ''} title="Bấm vào rồi nhấn tổ hợp phím mới"
      onKeyDown={async (e) => {
        e.preventDefault();
        const box = e.currentTarget;
        if (e.key === 'Escape') return box.blur();
        if (/^(Control|Shift|Alt|Meta)/.test(e.code) || !(e.ctrlKey || e.altKey)) return;
        const key = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.code.replace(/^(Key|Digit|Arrow)/, '')].filter(Boolean).join('+');
        if (await dock.globalKey(action, key)) box.blur();
        else alert(`Không dùng được ${key}: app khác đang dùng hoặc phím không hỗ trợ.`);
      }} />
  );
}
