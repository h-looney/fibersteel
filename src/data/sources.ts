/**
 * The pages of FiberSteel's current website that the facts on this site come from (read once, 2026-11-10).
 * Every spec, price, warranty term and photo caption records one of these keys, so it can be re-checked.
 */
export const CHECKED = '2026-11-10';

export const sources = {
  home: { label: 'Home', url: 'https://lakeboatlifts.com/' },
  about: { label: 'About Us', url: 'https://lakeboatlifts.com/about-us' },
  contact: { label: 'Contact Us', url: 'https://lakeboatlifts.com/contact-us' },
  warranty: { label: 'Warranty', url: 'https://lakeboatlifts.com/warranty' },
  sizes: { label: 'Our lift sizes', url: 'https://lakeboatlifts.com/our-lift-sizes' },
  pwc: { label: 'PWC lifts', url: 'https://lakeboatlifts.com/pwc-lifts' },
  vbottom: { label: 'V-bottom & Cat-Hull', url: 'https://lakeboatlifts.com/v-bottom-%26-cat-hull-1' },
  pontoon: { label: 'Pontoons & Tri-toons', url: 'https://lakeboatlifts.com/pontoons-%26-tri-toons' },
  performance: { label: 'Performance Boats & Cruisers', url: 'https://lakeboatlifts.com/perfomance-boats-cruisers' },
  large: { label: 'Large Boats & Cruisers', url: 'https://lakeboatlifts.com/large-boats-%26-cruisers' },
  front: { label: 'Front mounted lifts', url: 'https://lakeboatlifts.com/front-mounted-lifts' },
  shallow: { label: 'Shallow water lifts', url: 'https://lakeboatlifts.com/shallow-water-lifts' },
  remotes: { label: 'Remote control blowers', url: 'https://lakeboatlifts.com/remote-control-blowers' },
  remotesPro: { label: 'Remote control blowers (Admiral Pro)', url: 'https://lakeboatlifts.com/remote-control-blowers-1' },
  blowerGuide: { label: 'Blower control use guide', url: 'https://lakeboatlifts.com/blower-control-use-guide-1' },
  dosDonts: { label: "Do's & Don'ts", url: 'https://lakeboatlifts.com/dos-%26-donts' },
  lakeInfo: { label: 'Local lake info', url: 'https://lakeboatlifts.com/local-lake-info' },
  vrbo: { label: 'Lakefront Vrbo', url: 'https://lakeboatlifts.com/lakefront-vrbo' },
  bikes: { label: 'E-LuX bikes', url: 'https://lakeboatlifts.com/e-lux-bikes' },
  used: { label: 'Used lifts', url: 'https://lakeboatlifts.com/used-lifts' },
  dealers: { label: 'Dealers', url: 'https://lakeboatlifts.com/dealers' },
  dockSteps: { label: 'Dock steps', url: 'https://lakeboatlifts.com/dock-steps-1' },
} as const;

export type SourceKey = keyof typeof sources;
