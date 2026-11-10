/**
 * The sample-data rule: invented figures never sit next to a real product. FiberSteel mode's sales and service history
 * is generated for the demo, so wherever a report ranks or rates how products sold or held up, FiberSteel's lift sizes
 * and the products it sells (remote systems, dock steps, docking stations, used lifts) show under stand-in names
 * ("Boat lift C", "Add-on B") that stay the same throughout the demo. They don't link to the real item or show its SKU
 * either, since that would give the name away. In a real FiberSteel mode these reports would read FiberSteel's own
 * records and show the real names.
 *
 * Components keep their names: they're generic on purpose (data/catalog.ts) — "Air hose", "Bunk bracket" — rather
 * than anyone's product.
 */
import type { DB, Item } from '../../data/types';

/** Stand-in groups: what a stand-in calls the item, by catalog category */
const GROUP: Partial<Record<Item['category'], string>> = {
  'Boat lifts': 'Boat lift',
  'PWC lifts': 'PWC lift',
  Remotes: 'Add-on',
  'Dock steps': 'Add-on',
  'Docking stations': 'Add-on',
  'Used lifts': 'Used lift',
};

/** A, B … Z, AA, AB … */
const letters = (n: number): string => (n < 26 ? String.fromCharCode(65 + n) : letters(Math.floor(n / 26) - 1) + letters(n % 26));

const cache = new WeakMap<Item[], Map<string, string>>();

function standIns(items: Item[]) {
  const hit = cache.get(items);
  if (hit) return hit;
  const byGroup = new Map<string, Item[]>();
  for (const it of items) {
    const g = GROUP[it.category];
    if (g) byGroup.set(g, [...(byGroup.get(g) ?? []), it]);
  }
  const names = new Map<string, string>();
  // Letters follow a scrambled order, so they don't simply count up the sizes
  const scramble = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1_000_003, 7);
  for (const [group, list] of byGroup) {
    [...list].sort((a, b) => scramble(a.id) - scramble(b.id) || a.id.localeCompare(b.id)).forEach((it, i) => names.set(it.id, `${group} ${letters(i)}`));
  }
  cache.set(items, names);
  return names;
}

/** Shown under a stand-in name in the reports (everything but the generic components) */
export const isStandIn = (it: Item) => !!GROUP[it.category];

/** What a report calls an item: its stand-in, or its own name for a generic component */
export const reportItemName = (d: DB, it: Item) => standIns(d.items).get(it.id) ?? it.name;

/** What a report calls a catalog category: the stand-in groups merge the add-ons, so one item can't stand out */
export const reportCategory = (it: Item) => (GROUP[it.category] === 'Add-on' ? 'Add-ons (remotes, steps, docking stations)' : it.category);

/** Said wherever the stand-ins show */
export const STAND_IN_NOTE =
  'These figures are made up for the demo, so FiberSteel’s lift sizes and the add-ons it sells (remote systems, dock steps, docking stations) appear under stand-in names — “Boat lift C”, “Add-on B” — and invented numbers never sit next to a real product. A real FiberSteel mode would read FiberSteel’s own records and show the real names.';
