// Minimal hash router: works on any static host path (GitHub Pages included).
import { signal } from '@preact/signals';

const read = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
export const route = signal(read());
window.addEventListener('hashchange', () => {
  route.value = read();
  window.scrollTo(0, 0);
});

export const navigate = (path: string) => {
  location.hash = path;
};

/** Match "/drill/:id" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
