/**
 * People and places for the demo data.
 *
 * Dean is the one person FiberSteel's site names ("For help, call Dean"), so Dean appears only as a sign-in profile —
 * no report rates Dean. Everyone else is a placeholder: FiberSteel's staff aren't listed publicly, and the placeholder
 * crew, shop and service people are the only ones the reports rate. Every customer is fictional: phone numbers use
 * the reserved 555-01xx range and emails use example.com/.net/.org.
 */
import type { LeadKind, Role, Section, Staff } from './types';

export const staff: Staff[] = [
  { id: 'dean', name: 'Dean', role: 'owner', title: 'Sales & information', store: 'camdenton', color: '#1d4ed0', active: true },
  // Placeholders (FiberSteel's team isn't listed publicly)
  { id: 'jamie', name: 'Jamie Lane', role: 'service', title: 'Service, parts & repairs', store: 'camdenton', color: '#1f7a8c', active: true },
  { id: 'pat', name: 'Pat Morgan', role: 'office', title: 'Office & accounting', store: 'camdenton', color: '#a2456b', active: true },
  { id: 'travis', name: 'Travis Hale', role: 'shop', title: 'Shop lead', store: 'camdenton', color: '#8a5a1c', shop: true, active: true },
  { id: 'ben', name: 'Ben Sutter', role: 'shop', title: 'Fabricator', store: 'camdenton', color: '#6b4fa3', shop: true, active: true },
  { id: 'jesse', name: 'Jesse Ray', role: 'crew', title: 'Install crew lead', store: 'camdenton', color: '#c2410c', tech: true, active: true },
  { id: 'kyle', name: 'Kyle Dunn', role: 'crew', title: 'Installer', store: 'camdenton', color: '#b8501f', tech: true, active: true },
  { id: 'marco', name: 'Marco Silva', role: 'crew', title: 'Install crew lead', store: 'camdenton', color: '#3d7d5a', tech: true, active: true },
  { id: 'owen', name: 'Owen Pratt', role: 'crew', title: 'Installer', store: 'camdenton', color: '#8c3b5e', tech: true, active: true },
  { id: 'luke', name: 'Luke Henson', role: 'crew', title: 'Service technician', store: 'camdenton', color: '#5b5fa8', tech: true, active: true },
  { id: 'tyler', name: 'Tyler Ames', role: 'crew', title: 'Service technician', store: 'camdenton', color: '#7a6a2f', tech: true, active: true },
];

/** Demo sign-in profiles */
export const profiles: { id: string; blurb: string }[] = [
  { id: 'dean', blurb: 'Everything: requests, quotes, jobs, the shop, dealers, the books, reports and the website.' },
  { id: 'jamie', blurb: 'Service and parts requests, scheduling the service crew, warranty and parts stock.' },
  { id: 'pat', blurb: 'Invoices, payments, bills, banking, QuickBooks, and dealer accounts.' },
  { id: 'travis', blurb: 'The shop: lifts to build this week, components, stock and purchase orders.' },
  { id: 'jesse', blurb: 'A phone-friendly day view on the water: today’s installs, checklists, parts, photos and signatures.' },
];

/** Who does what in the simulation (and in the crew pickers) */
export const crews = {
  /** Install crews: [lead, installer] */
  install: [
    ['jesse', 'kyle'],
    ['marco', 'owen'],
  ] as [string, string][],
  service: ['luke', 'tyler'],
  shop: ['travis', 'ben'],
  sales: ['dean'],
};

/** Crew tendencies that shape the sample time reports (placeholder people only) */
export const techProfiles: Record<string, { speed: number; onTime: number; callback: number }> = {
  jesse: { speed: 0.93, onTime: 0.95, callback: 0.03 },
  kyle: { speed: 1.08, onTime: 0.9, callback: 0.05 },
  marco: { speed: 1.0, onTime: 0.92, callback: 0.04 },
  owen: { speed: 1.12, onTime: 0.88, callback: 0.06 },
  luke: { speed: 0.9, onTime: 0.94, callback: 0.07 },
  tyler: { speed: 1.15, onTime: 0.86, callback: 0.05 },
  travis: { speed: 0.95, onTime: 0.96, callback: 0.02 },
  ben: { speed: 1.1, onTime: 0.93, callback: 0.03 },
};

export const allSections: Section[] = ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'dealers', 'accounting', 'analytics', 'website', 'settings'];

export const defaultPermissions: Record<Role, Section[]> = {
  owner: allSections,
  sales: ['dashboard', 'my-day', 'inbox', 'jobs', 'customers', 'inventory', 'dealers', 'analytics'],
  service: ['dashboard', 'inbox', 'jobs', 'customers', 'warranty', 'inventory', 'analytics'],
  office: ['dashboard', 'inbox', 'customers', 'dealers', 'accounting', 'analytics'],
  shop: ['my-day', 'jobs', 'inventory'],
  crew: ['my-day', 'jobs', 'customers', 'inventory'],
};

export const roleLabels: Record<Role, string> = {
  owner: 'Full access',
  sales: 'Sales',
  service: 'Service desk',
  office: 'Office & accounting',
  shop: 'Shop',
  crew: 'Install & service crew',
};

/** Who new website requests go to first, by kind */
export const defaultRouting: Record<LeadKind, string> = {
  quote: 'dean',
  service: 'jamie',
  warranty: 'jamie',
  dealer: 'dean',
  question: 'dean',
};

export const firstNames = [
  'James', 'Mary', 'Robert', 'Linda', 'Michael', 'Karen', 'David', 'Susan', 'Richard', 'Lisa', 'Joseph', 'Nancy', 'Thomas',
  'Betty', 'Mark', 'Sandra', 'Steven', 'Donna', 'Paul', 'Carol', 'Kevin', 'Michelle', 'Brian', 'Amy', 'Gary', 'Angela',
  'Timothy', 'Melissa', 'Jeffrey', 'Rebecca', 'Ryan', 'Laura', 'Jacob', 'Emily', 'Nicholas', 'Megan', 'Eric', 'Rachel',
  'Jonathan', 'Heather', 'Scott', 'Julie', 'Gregory', 'Christina', 'Dale', 'Glenda', 'Darrell', 'Brenda', 'Wayne', 'Tammy',
  'Randy', 'Sheila', 'Kristen', 'Craig', 'Tara', 'Dustin', 'Leah', 'Curtis', 'Holly', 'Marcus', 'Priya', 'Andre', 'Rosa',
  'Hector', 'Mei', 'Samir', 'Ana', 'Victor', 'Joy', 'Kurt', 'Faye', 'Lyle', 'Darla', 'Roger', 'Connie', 'Shane', 'Tonya',
  'Grant', 'Paige', 'Wade', 'Jill', 'Brent', 'Robin', 'Clint', 'Dana',
];

export const lastNames = [
  'Anderson', 'Baker', 'Bennett', 'Brooks', 'Burke', 'Caldwell', 'Carlson', 'Chandler', 'Collins', 'Crawford', 'Dawson',
  'Dillard', 'Ellison', 'Fletcher', 'Foster', 'Garrison', 'Gibbs', 'Graves', 'Hampton', 'Harlan', 'Hartley', 'Hayes',
  'Hendricks', 'Holloway', 'Hutchins', 'Jennings', 'Keller', 'Kendrick', 'Lambert', 'Lawson', 'Lindquist', 'Mabry',
  'Marsh', 'McAllister', 'McCoy', 'Mercer', 'Morrow', 'Nolan', 'Oakley', 'Osborne', 'Parrish', 'Pierce', 'Pruitt',
  'Ramsey', 'Reeves', 'Rhodes', 'Riggs', 'Sanderson', 'Sawyer', 'Schaefer', 'Sexton', 'Shelton', 'Simmons', 'Slater',
  'Stafford', 'Stanton', 'Tate', 'Thornton', 'Tillman', 'Vance', 'Wakefield', 'Walsh', 'Whitfield', 'Wilder', 'Winslow',
  'Yates', 'Brandt', 'Ortiz', 'Raman', 'Chen', 'Nguyen', 'Patel', 'Delgado', 'Kowalski', 'Lindgren', 'Moreau', 'Okafor',
  'Petrov', 'Haugen', 'Romero', 'Santos', 'Weaver', 'Zimmerman',
];

/** Lake towns, with ZIP codes and a rough share of customers (Lake of the Ozarks) */
export const towns: { city: string; zip: string; weight: number }[] = [
  { city: 'Camdenton', zip: '65020', weight: 20 },
  { city: 'Osage Beach', zip: '65065', weight: 18 },
  { city: 'Lake Ozark', zip: '65049', weight: 15 },
  { city: 'Sunrise Beach', zip: '65079', weight: 11 },
  { city: 'Laurie', zip: '65037', weight: 9 },
  { city: 'Gravois Mills', zip: '65037', weight: 7 },
  { city: 'Four Seasons', zip: '65049', weight: 7 },
  { city: 'Linn Creek', zip: '65052', weight: 5 },
  { city: 'Rocky Mount', zip: '65072', weight: 4 },
  { city: 'Climax Springs', zip: '65324', weight: 4 },
];

/** Arms of the lake and the mile-marker range along each (rough, for directions in the demo) */
export const arms: { arm: string; mm: [number, number]; towns: string[] }[] = [
  { arm: 'Main channel', mm: [0, 40], towns: ['Lake Ozark', 'Osage Beach', 'Four Seasons', 'Sunrise Beach'] },
  { arm: 'Osage arm', mm: [40, 90], towns: ['Camdenton', 'Linn Creek', 'Climax Springs'] },
  { arm: 'Gravois arm', mm: [0, 18], towns: ['Gravois Mills', 'Laurie', 'Rocky Mount'] },
  { arm: 'Grand Glaize arm', mm: [0, 6], towns: ['Osage Beach'] },
  { arm: 'Niangua arm', mm: [0, 20], towns: ['Camdenton', 'Linn Creek'] },
];

export const coves = ['Turkey Bend', 'Hidden Cove', 'Eagle Cove', 'Sunset Cove', 'Cedar Cove', 'Deer Creek', 'Indian Creek', 'Shawnee Bend', 'Horseshoe Bend', 'Duckhead Point', 'Buck Creek', 'Pier 31 Cove'];

export const streets = [
  'Lake Rd 5-12', 'Lake Rd 5-35', 'Lake Rd 54-28', 'Shoreline Dr', 'Harbor Point Dr', 'Sunset Cove Dr', 'Eagle Bluff Ln',
  'Cedar Hollow Ln', 'Hidden Cove Rd', 'Lighthouse Ln', 'Driftwood Ct', 'Anchor Point Rd', 'Bittersweet Rd', 'Quail Hollow Ct',
  'Woodland Bay Dr', 'Osage Hills Rd', 'Timber Trail', 'Red Oak Ln', 'Bluff Ridge Rd', 'Dockside Dr',
];

/** Sample marinas and businesses with commercial accounts (invented) */
export const marinas = [
  { name: 'Sample Cove Marina', contact: 'Rae Collins' },
  { name: 'Lakeview Docks (sample)', contact: 'Hank Mercer' },
  { name: 'Bluff Point Resort (sample)', contact: 'Ivy Garrison' },
];

/**
 * Sample dealer accounts — invented, not FiberSteel's real dealers (those are on the public dealer list, which this
 * demo never attaches order numbers to). Contacts are placeholder names.
 */
export const sampleDealers = [
  { id: 'D-101', name: 'North Shore Marina (sample)', city: 'Lake town', state: 'IL', area: 'A reservoir in central Illinois', contact: 'Avery Holt' },
  { id: 'D-102', name: 'Prairie Lake Boats & Docks (sample)', city: 'Lake town', state: 'IA', area: 'Eastern Iowa lakes and the river', contact: 'Jordan Pike' },
  { id: 'D-103', name: 'Hill Country Dock Co. (sample)', city: 'Lake town', state: 'TX', area: 'North Texas lakes', contact: 'Casey Lund' },
  { id: 'D-104', name: 'Riverbend Marine (sample)', city: 'River town', state: 'MO', area: 'Rivers and lakes near St. Louis', contact: 'Morgan Tate' },
  { id: 'D-105', name: 'Blue Hollow Marina (sample)', city: 'Lake town', state: 'KS', area: 'A Kansas reservoir', contact: 'Riley Fox' },
  { id: 'D-106', name: 'Middle Valley Docks (sample)', city: 'Lake town', state: 'TN', area: 'Middle Tennessee lakes', contact: 'Quinn Ash' },
];

/** Generic boat descriptions (no real makes or models get made-up numbers) */
export const boatTypes: { type: string; kind: 'boat' | 'pwc'; length: [number, number]; dryPerFt: [number, number]; fuel: [number, number]; bunks: string }[] = [
  { type: 'Bowrider', kind: 'boat', length: [19, 26], dryPerFt: [150, 200], fuel: [30, 60], bunks: 'V-bunks' },
  { type: 'Ski / wake boat', kind: 'boat', length: [20, 25], dryPerFt: [190, 240], fuel: [40, 70], bunks: 'Extra-tall bunks (inboard)' },
  { type: 'Fishing boat', kind: 'boat', length: [17, 22], dryPerFt: [100, 150], fuel: [20, 50], bunks: 'V-bunks' },
  { type: 'Pontoon', kind: 'boat', length: [20, 26], dryPerFt: [110, 140], fuel: [25, 40], bunks: 'Pontoon bunks' },
  { type: 'Tri-toon', kind: 'boat', length: [22, 27], dryPerFt: [130, 170], fuel: [30, 50], bunks: 'Tri-toon bunks' },
  { type: 'Cuddy / performance boat', kind: 'boat', length: [24, 34], dryPerFt: [230, 330], fuel: [60, 140], bunks: 'V-bunks' },
  { type: 'Cruiser', kind: 'boat', length: [28, 42], dryPerFt: [300, 420], fuel: [100, 300], bunks: 'V-bunks + bow V-brace' },
  { type: 'Personal watercraft', kind: 'pwc', length: [10, 12], dryPerFt: [70, 90], fuel: [15, 20], bunks: 'PWC bunks' },
];
