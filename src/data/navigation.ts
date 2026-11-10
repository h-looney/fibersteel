import { liftTypes, liftTypeHref } from './lifts';
import { withBase } from '../scripts/url';

export interface NavLink {
  label: string;
  href: string;
  description?: string;
  /** Shown only while this part of the site is switched on (src/data/features.ts) */
  feature?: 'installs';
}

export interface NavItem {
  label: string;
  href: string;
  feature?: 'installs';
  featureOff?: 'installs';
  /** Mega menu (lifts) */
  mega?: boolean;
  children?: NavLink[];
}

/** The lifts mega menu: by boat type, then sizes and add-ons */
export const liftColumns = [
  {
    name: 'Lifts by boat type',
    links: liftTypes.map((t) => ({ label: t.name, href: withBase(liftTypeHref(t.slug)) })),
  },
  {
    name: 'Sizes & add-ons',
    links: [
      { label: 'Lift sizes', href: withBase('/lifts/sizes/') },
      { label: 'Lift size calculator', href: withBase('/lifts/sizes/#calculator') },
      { label: 'Parts & features', href: withBase('/lifts/sizes/#parts') },
      { label: 'Remote controls', href: withBase('/remotes/') },
      { label: 'Dock steps', href: withBase('/dock-steps/') },
    ],
  },
];

// The menu groups follow the current site's (Lift sizes & …, Remotes+, Used lifts, Dealers, Dock steps, Contact Us+)
export const mainNav: NavItem[] = [
  { label: 'Lifts', href: withBase('/lifts/'), mega: true },
  { label: 'Our installs', href: withBase('/installs/'), feature: 'installs' },
  {
    label: 'Owners',
    href: withBase('/owners/'),
    children: [
      { label: 'Request service or parts', href: withBase('/service/'), description: 'Repairs, parts and service calls.' },
      { label: 'Warranty', href: withBase('/warranty/'), description: 'Lifetime on tanks and frame.' },
      { label: 'Register your warranty', href: withBase('/warranty/register/'), description: 'Keep your proof of ownership on file.' },
      { label: 'Blower control guide', href: withBase('/owners/blower-guide/'), description: 'Single- and double-valve blower boxes.' },
      { label: 'Do’s & Don’ts', href: withBase('/owners/dos-and-donts/'), description: 'The basic rules for lift use.' },
      { label: 'Remote controls', href: withBase('/remotes/'), description: 'Admiral remote blower systems.' },
    ],
  },
  { label: 'Used lifts', href: withBase('/used-lifts/') },
  { label: 'Dock steps', href: withBase('/dock-steps/') },
  {
    label: 'Dealers',
    href: withBase('/dealers/'),
    children: [
      { label: 'Find a dealer', href: withBase('/dealers/'), description: 'Factory direct, or a dealer near you.' },
      { label: 'Become a dealer', href: withBase('/dealers/become-a-dealer/'), description: 'Dealerships available.' },
    ],
  },
  {
    label: 'About',
    href: withBase('/about/'),
    children: [
      { label: 'About FiberSteel', href: withBase('/about/'), description: 'We design, build, install & service our lifts.' },
      { label: 'Lifts we’ve installed', href: withBase('/installs/'), description: 'Our lifts on the water.', feature: 'installs' },
      { label: 'Contact us', href: withBase('/contact/'), description: 'Sales, service and directions.' },
    ],
  },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: 'Lifts',
    links: [
      ...liftTypes.map((t) => ({ label: t.name, href: withBase(liftTypeHref(t.slug)) })),
      { label: 'Lift sizes & calculator', href: withBase('/lifts/sizes/') },
    ],
  },
  {
    title: 'Owners',
    links: [
      { label: 'Request service or parts', href: withBase('/service/') },
      { label: 'Warranty', href: withBase('/warranty/') },
      { label: 'Register your warranty', href: withBase('/warranty/register/') },
      { label: 'Blower control guide', href: withBase('/owners/blower-guide/') },
      { label: 'Do’s & Don’ts', href: withBase('/owners/dos-and-donts/') },
      { label: 'Remote controls', href: withBase('/remotes/') },
    ],
  },
  {
    title: 'FiberSteel',
    links: [
      { label: 'About us', href: withBase('/about/') },
      { label: 'Lifts we’ve installed', href: withBase('/installs/'), feature: 'installs' },
      { label: 'Used lifts', href: withBase('/used-lifts/') },
      { label: 'Dock steps', href: withBase('/dock-steps/') },
      { label: 'Find a dealer', href: withBase('/dealers/') },
      { label: 'Become a dealer', href: withBase('/dealers/become-a-dealer/') },
      { label: 'Get a quote', href: withBase('/quote/') },
      { label: 'Contact us', href: withBase('/contact/') },
    ],
  },
  {
    // The current site's side topics, kept out of the main path
    title: 'Around the lake',
    links: [
      { label: 'Local lake info', href: withBase('/lake-info/') },
      { label: 'Lakefront rental (Vrbo)', href: withBase('/lakefront-rental/') },
      { label: 'E-LuX bikes', href: withBase('/e-lux-bikes/') },
    ],
  },
];
