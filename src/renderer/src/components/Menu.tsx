import { Fragment, isValidElement, useEffect, useLayoutEffect, useRef } from 'react';
import { hideMenu, menu } from '../browser';
import { Fav, Icon } from './Icon';

// Shared popup menu: ⋯, », tab right-click, bookmark right-click
export function Menu() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!menu) return;
    const el = ref.current!;
    const left = menu.alignRight ? menu.x - el.offsetWidth : menu.x;
    el.style.left = Math.max(0, Math.min(left, innerWidth - el.offsetWidth - 4)) + 'px';
    el.style.top = Math.max(0, Math.min(menu.y, innerHeight - el.offsetHeight - 4)) + 'px';
  }, [menu]);
  useEffect(() => {
    // Not on a menu button (.mbtn): otherwise mousedown hides the menu and the click right after opens it again → 2nd click could never close it
    const down = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!ref.current!.contains(t) && !t.closest('.mbtn')) hideMenu();
    };
    window.addEventListener('mousedown', down);
    window.addEventListener('blur', hideMenu);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('blur', hideMenu);
    };
  }, []);
  return (
    <div id="menu" ref={ref} className={menu ? 'on' : ''}>
      {menu?.items.map((it, i) => {
        if (isValidElement(it)) return <Fragment key={i}>{it}</Fragment>;
        if (it === '-') return <hr key={i} />;
        return (
          <div
            key={i}
            className={'mi' + (it.on ? ' on' : '')}
            title={it.tip}
            onClick={() => { hideMenu(); it.run(); }}
            onAuxClick={(e) => { if (it.aux && e.button === 1) { hideMenu(); it.aux(); } }}
          >
            {'fav' in it ? <Fav src={it.fav} /> : <i>{it.icon && <Icon name={it.icon} />}</i>}
            <span>{it.label}</span>
            {it.on && <Icon name="check" className="chk" />}
            <small>{it.hint}</small>
          </div>
        );
      })}
    </div>
  );
}
