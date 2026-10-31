import { clipboard, Menu, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { send, win } from './window';

// Right-click menu (Electron has none): only the items that fit the spot clicked, like Chrome
export function contextMenu(contents: WebContents) {
  contents.on('context-menu', (_e, p) => {
    const groups: MenuItemConstructorOptions[][] = [];
    if (p.linkURL) groups.push([
      { label: 'Mở link trong tab mới', click: () => send('open-tab', p.linkURL) },
      { label: 'Sao chép địa chỉ link', click: () => clipboard.writeText(p.linkURL) },
    ]);
    if (p.mediaType === 'image') groups.push([
      { label: 'Mở ảnh trong tab mới', click: () => send('open-tab', p.srcURL) },
      { label: 'Lưu ảnh', click: () => contents.downloadURL(p.srcURL) },
      { label: 'Sao chép ảnh', click: () => contents.copyImageAt(p.x, p.y) },
      { label: 'Sao chép địa chỉ ảnh', click: () => clipboard.writeText(p.srcURL) },
    ]);
    if (p.isEditable) groups.push([
      { label: 'Cắt', accelerator: 'Ctrl+X', enabled: p.editFlags.canCut, click: () => contents.cut() },
      { label: 'Sao chép', accelerator: 'Ctrl+C', enabled: p.editFlags.canCopy, click: () => contents.copy() },
      { label: 'Dán', accelerator: 'Ctrl+V', enabled: p.editFlags.canPaste, click: () => contents.paste() },
      { label: 'Chọn tất cả', accelerator: 'Ctrl+A', click: () => contents.selectAll() },
    ]);
    else if (p.selectionText.trim()) groups.push([{ label: 'Sao chép', accelerator: 'Ctrl+C', click: () => contents.copy() }]);
    if (!groups.length) return;
    Menu.buildFromTemplate(groups.flatMap((g, i) => (i ? [{ type: 'separator' as const }, ...g] : g))).popup({ window: win });
  });
}
