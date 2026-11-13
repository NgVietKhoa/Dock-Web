import { clipboard, Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { SEARCH } from '../renderer/src/url';
import { saveAs } from './downloads';
import { send, win } from './window';

// Right-click menu (Electron has none): only the items that fit the spot clicked, like Chrome
export function contextMenu(contents: WebContents) {
  // From an incognito tab → the new tab is incognito too
  const openTab = (url: string) => send('open-tab', url, !contents.session.isPersistent());
  contents.on('context-menu', (_e, p) => {
    const groups: MenuItemConstructorOptions[][] = [];
    // Word underlined by the Windows spellchecker → its suggestions first
    if (p.misspelledWord) groups.push([
      ...p.dictionarySuggestions.map((w) => ({ label: w, click: () => contents.replaceMisspelling(w) })),
      { label: 'Thêm vào từ điển', click: () => contents.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
    ]);
    if (p.linkURL) groups.push([
      { label: 'Mở link trong tab mới', click: () => openTab(p.linkURL) },
      { label: 'Lưu link thành…', click: () => saveAs(contents, p.linkURL) },
      { label: 'Sao chép địa chỉ link', click: () => clipboard.writeText(p.linkURL) },
    ]);
    if (p.mediaType === 'image') groups.push([
      { label: 'Mở ảnh trong tab mới', click: () => openTab(p.srcURL) },
      { label: 'Lưu ảnh', click: () => contents.downloadURL(p.srcURL) },
      { label: 'Lưu ảnh thành…', click: () => saveAs(contents, p.srcURL) },
      { label: 'Sao chép ảnh', click: () => contents.copyImageAt(p.x, p.y) },
      { label: 'Sao chép địa chỉ ảnh', click: () => clipboard.writeText(p.srcURL) },
    ]);
    // blob: videos (YouTube…) can't be opened or saved on their own
    if ((p.mediaType === 'video' || p.mediaType === 'audio') && /^https?:/.test(p.srcURL)) {
      const kind = p.mediaType === 'video' ? 'video' : 'âm thanh';
      groups.push([
        { label: `Mở ${kind} trong tab mới`, click: () => openTab(p.srcURL) },
        { label: `Lưu ${kind}`, click: () => contents.downloadURL(p.srcURL) },
        { label: `Sao chép địa chỉ ${kind}`, click: () => clipboard.writeText(p.srcURL) },
      ]);
    }
    const text = p.selectionText.trim();
    if (p.isEditable) groups.push([
      { label: 'Hoàn tác', accelerator: 'Ctrl+Z', enabled: p.editFlags.canUndo, click: () => contents.undo() },
      { label: 'Làm lại', accelerator: 'Ctrl+Y', enabled: p.editFlags.canRedo, click: () => contents.redo() },
      { type: 'separator' },
      { label: 'Cắt', accelerator: 'Ctrl+X', enabled: p.editFlags.canCut, click: () => contents.cut() },
      { label: 'Sao chép', accelerator: 'Ctrl+C', enabled: p.editFlags.canCopy, click: () => contents.copy() },
      { label: 'Dán', accelerator: 'Ctrl+V', enabled: p.editFlags.canPaste, click: () => contents.paste() },
      { label: 'Chọn tất cả', accelerator: 'Ctrl+A', click: () => contents.selectAll() },
    ]);
    else if (text) groups.push([{ label: 'Sao chép', accelerator: 'Ctrl+C', click: () => contents.copy() }]);
    if (text) {
      const short = text.length > 30 ? text.slice(0, 30) + '…' : text;
      groups.push([{ label: `Tìm trên Google "${short}"`, click: () => openTab(SEARCH + encodeURIComponent(text)) }]);
    }
    // Empty spot on a page: navigation, like Chrome. Not for the app's own UI (address bar, find box…)
    if (contents.getType() === 'webview') {
      if (!groups.length) {
        const nav = contents.navigationHistory;
        groups.push([
          { label: 'Quay lại', accelerator: 'Alt+Left', enabled: nav.canGoBack(), click: () => send('key', 'back') },
          { label: 'Tiến', accelerator: 'Alt+Right', enabled: nav.canGoForward(), click: () => send('key', 'forward') },
          { label: 'Tải lại', accelerator: 'F5', click: () => send('key', 'reload') },
        ], [
          { label: 'In…', accelerator: 'Ctrl+P', click: () => send('key', 'print') },
          { label: 'Xem nguồn trang', click: () => openTab('view-source:' + p.pageURL) },
        ]);
      }
      groups.push([{ label: 'Kiểm tra', click: () => contents.inspectElement(p.x, p.y) }]);
    }
    if (!groups.length) return;
    Menu.buildFromTemplate(groups.flatMap((g, i) => (i ? [{ type: 'separator' as const }, ...g] : g))).popup({ window: win });
  });
}
