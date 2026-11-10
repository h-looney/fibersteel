/**
 * The side topics FiberSteel's current site carries: local lake info, a lakefront Vrbo rental and E-LuX bikes.
 * They're kept (so the site still has everything it had), linked from the footer and the "More" menu rather than the
 * main path. Each is on the README's questions list: keep it, move it, or drop it?
 */

export const lakeInfo = {
  links: [
    {
      title: 'Lake of the Ozarks: management phone numbers and departments',
      text: 'Ameren Missouri runs the lake. Its Lake of the Ozarks pages list who to call, permits and shoreline management.',
      href: 'https://www.ameren.com/property/lake-of-the-ozarks',
      label: "Ameren's Lake of the Ozarks page",
    },
    {
      title: 'Lake levels and operations',
      // The current site's lake-level link now lands on Ameren's permitting page — question for FiberSteel
      text: 'Lake level information is on Ameren’s Lake of the Ozarks pages.',
      href: 'https://www.ameren.com/property/lake-of-the-ozarks',
      label: 'Lake information at Ameren',
    },
  ],
  /** The current page's boating safety tips, tidied */
  boating: [
    'Take a safe boating course.',
    'Check your boat for all the required safety equipment.',
    'Consider the size of your boat, the number of passengers and the extra equipment on board. Don’t overload the boat.',
    'In a powerboat, check the electrical and fuel systems for gas fumes, and follow the manufacturer’s procedures before starting the engine.',
    'Wear your life jacket — don’t just carry one on board.',
    'Leave the alcohol behind.',
    'Check the weather forecast.',
    'File a float plan with a family member or friend.',
  ],
  swimming: [
    'Learn to swim well — most people who drown never meant to be in the water.',
    'Never rely on toys like inner tubes and water wings to stay afloat.',
    'Don’t overestimate your swimming skills.',
    'Swim only in designated swimming areas, and never swim alone.',
    'Never dive into lakes and rivers: rocks, debris and current hide under the surface, even in shallow water.',
    'It only takes a few seconds for a small child to wander away. Children have a natural curiosity about water.',
  ],
  coldWater: [
    'Wear a life jacket and dress for the water temperature, not the air temperature.',
    'Cold water causes involuntary gasping — the first shock is the most dangerous. Stay calm and get your breathing under control.',
    'If you can’t get out of the water within 5–15 minutes, stop moving to save energy and body heat.',
  ],
};

export const rental = {
  name: "G & G's Lakehouse",
  title: 'Ozark lakefront vacation home — sleeps 8, private dock',
  vrbo: 'https://www.vrbo.com/2208170',
  photo: 'side/lakehouse',
};

export const bikes = {
  title: 'E-LuX electric bikes',
  tagline: 'Get on that bike and have some fun again!',
  /** The models in the brochure scans on the current page (from their file names) */
  models: ['Tahoe Classic (step-through)', 'Newport Classic (step-through)', 'Sierra (folding, fat tire)'],
};
