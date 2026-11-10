/**
 * FiberSteel's warranty, as its current Warranty page states it (read 2026-11-10). The summary table is the same
 * terms in plain words; `terms` is the full text, lightly tidied (spelling and capitals) without changing its meaning.
 */
export const coverage = [
  { part: 'Polyethylene tanks', term: 'Lifetime', detail: 'To the original purchaser, for as long as they own it' },
  { part: 'Lift frame', term: 'Lifetime', detail: 'To the original purchaser, for as long as they own it' },
  { part: 'Hot-dipped galvanized parts', term: '5 years', detail: 'All of them, to the original purchaser' },
  { part: 'Blower controller, bushings and hose', term: '3 years', detail: 'To the original purchaser' },
];

export const keyPoints = [
  'The warranty covers the cost of the part only, and is valid only if FiberSteel installed the lift.',
  'The owner pays the service call charge and any labor.',
  'All service calls are charged a $95 service fee after one year from the installation date.',
  'Lifts installed by FiberSteel dealers outside the Lake of the Ozarks area: please check with your local dealer for warranty coverage.',
  "It doesn't cover damage to boats, docks, boat covers or accessories.",
];

/** The full warranty, as written on the current site */
export const terms = [
  'FiberSteel Boat Lifts, LLC (FS) will provide a LIFETIME warranty on the polyethylene TANKS and lift FRAME to the original purchaser for as long as it is owned by the original purchaser.',
  '5-year warranty on ALL hot-dipped galvanized parts; 3-year warranty on the blower controller, bushings and hose, to the original purchaser for as long as it is owned by the original purchaser.',
  'The warranty is to cover the cost of the part only, and is valid only if installed by FiberSteel. The owner will be responsible for the service call charge and any labor charges. This warranty shall become effective only upon proof of evidence of original ownership.',
  'All warranty decisions are to be approved by an authorized FS representative. The obligation of FS under this warranty shall be limited to the repair or replacement of any part which is judged defective by FS.',
  'In addition, FS will not be liable for any inconvenience, loss of time, loss of income, or any other special consequential damages of any kind or nature, including lifting a boat other than what the original use was set up for.',
  'The purchaser is responsible for all transportation costs.',
  "Improper use, abnormal conditions, acts of God, or operating the lift contrary to the manufacturer's instructions are excluded from warranty claims.",
  'This is the complete FS warranty. FS, or anyone on our behalf, authorizes no other warranties, either expressed or implied.',
  'Please note: the warranty does not cover damage to boats, docks, boat covers or accessories.',
  'For lifts installed by FS dealers outside the Lake of the Ozarks area, please check with your local dealer for warranty coverage.',
  'All service calls will be charged a $95 service fee after one year from the installation date.',
];

/** Remote systems whose warranty another company handles (Warranty page) */
export const remoteWarranty = [
  { system: 'FirstMate remote control blower systems', who: 'AquaLogic Marine, LLC / FirstMate Remote Controls', phone: '866-570-9707', note: 'Warranties are covered and serviced by them — please call for service or warranty issues.' },
  { system: "Captain's Choice remote systems", who: "Captain's Choice Service Dept.", phone: '573-216-0630', note: 'All work and warranties are covered and handled by them.' },
];

/** The cancellation policy (Warranty page) */
export const cancellation =
  'A re-stocking fee of 20% of the order total, plus the labor costs incurred, will be charged or retained for orders canceled or voided by the purchaser for any reason within 5 (five) days of the scheduled installation, according to the installation crew’s current schedule. These charges also apply to orders canceled by the purchaser, or rejected by FiberSteel management, because of unknown, unrevealed or false information that prevents the successful installation and performance of the merchandise.';

export const serviceFee = { amount: 95, after: 'one year from the installation date' };
