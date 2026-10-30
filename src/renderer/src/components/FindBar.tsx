import { closeFind, find, focusPage, runFind, setFindIn } from '../browser';
import { Icon } from './Icon';

// Find-in-page bar (Ctrl+F)
export function FindBar() {
  const exit = () => { closeFind(); focusPage(); };
  return (
    <div id="find" className={find.open ? 'on' : ''}>
      <input
        id="findIn"
        ref={setFindIn}
        placeholder="Tìm trong trang"
        spellCheck={false}
        onInput={() => runFind(true, true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') runFind(!e.shiftKey);
          else if (e.key === 'Escape') exit();
        }}
      />
      <span id="findN">{find.n}</span>
      <button id="findUp" title="Kết quả trước (Shift+Enter)" onClick={() => runFind(false)}><Icon name="up" /></button>
      <button id="findDown" title="Kết quả sau (Enter)" onClick={() => runFind(true)}><Icon name="down" /></button>
      <button id="findX" title="Đóng (Esc)" onClick={exit}><Icon name="x" /></button>
    </div>
  );
}
