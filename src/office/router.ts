/**
 * Tiny router for FiberSteel mode. Each section is a real static page (/office/jobs/ …) so links and
 * refreshes work on any static host; moving between them uses pushState for an app feel.
 * Records open through query parameters, e.g. /office/jobs/?id=J-41042.
 */
import { signal } from '@preact/signals';
import type { Section } from './data/types';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const OFFICE = `${BASE}/office`;
export const PUBLIC_HOME = `${BASE}/`;

export const sections: Section[] = ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'dealers', 'accounting', 'analytics', 'website', 'settings'];

export interface Route {
  section: Section;
  params: URLSearchParams;
}

function parse(): Route {
  const rest = location.pathname.startsWith(OFFICE) ? location.pathname.slice(OFFICE.length) : '';
  const seg = rest.replace(/^\/+|\/+$/g, '').split('/')[0] || 'dashboard';
  return {
    section: (sections.includes(seg as Section) ? seg : 'dashboard') as Section,
    params: new URLSearchParams(location.search),
  };
}

/**
 * Links from the public site into FiberSteel mode end in ?signin: they open the sign-in screen (the demo's profile
 * picker) rather than carrying on as whoever used FiberSteel mode last in this browser. Read once, then dropped from the address so
 * a reload stays signed in.
 */
export const signInRequested = (() => {
  const params = new URLSearchParams(location.search);
  if (!params.has('signin')) return false;
  params.delete('signin');
  const qs = params.toString();
  window.history.replaceState(window.history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  return true;
})();

export const route = signal<Route>(parse());

/** Turn an office path ('/office/jobs/?id=…') into a real URL under the site's base path. */
export function href(to: string): string {
  if (BASE && to.startsWith(BASE + '/')) return to;
  return to.startsWith('/') ? BASE + to : to;
}

export function navigate(to: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const url = href(to);
  if (url !== location.pathname + location.search) {
    window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  route.value = parse();
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

/** Change query parameters on the current page; `undefined` removes one. */
export function setParams(patch: Record<string, string | undefined | null>, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const params = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', location.pathname + (qs ? `?${qs}` : ''));
  route.value = parse();
  if (opts.scroll) window.scrollTo({ top: 0 });
}

export const param = (key: string) => route.value.params.get(key) ?? undefined;

/** Path for a section, optionally with query parameters */
export const sectionPath = (section: Section, query?: Record<string, string | undefined>) => {
  const path = section === 'dashboard' ? '/office/' : `/office/${section}/`;
  const qs = new URLSearchParams(Object.entries(query ?? {}).filter((e): e is [string, string] => !!e[1])).toString();
  return qs ? `${path}?${qs}` : path;
};

window.addEventListener('popstate', () => {
  route.value = parse();
});
