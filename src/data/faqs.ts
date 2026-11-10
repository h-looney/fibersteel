/**
 * Questions people ask about boat lifts, answered only with what FiberSteel's current site says (no new claims).
 * Used on the home page and the lift pages, and as FAQPage structured data. Links use withBase-free paths and are
 * rewritten by FaqList.
 */
export interface Faq {
  id: string;
  q: string;
  /** May contain simple HTML links (root-relative) */
  a: string;
}

export const faqs: Faq[] = [
  {
    id: 'size',
    q: 'How do I find the lift size I need?',
    a: 'Add up your boat’s dry weight, its fuel weight (7 lb per gallon) and 2,000 lb for boats up to 30 ft long (3,000 lb for larger boats). That’s the lift size you need. The <a href="/lifts/sizes/#calculator">lift size calculator</a> does the math — or call us at 573-346-3088 for help.',
  },
  {
    id: 'quote',
    q: 'What do you need to know to quote a lift?',
    a: 'Your boat’s brand, model, length and weight, and your dock slip’s size (width × length). The <a href="/quote/">quote request</a> asks for exactly that.',
  },
  {
    id: 'shallow',
    q: 'Do FiberSteel lifts work in shallow water?',
    a: 'Yes. FiberSteel builds shallow-water lifts whose poly tanks are only 20 to 24 inches deep, like its special-built 8,000 lb shallow-water lift with 20 inch deep tanks. See <a href="/lifts/shallow-water/">shallow-water lifts</a>.',
  },
  {
    id: 'tanks',
    q: 'Why square poly tanks instead of round air tanks?',
    a: 'Docks, marinas and floating structures that need strength, stability and durability use box-style flotation. FiberSteel says round “log” tanks don’t spread the weight and stresses as well, need more steel in the water to hold them in place, and need deeper water. FiberSteel lifts have virtually no metal parts in the water.',
  },
  {
    id: 'warranty',
    q: 'What does the warranty cover?',
    a: 'A lifetime warranty on the polyethylene tanks and the lift frame, 5 years on all hot-dipped galvanized parts, and 3 years on the blower controller, bushings and hose — to the original purchaser, for lifts installed by FiberSteel. It covers the cost of the part. See the <a href="/warranty/">full warranty</a>.',
  },
  {
    id: 'where',
    q: 'Where do you install?',
    a: 'FiberSteel serves the Lake of the Ozarks and all of Missouri, or can ship to you. Authorized dealers sell FiberSteel lifts in other states — <a href="/dealers/">find a dealer</a>. Used lifts are installed only on the Lake of the Ozarks.',
  },
  {
    id: 'remote',
    q: 'Can I add a remote control to my lift?',
    a: 'Yes. FiberSteel sells and installs Admiral remote control blower systems, with models to fit any size and any brand of boat lift. Installation on the Lake of the Ozarks is $200. See <a href="/remotes/">remote controls</a>.',
  },
  {
    id: 'service-fee',
    q: 'Is there a charge for a service call?',
    a: 'All service calls are charged a $95 service fee after one year from the installation date. Under the warranty, the owner pays the service call charge and any labor. <a href="/service/">Request service</a>.',
  },
];

export const getFaqs = (ids: string[]) => ids.map((id) => faqs.find((f) => f.id === id)!).filter(Boolean);
