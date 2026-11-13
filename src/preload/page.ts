import { ipcRenderer, webFrame } from 'electron';

// Runs inside every web page, in its own isolated world (the page can't see it).

// Ad blocking scriptlets: asked for synchronously so they run before the page's own scripts. See main/adblock.ts
const scripts: string[] = ipcRenderer.sendSync('adblock-scripts', location.href);
scripts.forEach((s) => webFrame.executeJavaScript(s));

// Saved passwords: notices sign-ins so main can offer to save the password, and fills a saved one in when the user
// picks it. See main/passwords.ts
const USER = 'input:not([type]), input[type=text], input[type=email], input[type=tel]';
const isPw = (el: unknown): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'password';
const pwBoxes = (root: ParentNode = document) => [...root.querySelectorAll<HTMLInputElement>('input[type=password]')];

// The visible text/email box just before the password box = the username
function userBox(pw: HTMLInputElement) {
  return [...(pw.form ?? document).querySelectorAll<HTMLInputElement>(USER)]
    .filter((b) => b.offsetParent && b.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING)
    .at(-1);
}

// A sign-in was sent → main asks to save it once the page moves on
function sent(pw: HTMLInputElement | undefined) {
  if (pw?.value) ipcRenderer.send('pw-sent', userBox(pw)?.value ?? '', pw.value);
}
addEventListener('submit', (e) => { if (e.target instanceof HTMLFormElement) sent(pwBoxes(e.target).find((p) => p.value)); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Enter' && isPw(e.target)) sent(e.target); }, true);

let picking: HTMLInputElement | undefined; // password box the account menu was opened for
addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  // Sign-in button (many sites log in with fetch, without a real form submit)
  const btn = t.closest('button, input[type=submit], [role=button]');
  if (btn) return sent(pwBoxes(btn.closest('form') ?? document).find((p) => p.value));
  // Click in a password box or its username box → main shows the saved accounts for this site, if any
  picking = isPw(t) ? t : pwBoxes().find((p) => userBox(p) === t);
  if (picking) ipcRenderer.send('pw-pick');
}, true);

// Setting .value from this isolated world doesn't go through React's value tracking → the input event makes
// React-based pages (Facebook…) see the new value
function fill(box: HTMLInputElement | undefined, value: string) {
  if (!box) return;
  box.value = value;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}
ipcRenderer.on('pw-fill', (_e, username: string, password: string) => {
  if (!picking) return;
  if (username) fill(userBox(picking), username);
  fill(picking, password);
});
