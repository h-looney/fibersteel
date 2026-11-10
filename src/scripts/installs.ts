/**
 * "Lifts we've installed" on the public pages: filter chips on install grids (boat type, lift size, docking), with
 * ?kind= / ?size= / ?docking= opening on one. The cards themselves are built at build time (InstallGrid.astro).
 */

let gridsStarted = false;

export function initInstallGrids() {
  if (gridsStarted) return;
  gridsStarted = true;
  document.querySelectorAll<HTMLElement>('[data-install-grid]').forEach(setupGrid);
}

function setupGrid(grid: HTMLElement) {
  const cards = grid.querySelector<HTMLElement>('[data-install-cards]')!;
  const filters = grid.querySelector<HTMLElement>('[data-install-filters]');
  const status = grid.querySelector<HTMLElement>('[data-install-status]');
  const empty = grid.querySelector<HTMLElement>('[data-install-empty]');
  const what = grid.dataset.what ?? 'installs';
  const items = () => [...cards.querySelectorAll<HTMLElement>('.install-grid__item')];
  const rows = filters ? [...filters.querySelectorAll<HTMLElement>('[data-filter-row]')] : [];
  const active: Record<string, string> = Object.fromEntries(rows.map((r) => [r.dataset.filterRow!, 'all']));
  const chip = (f: string, v: string) => filters?.querySelector<HTMLButtonElement>(`[data-filter="${f}"][data-value="${CSS.escape(v)}"]`);

  function apply(announce = true) {
    let shown = 0;
    for (const it of items()) {
      const on = Object.entries(active).every(([f, v]) => v === 'all' || it.dataset[f] === v);
      it.hidden = !on;
      if (on) shown++;
    }
    rows.forEach((row) => {
      const f = row.dataset.filterRow!;
      row.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === active[f])));
    });
    if (empty) empty.hidden = shown > 0;
    if (announce && status) {
      const named = Object.entries(active)
        .filter(([, v]) => v !== 'all')
        .map(([f, v]) => chip(f, v)?.dataset.label ?? v);
      status.textContent = named.length ? `Showing ${shown} of ${items().length} ${what}: ${named.join(', ')}` : `Showing all ${shown} ${what}`;
    }
    if (rows.length) {
      const url = new URL(location.href);
      for (const [f, v] of Object.entries(active)) {
        if (v === 'all') url.searchParams.delete(f);
        else url.searchParams.set(f, v);
      }
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }

  filters?.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-filter]');
    if (!button) return;
    active[button.dataset.filter!] = button.dataset.value!;
    apply();
  });
  grid.querySelectorAll('[data-install-reset]').forEach((b) =>
    b.addEventListener('click', () => {
      for (const f of Object.keys(active)) active[f] = 'all';
      apply();
    }),
  );

  // ?kind=<kind> (and ?size=, ?docking=) opens on one
  const params = new URLSearchParams(location.search);
  for (const f of Object.keys(active)) {
    const v = params.get(f);
    active[f] = v && chip(f, v) ? v : 'all';
  }
  if (Object.values(active).some((v) => v !== 'all')) apply(false);
}
