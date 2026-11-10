/**
 * FiberSteel's authorized dealers, as listed on the current Dealers page (read 2026-11-10). Businesses only: the
 * staff names some listings include are left out. Coordinates are approximate (the town, or the region for a
 * dealer listed by area), used only to sort by distance in the visitor's own browser — nothing is sent anywhere.
 *
 * Website links were each visited once on 2026-11-10: `web` is null where the listed site is down. Questions about
 * names and links are in the README's "To confirm with FiberSteel".
 */
export interface Dealer {
  id: string;
  name: string;
  /** Street address as listed (some dealers list only a town or region) */
  street?: string;
  city: string;
  state: string;
  zip?: string;
  /** Region, when the dealer is listed by area */
  area?: string;
  phones: string[];
  email?: string;
  web?: string | null;
  /** Lake or water the dealer is on, where its own site says so */
  lake?: string;
  geo: { lat: number; lng: number };
  /** What the current page says about the dealer, if anything */
  note?: string;
  /** The factory itself */
  factory?: boolean;
}

export const dealers: Dealer[] = [
  {
    id: 'fibersteel',
    name: 'FiberSteel Boat Lifts — home office & showroom',
    street: '3910 N. Hwy 5',
    city: 'Camdenton',
    state: 'MO',
    zip: '65020',
    phones: ['573-346-3088'],
    web: null,
    lake: 'Lake of the Ozarks',
    geo: { lat: 38.0479, lng: -92.7801 },
    note: 'Order factory direct. Serving the Lake of the Ozarks and all of Missouri — or we can ship to you!',
    factory: true,
  },
  { id: 'sullivan-marina', name: 'Sullivan Marina', street: '925 St. Hwy 32', city: 'Sullivan', state: 'IL', phones: ['217-728-7338'], web: 'https://sullivanmarina.com/', lake: 'Lake Shelbyville', geo: { lat: 39.6, lng: -88.61 } },
  { id: 'woodland-marina', name: 'Woodland Marina', street: '125 Harbor Dr.', city: 'St. Charles', state: 'MO', phones: ['636-250-3446'], web: 'https://woodlandmarina.com/', geo: { lat: 38.79, lng: -90.49 } },
  { id: 'scales-pointe', name: 'Scales Pointe Marina & Camping', street: '1850 Scales Bend Rd NE', city: 'North Liberty', state: 'IA', zip: '52317', phones: ['319-665-3474'], web: 'https://scalespointe.com/', geo: { lat: 41.77, lng: -91.56 }, note: 'Camping & boating, and Bobbers Grill.' },
  { id: 'dockside-marina', name: 'DockSide Marina', street: 'Arrowwood Lane', city: 'Dubuque', state: 'IA', zip: '52001', phones: ['563-513-6573'], geo: { lat: 42.5, lng: -90.66 } },
  { id: 'dam-boat-house', name: 'Dam Boat House Marina', city: 'Bloomington', state: 'IN', phones: ['812-360-2129'], geo: { lat: 39.17, lng: -86.53 } },
  { id: 'midtown-marina', name: 'Mid Town Marina', city: 'East Dubuque', state: 'IL', phones: ['815-747-3310'], web: 'https://midtownmarina.com/', geo: { lat: 42.49, lng: -90.64 } },
  { id: 'wildcat-marina', name: 'Wildcat Marina', street: '8220 Spillway Marina Rd', city: 'Manhattan', state: 'KS', zip: '66502', phones: ['785-776-3113'], web: 'https://www.facebook.com/tuttlecreeklake', lake: 'Tuttle Creek Lake', geo: { lat: 39.25, lng: -96.59 } },
  { id: 'indian-creek-marina', name: 'Indian Creek Marina', street: '22536 Co Rd 581', city: 'Monroe City', state: 'MO', zip: '63456', phones: ['573-735-4097'], web: null, geo: { lat: 39.65, lng: -91.73 } },
  { id: 'two-rivers-marina', name: 'Two Rivers Marina', street: '2021 Hwy C', city: 'St. Charles', state: 'MO', phones: ['636-946-2628', '314-728-0078'], geo: { lat: 38.8, lng: -90.5 } },
  { id: '777-texoma', name: '777 Texoma Boat Lifts & Dock Services', street: '83352 N. St Hwy 289', city: 'Pottsboro', state: 'TX', zip: '75076', phones: ['469-438-4152'], lake: 'Lake Texoma', geo: { lat: 33.76, lng: -96.67 }, note: 'Serving the Dallas & Fort Worth areas.' },
  { id: 'findlay-marina', name: 'Findlay Marina', street: '536 County Rd 800 North', city: 'Findlay', state: 'IL', phones: ['217-756-8595'], web: 'https://findlaymarina.com/', lake: 'Lake Shelbyville', geo: { lat: 39.52, lng: -88.75 } },
  { id: 'midwest-marine', name: 'Midwest Marine', city: 'Lakewood', state: 'IL', zip: '62438', phones: ['217-343-3893'], email: 'midwestmarine21@gmail.com', geo: { lat: 39.31, lng: -88.86 } },
  { id: 'midtown-dock-worx', name: 'MidTown Dock Worx', city: 'Middle Tennessee', state: 'TN', area: 'Serving Middle Tennessee', phones: ['615-613-5982'], email: 'midtndockworx@gmail.com', geo: { lat: 36.16, lng: -86.78 }, note: 'Boat lifts & dock sales.' },
];

export const STATE_NAMES: Record<string, string> = {
  MO: 'Missouri', IL: 'Illinois', IA: 'Iowa', IN: 'Indiana', KS: 'Kansas', TX: 'Texas', TN: 'Tennessee',
};

/** Great-circle distance in miles */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** "Dealerships available" — what the current page invites */
export const dealerKinds = ['Marinas', 'Dock builders', 'Boat dealers'];
