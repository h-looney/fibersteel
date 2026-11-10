/**
 * FiberSteel mode data model — a demo of what a staff side could look like for a boat-lift builder and installer.
 *
 * Everything lives in the browser (IndexedDB) — this is a front-end concept. The shapes are written the way a real
 * backend would expose them, so wiring one up later is mostly a matter of swapping the store for API calls.
 */

/** FiberSteel works from one place: the factory, office & showroom in Camdenton (location pickers stay hidden). */
export type StoreId = 'camdenton';
export type StoreFilter = StoreId | 'all';

export type Role = 'owner' | 'sales' | 'service' | 'office' | 'shop' | 'crew';
export type Section =
  | 'dashboard'
  | 'my-day'
  | 'inbox'
  | 'jobs'
  | 'customers'
  | 'warranty'
  | 'inventory'
  | 'dealers'
  | 'accounting'
  | 'analytics'
  | 'website'
  | 'settings';

export interface Staff {
  id: string;
  name: string;
  role: Role;
  title: string;
  store: StoreId;
  /** Key into the avatar images passed in from Astro */
  photo?: string;
  color: string;
  /** Can be put on an install or service crew */
  tech?: boolean;
  /** Works in the shop (builds) */
  shop?: boolean;
  phone?: string;
  active: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/** Where the dock is, the way lake people give directions */
export interface LakeSpot {
  /** "Gravois arm", "Main channel" … */
  arm: string;
  /** Lake of the Ozarks mile marker */
  mm?: number;
  cove?: string;
}

export interface Customer {
  id: string;
  /** Person or business name */
  name: string;
  /** Contact person for marinas and dealers */
  contact?: string;
  kind: 'owner' | 'marina' | 'dealer';
  phone: string;
  email: string;
  address: Address;
  /** Lake owners: where the dock is */
  lake?: LakeSpot;
  store: StoreId;
  since: string;
  tags: string[];
  notes?: string;
  contactPref: 'phone' | 'email' | 'text';
  /** Dealer customers: the dealer account */
  dealerId?: string;
  /** Calls, notes and messages logged against the customer */
  activity?: Activity[];
}

export type LiftKind = 'boat' | 'pwc' | 'front' | 'shallow';
export type Docking = 'straight' | 'back-in';
export type RemoteBrand = 'Admiral' | 'FirstMate' | 'Captain’s Choice';

/** The boat on a lift — described generically (never a real make and model with made-up numbers) */
export interface BoatInfo {
  type: string;
  lengthFt: number;
  dryLb: number;
  fuelGal?: number;
}

/**
 * A lift at a customer's dock: what the warranty and service history hang on. Warranty coverage is worked out from
 * FiberSteel's published terms (selectors.ts → liftCoverage): lifetime on the poly tanks and frame, 5 years on
 * hot-dipped galvanized parts, 3 years on the blower controller, bushings and hose — to the original purchaser, for
 * lifts FiberSteel installed.
 */
export interface Lift {
  id: string;
  customerId: string;
  /** The catalog lift (a size) */
  itemId?: string;
  /** "10,000 lb lift", "Twin PWC lift set" */
  model: string;
  capacity: number;
  kind: LiftKind;
  serial: string;
  installedOn: string;
  installedBy: 'FiberSteel' | 'Dealer' | 'Other';
  dealerId?: string;
  /** Still owned by the original purchaser (the warranty follows the original purchaser) */
  originalOwner: boolean;
  registered: boolean;
  registrationNo?: string;
  boat?: BoatInfo;
  slip?: { widthFt: number; lengthFt: number; docking: Docking; offset?: boolean };
  /** "V-bunks", "Tri-toon bunks", "Combo bunks", "Extra-tall bunks" */
  bunks: string;
  extras: string[];
  remote?: { brand: RemoteBrand; valves: number; installedOn: string };
  lastServiceOn?: string;
}

/** The parts of a lift the warranty names */
export type Component = 'Poly tank' | 'Lift frame' | 'Galvanized part' | 'Blower controller' | 'Bushings' | 'Hose' | 'Remote system';

export type ClaimStatus = 'open' | 'approved' | 'part-sent' | 'replaced' | 'referred' | 'denied';

export interface WarrantyClaim {
  id: string;
  liftId: string;
  customerId: string;
  jobId?: string;
  store: StoreId;
  openedOn: string;
  issue: string;
  component: Component;
  part: string;
  /** Who covers it: FiberSteel, or the remote system's maker (FirstMate → AquaLogic Marine, Captain's Choice) */
  coveredBy: 'FiberSteel' | 'AquaLogic Marine (FirstMate)' | 'Captain’s Choice' | 'Admiral';
  status: ClaimStatus;
  /** FiberSteel's cost of the part (parts only — the owner pays the service call and labor) */
  partCost: number;
  updatedOn: string;
  notes?: string;
}

export type LeadKind = 'quote' | 'service' | 'warranty' | 'dealer' | 'question';
export type LeadStage = 'new' | 'contacted' | 'scheduled' | 'quoted' | 'won' | 'lost' | 'closed';
export type LeadSource = 'web-quote' | 'web-service' | 'web-warranty' | 'web-dealer' | 'web-contact' | 'phone' | 'walk-in' | 'facebook' | 'referral' | 'boat-show';

export interface Activity {
  id: string;
  at: string;
  /** Staff id, or 'customer' / 'system' */
  by: string;
  kind: 'received' | 'note' | 'email' | 'call' | 'text' | 'status' | 'assign' | 'job' | 'estimate' | 'system';
  text: string;
}

/** A request from the website, a call, a walk-in, Facebook or a boat show. */
export interface Lead {
  id: string;
  kind: LeadKind;
  source: LeadSource;
  receivedAt: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  zip?: string;
  /** Where the dock is (lake, cove, mile marker), or the business's town */
  location?: string;
  store: StoreId;
  summary: string;
  message?: string;
  /** Label/value pairs exactly as submitted */
  fields: [string, string][];
  /** Website requests: the raw form values (a lift size id, an install date …) */
  data?: Record<string, string>;
  /** Quotes: what the calculator or the visitor said */
  boat?: BoatInfo;
  slip?: { widthFt?: number; lengthFt?: number; docking?: Docking | 'not-sure' };
  /** A lift size id (src/data/lifts.ts) worked out with FiberSteel's formula */
  suggestedSize?: string;
  photos?: number;
  stage: LeadStage;
  assignee?: string;
  customerId?: string;
  jobId?: string;
  estimateId?: string;
  dealerId?: string;
  firstResponseAt?: string;
  closedAt?: string;
  /** Estimated or won value */
  value?: number;
  lostReason?: string;
  unread: boolean;
  starred?: boolean;
  activity: Activity[];
  /** Submitted through the public site in this browser */
  demo?: boolean;
  /** Reference shown on the public site's confirmation, for linking straight here */
  ref?: string;
}

/** site visit (measure the slip) · build (in the shop) · install · service · warranty · delivery (ship or deliver) · remote (fit a remote) */
export type JobType = 'site-visit' | 'build' | 'install' | 'service' | 'warranty' | 'delivery' | 'remote';
export type JobStatus = 'requested' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'closed' | 'cancelled';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface JobPart {
  itemId: string;
  qty: number;
  store: StoreId;
  status: 'reserved' | 'used';
}

export interface Job {
  id: string;
  type: JobType;
  title: string;
  customerId: string;
  liftId?: string;
  /** The catalog lift being built, installed or delivered */
  itemId?: string;
  /** Builds: how many lifts (a dealer order can build several at once) */
  qty?: number;
  leadId?: string;
  dealerOrderId?: string;
  store: StoreId;
  status: JobStatus;
  priority: 'normal' | 'high';
  /** Scheduled start */
  start?: string;
  /** Estimated hours */
  hours: number;
  crew: string[];
  description: string;
  /** Lake jobs: where the dock is */
  location?: string;
  checklist: ChecklistItem[];
  parts: JobPart[];
  notes: Activity[];
  createdAt: string;
  /** Actual start / finish, for time reports */
  startedAt?: string;
  completedAt?: string;
  issue?: string;
  /** The job this one is a return visit for */
  callbackOf?: string;
  claimId?: string;
  invoiceId?: string;
  estimateId?: string;
  value?: number;
  holdReason?: string;
  signature?: { name: string; at: string; image?: string };
  /** Photos attached from the field (count, in this demo) */
  photos?: number;
}

export interface StockLevel {
  onHand: number;
  reserved: number;
  /** On the showroom floor or at a boat show (counted in on hand) */
  display: number;
}

export type ItemCategory =
  | 'Boat lifts'
  | 'PWC lifts'
  | 'Poly tanks'
  | 'Frames & arms'
  | 'Bunks & brackets'
  | 'Blowers & controls'
  | 'Hardware'
  | 'Remotes'
  | 'Dock steps'
  | 'Docking stations'
  | 'Used lifts';

export interface Item {
  /** SKU */
  id: string;
  name: string;
  brand: string;
  category: ItemCategory;
  /** lift: a finished lift · product: FiberSteel's other products (dock steps) · component: what lifts are built from · resale: another maker's product · used: a trade-in */
  kind: 'lift' | 'product' | 'component' | 'resale' | 'used';
  uom: 'ea' | 'ft' | 'set';
  cost: number;
  price: number;
  /** The price is the one FiberSteel's current site shows (Admiral remotes, dock steps); otherwise it's a sample */
  publicPrice?: boolean;
  reorderPoint: number;
  reorderQty: number;
  vendorId: string;
  stock: Record<StoreId, StockLevel>;
  /** Lifts: the size on the public site (src/data/lifts.ts) and its rated lift */
  sizeId?: string;
  capacity?: number;
  /** Components used to build one of this lift */
  bom?: { itemId: string; qty: number }[];
  /** Built to order (not stocked) */
  buildToOrder?: boolean;
}

export interface StockMove {
  id: string;
  at: string;
  itemId: string;
  store: StoreId;
  /** + into stock, − out of stock */
  qty: number;
  kind: 'received' | 'sold' | 'job' | 'built' | 'adjustment' | 'shipped';
  ref?: string;
  by: string;
  note?: string;
}

export type POStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  store: StoreId;
  status: POStatus;
  createdAt: string;
  orderedOn?: string;
  expectedOn?: string;
  receivedOn?: string;
  lines: { itemId: string; qty: number; received: number; cost: number }[];
  notes?: string;
  createdBy: string;
}

export type RevenueCategory = 'Lifts' | 'Installation' | 'Service' | 'Parts' | 'Remotes & add-ons' | 'Dealer sales';
export type ExpenseCategory =
  | 'Steel & materials'
  | 'Poly tanks'
  | 'Resale stock'
  | 'Payroll'
  | 'Rent & utilities'
  | 'Trucks, barge & fuel'
  | 'Insurance'
  | 'Marketing & boat shows'
  | 'Shop supplies & tools'
  | 'Professional services'
  | 'Software & fees'
  | 'Freight';

export interface Vendor {
  id: string;
  name: string;
  kind: 'materials' | 'components' | 'resale' | 'services' | 'utilities' | 'property';
  terms: 'Due on receipt' | 'Net 15' | 'Net 30';
  phone?: string;
  account?: string;
  category: ExpenseCategory;
}

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  rate: number;
  itemId?: string;
  category: RevenueCategory;
  taxable: boolean;
}

/** FiberSteel's site takes cash, check, Venmo and PayPal for dock steps; card and ACH are the demo's other methods */
export type PaymentMethod = 'card' | 'check' | 'cash' | 'ach' | 'venmo' | 'paypal';

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  ref?: string;
}

/** Invoices and estimates share one shape (`kind`). */
export interface Invoice {
  id: string;
  kind: 'invoice' | 'estimate';
  customerId: string;
  jobId?: string;
  leadId?: string;
  dealerOrderId?: string;
  store: StoreId;
  issuedOn: string;
  /** Invoices: due date. Estimates: valid until. */
  dueOn: string;
  /** Paid / partial / overdue / expired are derived — see selectors.ts */
  status: 'draft' | 'sent' | 'void' | 'accepted' | 'declined';
  lines: InvoiceLine[];
  taxRate: number;
  payments: Payment[];
  memo?: string;
  sentAt?: string;
  salesperson?: string;
  remindedAt?: string;
  acceptedOn?: string;
  /** When it was last pushed to QuickBooks */
  syncedAt?: string;
}

export interface Bill {
  id: string;
  vendorId: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  amount: number;
  category: ExpenseCategory;
  store?: StoreId;
  status: 'open' | 'scheduled' | 'paid';
  paidOn?: string;
  scheduledOn?: string;
  memo?: string;
  poId?: string;
  syncedAt?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  kind: 'checking' | 'savings' | 'credit';
  mask: string;
  balance: number;
}

export interface BankTxn {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  match?: { kind: 'invoice' | 'bill' | 'payroll' | 'transfer' | 'deposit'; id?: string };
  reviewed: boolean;
}

export interface BooksState {
  /** Where the books are kept: here, or in QuickBooks with FiberSteel mode syncing to it */
  mode: 'in-house' | 'quickbooks';
  connected: boolean;
  company?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  autoSync: boolean;
  sync: Record<'customers' | 'items' | 'invoices' | 'payments' | 'bills', boolean>;
  mapping: { key: string; label: string; account: string }[];
  log: { id: string; at: string; level: 'ok' | 'warn' | 'error'; text: string }[];
}

export interface Notice {
  id: string;
  at: string;
  kind: 'lead' | 'job' | 'payment' | 'stock' | 'warranty' | 'dealer' | 'build' | 'sync' | 'system';
  text: string;
  href?: string;
  read: boolean;
}

/* ---------- Dealers (sample accounts — the real dealer list is in Website → Dealer list) ---------- */

export interface Dealer {
  id: string;
  name: string;
  city: string;
  state: string;
  /** Lakes or areas it serves */
  area: string;
  contact: string;
  phone: string;
  email: string;
  status: 'active' | 'prospect' | 'paused';
  since: string;
  /** Sample dealer discount off list */
  discount: number;
  /** The customer record its orders are invoiced to */
  customerId: string;
  notes?: string;
}

export type DealerOrderStatus = 'quote' | 'confirmed' | 'building' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

export interface DealerOrder {
  id: string;
  dealerId: string;
  placedOn: string;
  lines: { itemId: string; qty: number; rate: number }[];
  status: DealerOrderStatus;
  ship: 'pickup' | 'freight' | 'delivery';
  /** Promised ship date */
  shipOn?: string;
  shippedOn?: string;
  deliveredOn?: string;
  invoiceId?: string;
  jobIds: string[];
  notes?: string;
  by: string;
}

export interface Settings {
  taxRates: Record<StoreId, number>;
  terms: 'Due on receipt' | 'Net 15' | 'Net 30';
  invoiceFooter: string;
  /** Sample labor rate (the owner pays labor on warranty calls) */
  laborRate: number;
  /** "All service calls will be charged a $95 service fee after one year from the installation date" (Warranty page) */
  serviceFee: number;
  /** "Installations on the LOZ $200" (remotes page) */
  remoteInstall: number;
  forms: {
    /** Who new website requests are assigned to, per kind */
    routing: Record<LeadKind, string>;
    autoReply: boolean;
    autoReplyText: string;
    /** Where the real site would email each request, for the team to review */
    emailTo: Record<'sales' | 'service', string>;
  };
  notifications: Record<'newLead' | 'jobCompleted' | 'paymentReceived' | 'lowStock' | 'dailyDigest', boolean>;
  permissions: Record<Role, Section[]>;
  /** Editable business profile (defaults come from src/data/site.ts) */
  business?: { displayName: string; email: string; phone: string; servicePhone: string; website: string };
}

/* ---------- Website: installs, used lifts and dealer listings ---------- */

/** A photo added in FiberSteel mode. The image itself is kept in this browser's IndexedDB (`photo:<id>`). */
export interface PhotoMeta {
  id: string;
  /** What it shows, for people who can't see it */
  alt: string;
  caption?: string;
  /** Installs: a "before" shot of the slip or the old lift */
  before?: boolean;
  width: number;
  height: number;
  by: string;
  at: string;
}

/** An install posted for "Lifts we've installed": FiberSteel's photos of a finished lift, the town, the boat and the slip. */
export interface InstallPost {
  /** INS-… */
  id: string;
  title: string;
  /** One sentence for cards and search results */
  summary: string;
  /** What was asked for and what was built — paragraphs split by a blank line */
  story: string;
  /** Install kind (src/data/installs.ts) */
  kind: string;
  /** A lift size id (src/data/lifts.ts) */
  size?: string;
  boat: string;
  slip?: string;
  docking?: 'Back-in' | 'Straight pull-in';
  /** The town only — never the street */
  town: string;
  /** YYYY-MM */
  completed: string;
  /** "What was built for it" rows */
  built: string[];
  featured: boolean;
  status: 'published' | 'draft';
  /** The owner said yes to sharing the photos (town only, no address, faces or house numbers) */
  consent: boolean;
  jobId?: string;
  by: string;
  at: string;
}

/** A used-lift listing as staff write it */
export interface UsedListing {
  id: string;
  title: string;
  size: string;
  condition: string;
  includes: string[];
  status: 'available' | 'pending' | 'sold';
  /** Shown only if FiberSteel decides to list prices (the current site doesn't) */
  price?: number;
  showPrice: boolean;
  /** The repo's sample listing it replaces */
  replaces?: string;
  removed?: boolean;
  by: string;
  at: string;
}

/** A change to the public dealer list: an edit, a new dealer, or a hidden one */
export interface DealerListing {
  id: string;
  name: string;
  street?: string;
  city: string;
  state: string;
  zip?: string;
  /** Region, for a dealer listed by area rather than a town */
  area?: string;
  phones: string[];
  email?: string;
  web?: string | null;
  lake?: string;
  note?: string;
  hidden?: boolean;
  isNew?: boolean;
  by: string;
  at: string;
}

export interface WebsiteState {
  installs: Record<string, InstallPost>;
  installsLive: Record<string, InstallPost>;
  used: Record<string, UsedListing>;
  usedLive: Record<string, UsedListing>;
  dealers: Record<string, DealerListing>;
  dealersLive: Record<string, DealerListing>;
  /** Photos, by install or listing id, in order (the first one leads) */
  photos: Record<string, PhotoMeta[]>;
  /** The photos as last published (simulated), by install or listing id */
  photosLive?: Record<string, PhotoMeta[]>;
  /** Finished install jobs marked "not for the website": they stop showing as installs to post */
  skipped?: string[];
  /** Simulated publishes */
  publishes: { id: string; at: string; by: string; changes: number }[];
  /** "Lifts we've installed" shows on the public site (src/data/features.ts) */
  showcase: boolean;
}

/** Everything FiberSteel mode keeps — saved to IndexedDB as one document. */
export interface DB {
  version: number;
  /** Day the data was generated for. Dates shift forward when the demo is reopened later. */
  seededOn: string;
  /** Detailed records start here; older activity lives in the analytics history. */
  windowStart: string;
  counters: Record<string, number>;
  staff: Staff[];
  customers: Customer[];
  lifts: Lift[];
  claims: WarrantyClaim[];
  leads: Lead[];
  jobs: Job[];
  items: Item[];
  moves: StockMove[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  invoices: Invoice[];
  bills: Bill[];
  accounts: BankAccount[];
  txns: BankTxn[];
  books: BooksState;
  notices: Notice[];
  settings: Settings;
  dealers: Dealer[];
  dealerOrders: DealerOrder[];
  website: WebsiteState;
}

/* ---------- Analytics history ----------
 * Compact facts for the ~15 months before `windowStart`. Generated with the demo data and never edited. Reports
 * combine these with facts derived from the live records above.
 */

export interface JobFact {
  id: string;
  day: string;
  type: JobType;
  /** Lead first */
  crew: string[];
  /** Actual hours */
  hours: number;
  estHours: number;
  onTime: boolean;
  liftId?: string;
  /** Lift size id, for the service report */
  size?: string;
  component?: Component;
  /** Service and warranty: the problem, as an issue key (data/catalog.ts → issues) */
  issue?: string;
  /** This visit was a return trip for an earlier job */
  callback: boolean;
  callbackOf?: string;
  revenue: number;
}

export interface SaleFact {
  id: string;
  day: string;
  itemId: string;
  qty: number;
  revenue: number;
  cost: number;
  channel: 'direct' | 'dealer';
  dealerId?: string;
}

export interface LeadFact {
  id: string;
  day: string;
  source: LeadSource;
  kind: LeadKind;
  outcome: 'won' | 'lost' | 'closed' | 'open';
  /** Minutes from received to first contact (undefined for walk-ins and live calls) */
  responseMins?: number;
  value: number;
}

export interface MonthFact {
  month: string;
  /** Operating expenses (cost of goods is derived from sales) */
  opex: Partial<Record<ExpenseCategory, number>>;
}

export interface History {
  from: string;
  to: string;
  jobs: JobFact[];
  sales: SaleFact[];
  leads: LeadFact[];
  months: MonthFact[];
  /** Lifts in service at `from` that aren't in the customer registry, per size id */
  base: Record<string, number>;
}

/** Per-browser preferences (separate from the shared data). */
export interface UIState {
  signedIn: boolean;
  userId: string;
  /** Who signed out last in this browser: marked "Last used" on the sign-in screen */
  lastUserId?: string;
  store: StoreFilter;
  jobsView: 'board' | 'list' | 'schedule';
  range: RangeKey;
  rangeFrom?: string;
  rangeTo?: string;
  welcomeDismissed: boolean;
  /** "Things to try" checklist progress */
  tried: string[];
}

export type RangeKey = '30d' | '90d' | 'season' | 'ytd' | '12m' | 'custom';
