export const SEARCH = 'https://www.google.com/search?q=';

// Text typed in the address bar → URL to open (null = nothing typed)
export function norm(u: string) {
  u = (u || '').trim();
  if (!u) return null;
  if (/^[a-z]:[\\/]/i.test(u)) return 'file:///' + u.replace(/\\/g, '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(u)) return 'http://' + u;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(u)) return 'https://' + u;
  return SEARCH + encodeURIComponent(u);
}
export const pretty = (u: string) => { try { u = decodeURI(u); } catch {} return u.replace(/^https?:\/\/(www\.)?/i, ''); };
// No port: Chromium shares zoom across every port of a host (localhost:3000 and :5173 zoom together)
export const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };
