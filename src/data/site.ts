/**
 * Single source of truth for FiberSteel's business details.
 * Everything here was carried over from the current lakeboatlifts.com site (read 2026-11-10; see the README's
 * "To confirm with FiberSteel" for the open questions). The marketing copy on the pages is new.
 */

/** A day's hours, 'appointment' (by appointment only) or null (closed). */
export type DayHours = { open: string; close: string } | 'appointment' | null;

/** 0 = Sunday … 6 = Saturday. */
export type WeeklyHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

// TODO(FiberSteel): the current site shows three different sets of hours — the Contact page (used here: weekdays
// 9–4:30, Saturday by appointment), the footer widget ("Open today 9:00 am – 5:00 pm") and the structured data
// Google reads (Mon 8:30–5, Tue–Fri 9–5, Sat 9–noon). Which is right?
const hours: WeeklyHours = [
  null, // Sunday: closed
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  { open: '09:00', close: '16:30' },
  'appointment', // Saturday
];

export const site = {
  name: 'FiberSteel Boat Lifts',
  // TODO(FiberSteel): the warranty page says "Fibersteel Boat Lifts, LLC." — confirm the legal spelling
  legalName: 'FiberSteel Boat Lifts, LLC',
  /** The web address only — the business is always "FiberSteel Boat Lifts" */
  domain: 'LakeBoatLifts.com',
  url: 'https://lakeboatlifts.com',
  slogan: 'The Boaters Choice!',
  timezone: 'America/Chicago',
  description:
    'FiberSteel Boat Lifts designs, builds, installs and services floating boat lifts at the Lake of the Ozarks — factory direct from Camdenton, Missouri, and through authorized dealers.',
  /** "With over 30 yrs. leading the industry" (home), "Over 30 years strong" (About) */
  experience: 'over 30 years',
  address: {
    street: '3910 Old Route 5',
    city: 'Camdenton',
    state: 'MO',
    zip: '65020',
    /** Contact page: "About 4.5 miles from Camdenton Square on 'Old N. Hwy 5'" */
    note: 'About 4.5 miles from Camdenton Square on Old N. Hwy 5',
  },
  geo: { lat: 38.0479307601222, lng: -92.7801320974661 },
  region: 'Lake of the Ozarks',
  /** Dealers page: "Serving the Lake of the Ozarks and all of Missouri — or we can ship to you!" */
  serviceArea: 'the Lake of the Ozarks and all of Missouri',
  hours,
  hoursSummary: [
    { days: 'Monday – Friday', time: '9:00 AM – 4:30 PM' },
    { days: 'Saturday', time: 'By appointment' },
    { days: 'Sunday', time: 'Closed' },
  ],
  sales: {
    label: 'Sales & information',
    phone: '573-346-3088',
    email: 'dean@lakeboatlifts.com',
    /** "For help, call Dean for personal service!" (Contact page) */
    contact: 'Dean',
  },
  service: {
    label: 'Service, parts & repairs',
    phone: '573-346-9688',
    // TODO(FiberSteel): the service department uses a Gmail address — move it to @lakeboatlifts.com?
    email: 'fibersteelservice@gmail.com',
  },
  social: {
    facebook: 'https://www.facebook.com/lakeboatlifts',
    yelp: 'https://www.yelp.com/biz/fibersteel-boat-lifts-camdenton-3',
  },
  mapEmbed: 'https://www.google.com/maps?q=3910+Old+Route+5,+Camdenton,+MO+65020&output=embed',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=3910+Old+Route+5,+Camdenton,+MO+65020',
} as const;

/** "573-346-3088" → "tel:+15733463088" */
export const tel = (phone: string) => `tel:+1${phone.replace(/\D/g, '')}`;

/** "573-346-3088" → "(573) 346-3088" */
export const prettyPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export const fullAddress = `${site.address.street}, ${site.address.city}, ${site.address.state} ${site.address.zip}`;
