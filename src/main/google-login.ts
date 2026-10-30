import type { Session, WebContents } from 'electron';

// Google blocks sign-in inside embedded browsers ("This browser or app may not be secure").
// Same trick as Ferdium/Rambox: identify as Firefox on the Google sign-in page only
const GOOGLE_LOGIN = 'https://accounts.google.com/';
const FIREFOX_UA = (() => {
  // Firefox ships a new version every ~4 weeks; step by 30 days so we never claim an unreleased version
  const v = 128 + Math.floor((Date.now() - Date.UTC(2024, 6, 9)) / (30 * 864e5));
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`;
})();

// Headers: swap User-Agent + drop Sec-CH-UA* (Firefox never sends these; leaving them exposes Chromium)
export function googleLoginHeaders(ses: Session) {
  ses.webRequest.onBeforeSendHeaders({ urls: [GOOGLE_LOGIN + '*'] }, (d, cb) => {
    const h = d.requestHeaders;
    h['User-Agent'] = FIREFOX_UA;
    for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
    cb({ requestHeaders: h });
  });
}
// navigator.userAgent in the page: swap on entering the sign-in page, restore the original UA on leaving
export function googleLoginUA(contents: WebContents) {
  let orig: string | null = null;
  contents.on('did-start-navigation', ({ url, isMainFrame }) => {
    if (!isMainFrame) return;
    const login = url.startsWith(GOOGLE_LOGIN);
    if (login && orig === null) { orig = contents.getUserAgent(); contents.setUserAgent(FIREFOX_UA); }
    else if (!login && orig !== null) { contents.setUserAgent(orig); orig = null; }
  });
}
