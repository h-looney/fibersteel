/**
 * The other things FiberSteel sells besides its lifts, as its current site lists them: Admiral remote control blower
 * systems, self-raising dock steps, and WaveArmor PWC docking stations. Prices appear only where the current site
 * shows them (each is on the README's questions list). Admiral and WaveArmor are other companies' products: their
 * photos are never copied — FiberSteel's own install photos and labelled placeholders stand in.
 */
import type { SourceKey } from './sources';

export interface PriceLine {
  label: string;
  price: number;
  note?: string;
}

/* ---------- Admiral remote control blower systems ---------- */

export const admiral = {
  name: 'Admiral remote control blower systems',
  maker: 'Admiral Remote Controls',
  /** Dealers + used-lifts pages: "models to fit ANY size boat lift and ANY Brand of Boat Lift!" */
  fitsAnyLift: { text: 'Models to fit any size boat lift and any brand of boat lift', src: 'dealers' as SourceKey },
  features: [
    { text: 'Very easy to use, install and program', src: 'remotesPro' },
    { text: '2 key fobs included, with a 3-second fob sync', src: 'remotes' },
    { text: 'Post mounted, to save dock space', src: 'remotes' },
    { text: 'Lift monitoring and a leak protection sensor included', src: 'remotes' },
    { text: 'Boarding leveling and an auto-up feature', src: 'remotes' },
    { text: 'Auxiliary lighting capable', src: 'remotesPro' },
    { text: 'Also available in solar-powered units', src: 'remotes' },
  ] satisfies { text: string; src: SourceKey }[],
  /** /remote-control-blowers: "1 valve...$2345 * 2 V...$2520 * 3 v...$2785 * 4 v...$ 2985 * A/B Split for 2 lifts...$2785" */
  prices: [
    { label: '1 valve', price: 2345 },
    { label: '2 valve', price: 2520 },
    { label: '3 valve', price: 2785 },
    { label: '4 valve', price: 2985 },
    { label: 'A/B split, for 2 lifts', price: 2785 },
  ] satisfies PriceLine[],
  pricesSrc: 'remotes' as SourceKey,
  install: { label: 'Installation on the Lake of the Ozarks', price: 200, src: 'remotes' as SourceKey },
  /** "Get an ADMIRAL A+ remote system for your lift for the ultimate in lift control with Bluetooth & WiFi!" */
  aPlus: { text: 'The Admiral A+, with a WiFi & Bluetooth app, for the ultimate in lift control', src: 'home' as SourceKey },
  /** How many valves, from FiberSteel's captions */
  valveNotes: [
    { text: '2-valve Admiral on a 14,000 lb or 16,000 lb lift', src: 'remotes' },
    { text: 'A double-valve system for lifts with 2 air tanks', src: 'remotes' },
    { text: 'A 3-valve Admiral system for 24,000 lb lifts', src: 'remotes' },
    { text: 'One controller for 2 different lifts', src: 'remotes' },
  ] satisfies { text: string; src: SourceKey }[],
  photos: ['remotes/2-valve-14000', 'remotes/1-controller-2-lifts', 'remotes/double-valve-2-tanks', 'remotes/3-valve-24000'],
  /** Old addresses: two near-identical pages on the GoDaddy site */
  oldPaths: ['/remote-control-blowers', '/remote-control-blowers-1'],
};

/* ---------- Self-raising floating dock steps ---------- */

export const dockSteps = {
  name: 'Self-raising floating dock steps',
  /** Home: "Self-raising Super Heavy Duty DOCK STEPS $2195" */
  tagline: { text: 'Self-raising, super heavy duty dock steps', src: 'home' as SourceKey },
  dimensions: [
    { label: 'Length', value: '7 ft' },
    { label: 'Width', value: '38 in.' },
    { label: 'Steps', value: '7' },
  ],
  uses: ['your dock', 'a seawall', 'a bulkhead', 'even a houseboat'],
  /** /dock-steps-1 */
  prices: [
    { label: 'Dock steps — cash, check or Venmo', price: 2195 },
    { label: 'Dock steps — paying online by card (PayPal)', price: 2350 },
    { label: 'Standard installation on the Lake of the Ozarks', price: 200 },
    { label: 'Shipping within the U.S.A.', price: 550, note: 'about — call to confirm shipping costs and delivery details' },
  ] satisfies PriceLine[],
  pricesSrc: 'dockSteps' as SourceKey,
  photos: ['docksteps/down', 'docksteps/raised', 'docksteps/pier-dock', 'docksteps/in-slip'],
  videos: ['eVFlWfieyfk', 'AR3ZCHHfERM'],
  oldPath: '/dock-steps-1',
};

/* ---------- WaveArmor PWC docking stations (PWC page) ---------- */

export const waveArmor = {
  name: 'WaveArmor PWC docking stations',
  facts: [
    { text: 'Drive-on style docking stations for personal watercraft', src: 'pwc' },
    { text: 'Comes in 5 ft and 6 ft wide models', src: 'pwc' },
    { text: 'Front mounted, with heavy-duty rollers for easy docking', src: 'pwc' },
    { text: 'Great for marinas and private docks', src: 'pwc' },
  ] satisfies { text: string; src: SourceKey }[],
};

export const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
