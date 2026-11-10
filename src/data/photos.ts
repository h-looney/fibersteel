/**
 * FiberSteel's own photos, from its current website (FiberSteel's photos and logo are used for this concept; no
 * other brand's images are copied). Each one is described for screen readers (`alt`: what's visible) and keeps
 * FiberSteel's own caption as published (`caption`, typos fixed), with the page it came from (`source`).
 *
 * The files live in src/assets/photos/<group>/<name>.jpg (re-saved at ≤1600 px with their metadata stripped);
 * the id is that path without ".jpg". `npm test` checks that every file has an entry and every entry a file.
 */
import type { ImageMetadata } from 'astro';
import type { SourceKey } from './sources';

export interface PhotoInfo {
  alt: string;
  /** FiberSteel's caption from its current site, if it had one */
  caption?: string;
  source: SourceKey;
  /** CSS object-position for crops */
  position?: string;
}

export interface SitePhoto extends PhotoInfo {
  id: string;
  src: ImageMetadata;
}

export const photoInfo: Record<string, PhotoInfo> = {
  // ---------- About & home ----------
  'about/boat-show-booth': { alt: 'A FiberSteel Boat Lifts display at an indoor boat show, with a lift frame, banners and brochures', source: 'dealers' },
  'home/triple-outboards': { alt: 'A large center-console boat with three outboard motors, raised on a FiberSteel lift under a covered dock', source: 'home' },

  // ---------- PWC ----------
  'pwc/single-pwc': { alt: 'A single PWC lift in an empty slip, with walk boards on both sides', caption: 'Single PWC lift: walk boards on both sides, a 1,500 lb polyethylene tank, and a bow-end poly float, so no drop chains or cables are needed', source: 'pwc' },
  'pwc/single-drive-on-up': { alt: 'A FiberSteel drive-on PWC lift raised beside a dock, in front of a bluff', caption: 'Single drive-on FiberSteel PWC lift, shown in the up position (1,500 lb air tank)', source: 'pwc' },
  'pwc/drive-on-down': { alt: 'A drive-on PWC lift lowered into the water beside a dock', caption: 'Drive-on style FiberSteel PWC lift, shown in the down position — just drive your watercraft right up on it', source: 'pwc' },
  'pwc/twin-set': { alt: 'Two covered personal watercraft side by side on a FiberSteel twin PWC lift set', caption: 'FiberSteel exclusive design twin PWC lift set: each lift is operated independently from a single blower controller box', source: 'pwc' },
  'pwc/twin-set-2': { alt: 'Two personal watercraft under blue covers, raised on a twin PWC lift set', caption: 'FiberSteel exclusive design twin PWC lift set — each lift is operated independently from a single blower controller box mounted on your dock', source: 'pwc' },
  'pwc/double-pwc': { alt: 'Two watercraft side by side on one double PWC lift', caption: 'Double PWC lift, for 2 watercraft on the same lift — front mounted, straight drive-on style', source: 'pwc' },
  'pwc/double-bow-post': { alt: 'The front bow stop post of a double PWC lift, with a bumper and a cleat', caption: 'Double PWC lift with a front bow stop post, post bumper and cleat', source: 'pwc' },
  'pwc/front-mounted-pwc': { alt: 'A front-mounted PWC lift holding a watercraft at the end of a dock', caption: 'FiberSteel front-mounted PWC lift — can be mounted almost anywhere on a dock', source: 'pwc' },
  'pwc/mounting-brackets': { alt: 'Close-up of the galvanized steel brackets that attach a PWC lift to a dock frame', caption: 'Strong steel mounting brackets for a secure attachment to the frame of the dock', source: 'pwc' },
  'pwc/economy-double': { alt: 'Two covered watercraft on an economy double PWC lift beside a wooden dock', caption: 'Economy model double PWC lift: no front bow posts and less decking, built to hold 2 watercraft', source: 'pwc' },

  // ---------- V-bottom & cat-hull ----------
  'vbottom/16000-with-guides': { alt: 'A white cruiser raised on a FiberSteel lift between guide posts, with the lake behind', caption: '16,000 lb lift with FiberSteel lift guides', source: 'vbottom', position: '50% 40%' },
  'vbottom/16000-chris-craft-corsair': { alt: 'A Chris-Craft runabout raised on a FiberSteel lift in a covered slip', caption: '16,000 lb lift with a 28 ft Chris-Craft Corsair — a very heavy boat for its size', source: 'vbottom' },
  'vbottom/16000-14ft-double-walkboards': { alt: 'A covered boat on a lift in a narrow slip, with walk boards mounted on both sides of the lift', caption: '16,000 lb lift installed in a 14 ft wide slip, with lift-mounted double walk boards', source: 'vbottom' },
  'vbottom/16000-12ft-slip': { alt: 'The stern of a twin-engine boat raised on a lift in a narrow slip', caption: '16,000 lb lift installed in a 12 ft wide slip', source: 'vbottom' },
  'vbottom/16000-post-walkboards': { alt: 'A boat under a purple cover on a lift with walk boards on posts', caption: '16,000 lb lift installed in a 16 ft wide slip, with post-mounted walk boards', source: 'vbottom' },
  'vbottom/10000-16ft-offset': { alt: 'A covered boat raised on a lift set to one side of a wide slip', caption: '10,000 lb lift installed in a 16 ft wide slip, offset', source: 'vbottom' },
  'vbottom/10000-lift': { alt: 'A covered boat on a FiberSteel lift under a dock roof', caption: 'FiberSteel 10,000 lb lift', source: 'vbottom' },
  'vbottom/10000-tall-bunks-ski-boat': { alt: 'A ski boat on a lift with tall bunks that clear its inboard drive', caption: '10,000 lb lift with extra-tall bunks for an inboard-drive ski boat', source: 'vbottom' },
  'vbottom/8000-tall-bunks-ski-boat': { alt: 'The bow of a blue ski boat on an 8,000 lb lift, seen from the front', caption: '8,000 lb lift with extra-tall bunks for an inboard-drive ski boat', source: 'vbottom' },
  'vbottom/8000-lift': { alt: 'A boat under a red cover on an 8,000 lb lift in a covered slip', caption: '8,000 lb lift', source: 'vbottom' },
  'vbottom/14000-6-arm': { alt: 'A cruiser seen bow-on, raised on a 14,000 lb lift', caption: '14,000 lb lift: 6 arms, 3 axles, 2 polyethylene tanks', source: 'vbottom' },

  // ---------- Pontoons & tri-toons ----------
  'pontoon/6800-pontoon-bunks': { alt: 'A new lift with long pontoon bunks, sitting on gravel in the FiberSteel yard', caption: '6,800 lb lift with pontoon bunks', source: 'pontoon' },
  'pontoon/flat-deck-shallow': { alt: 'Looking down a covered slip at a lift with flat-deck bunks just under the water', caption: 'Flat-deck style bunks on a pontoon boat lift in shallow water', source: 'pontoon' },
  'pontoon/manitou-tritoon-bunks': { alt: 'Tri-toon bunks on a lift in the yard, with the center bunk set lower than the outer two', caption: 'FiberSteel bunks for a Manitou tri-toon whose center pontoon sits 5.25 in. lower than the other two', source: 'pontoon' },
  'pontoon/tritoon-low-center': { alt: 'A tri-toon lift whose center bunk hangs lower than the two outer bunks', caption: 'A FiberSteel tri-toon lift built for a boat whose center pontoon hangs lower than the two outer pontoons', source: 'pontoon' },
  'pontoon/tritoon-lowering': { alt: 'A lift with three long bunks lowering into the water in a slip', caption: 'FiberSteel lift with tri-toon bunks, lowering into the water', source: 'pontoon' },
  'pontoon/combo-bunks': { alt: 'A lift in the yard with both pontoon bunks and V-bunks', caption: 'Custom-built lift with FiberSteel combo bunks, for pontoons, tri-toons and V-hull boats', source: 'pontoon' },
  'pontoon/6800-flat-deck': { alt: 'A lift with flat-deck pontoon bunks in a slip, next to its blower box', caption: '6,800 lb boat lift with flat-deck style pontoon bunks', source: 'pontoon' },
  'pontoon/flat-deck-bunks': { alt: 'Flat-deck bunks across a lift in a covered slip', caption: 'Flat-deck bunks for most pontoons, tri-toons, jon boats, paddle boats, canoes and kayaks', source: 'pontoon' },
  'pontoon/under-deck-bunks': { alt: 'The underside of a pontoon boat resting on under-deck bunks', caption: 'Under-deck bunks for most pontoons and tri-toons', source: 'pontoon' },
  'pontoon/offset-16ft-slip': { alt: 'A pontoon boat under a red cover on a lift set to one side of its slip', caption: 'Pontoon or tri-toon boat on a lift that is offset in a 16 ft wide dock slip', source: 'pontoon' },
  'pontoon/tritoon-lift': { alt: 'A FiberSteel tri-toon lift on gravel in the yard, ready to go', caption: 'FiberSteel tri-toon lift', source: 'pontoon' },

  // ---------- Performance & cruisers ----------
  'performance/14000-back-in-walkboards': { alt: 'An empty lift in a wide slip, with walkboards down both sides and a remote control box on the dock', caption: '14,000 lb lift set up for back-in docking in a 16 ft wide slip, with premium walkboards on both sides and an Admiral remote control blower system', source: 'performance', position: '50% 60%' },
  'performance/2-valve-admiral-14000': { alt: 'A large boat with three outboard motors on a lift, next to a remote control box on the dock', caption: '2-valve Admiral remote on a 14,000 lb lift', source: 'remotes' },
  'performance/16000-lift': { alt: 'An empty 16,000 lb lift raised in a slip, with its hoses running to the dock', caption: '16,000 lb boat lift', source: 'performance' },
  'performance/14000-14ft-slip': { alt: 'A white runabout raised on a lift in a narrow slip', caption: '14,000 lb lift in a 14 ft wide slip', source: 'performance' },
  'performance/14000-back-in-offset': { alt: 'A performance boat backed in on a lift, its drives facing the dock', caption: '14,000 lb lift set up for back-in docking in a 14 ft slip, offset in the slip for easy boarding', source: 'performance' },
  'performance/20000-12ft-slip': { alt: 'A cruiser on a lift fitted tightly into a narrow slip', caption: 'A very tight squeeze: this 20,000 lb lift was custom fitted in a 12 ft wide slip, with extra-long back-in lift arms', source: 'performance' },
  'performance/10000-tall-bunks-back-in': { alt: 'A wake boat raised on a lift with tall bunks, backed into its slip', caption: '10,000 lb lift built with extra-tall bunks for the inboard drive and extra-long lift arms for back-in docking', source: 'performance' },

  // ---------- Large boats & cruisers ----------
  'large/24000-chris-craft-back-in': { alt: 'A dark-hulled cruiser on a 24,000 lb lift in a covered slip, seen from the side', caption: '24,000 lb lift in a 16 ft wide slip, installed for this Chris-Craft as a back-in', source: 'performance' },
  'large/24000-chris-craft-2': { alt: 'A boat with three outboard motors backed in on a lift in a covered slip', caption: '24,000 lb lift in a 16 ft wide slip, installed for this Chris-Craft as a back-in', source: 'performance' },
  'large/24000-back-in-16ft': { alt: 'A dark-blue cruiser raised on a lift, seen from the bow', caption: '24,000 lb lift in a 16 ft wide slip, installed as a back-in', source: 'large' },
  'large/24000-back-in-16ft-2': { alt: 'An empty 24,000 lb lift with a wide frame, raised in a covered slip', caption: '24,000 lb lift installed as a back-in, in a 16 ft wide slip', source: 'large' },
  'large/24000-back-in': { alt: 'A large cruiser on a lift at the end of a long covered dock', caption: '24,000 lb lift installed as a back-in style lift', source: 'large' },
  'large/24000-nor-tech': { alt: 'A long performance boat raised on a lift in a covered slip, seen from the stern', caption: '24,000 lb lift in a 14 ft wide slip, for a 53 ft Nor-Tech', source: 'large' },
  'large/16000-lift-guides': { alt: 'Looking down a slip at a boat bow raised on a lift between guide posts', caption: '16,000 lb lift installed in a 14 ft wide slip as a straight pull-in, with FiberSteel lift guides', source: 'large' },
  'large/16000-straight-pull-in': { alt: 'A cruiser with a navy hull raised on a lift in a covered slip', caption: '16,000 lb lift installed in a 16 ft wide slip as a straight pull-in', source: 'large' },
  'large/16000-tall-bunks-grand-lake': { alt: 'A cruiser on a lift with tall bunks at an open dock on a wide lake', caption: '16,000 lb lift installed with extra-tall bunks for inboard drives, on Grand Lake, Oklahoma', source: 'large' },

  // ---------- Front-mounted ----------
  'front/6800-front-mounted': { alt: 'A white bowrider raised on a front-mounted lift beside a dock', caption: 'Super strong front-mounted lift with a 6,800 lb poly tank', source: 'front' },
  'front/6800-front-mounted-2': { alt: 'A front-mounted lift frame and poly tank in front of the green FiberSteel shop building', caption: 'Super strong front-mounted lift with a 6,800 lb poly tank', source: 'front' },
  'front/6800-front-mounted-3': { alt: 'A front-mounted lift with its poly tank, ready to install, in the yard', caption: 'Super strong front-mounted lift with a 6,800 lb poly tank', source: 'front' },
  'front/catamaran-sailboat': { alt: 'A small front-mounted lift with flat bunks in the water at a wooden dock', caption: 'Custom front-mounted lift with a 2,000 lb poly tank, built for a small catamaran sailboat', source: 'front' },
  'front/pwc-set': { alt: 'Two front-mounted PWC lifts side by side at the end of a dock', caption: 'Front-mounted PWC lift set: each lift has a 1,500 lb poly tank and works independently', source: 'front' },
  'front/diagram': { alt: 'A 3D drawing of a front-mount boat lift: two long arms run from upright brackets on the dock out to a frame with bunks over a poly tank', caption: 'Diagram of a front-mount boat lift', source: 'front' },

  // ---------- Shallow water ----------
  'shallow/8000-shallow-bow': { alt: 'A shallow-water lift on gravel, seen from the bow end, with low tanks under the frame', caption: "FiberSteel's special-built 8,000 lb shallow-water lift, with 20 inch deep tanks", source: 'shallow' },
  'shallow/8000-shallow-v-bunks': { alt: 'A shallow-water lift with V-bunks in a covered slip', caption: "FiberSteel's special-built 8,000 lb shallow-water lift with V-bunks", source: 'shallow' },
  'shallow/8000-shallow-2': { alt: 'A shallow-water lift frame with low black tanks, sitting on gravel', caption: "FiberSteel's special-built 8,000 lb shallow-water lift", source: 'shallow' },
  'shallow/8000-shallow-3': { alt: 'A shallow-water lift with long bunks and low tanks, waiting in the yard', caption: "FiberSteel's special-built 8,000 lb shallow-water lift", source: 'shallow' },
  'shallow/6000-shallow': { alt: 'A shallow-water lift with crossbars, in the water beside a dock', caption: 'FiberSteel 6,000 lb shallow-water lift', source: 'shallow' },
  'shallow/6000-shallow-flat-deck': { alt: 'A shallow-water lift with flat-deck bunks in a slip', caption: 'FiberSteel 6,000 lb shallow-water lift with flat-deck style bunks', source: 'shallow' },
  'shallow/6000-shallow-pontoon': { alt: 'A shallow-water lift with flat bunks for a pontoon boat, in a slip', caption: 'FiberSteel 6,000 lb shallow-water lift with flat bunks for pontoons and some tri-toons', source: 'shallow' },

  // ---------- Parts & features ----------
  'parts/bushing-assembly': { alt: 'Close-up of a black poly bushing on a stainless bolt with washers and a locking nut', caption: 'Polyethylene and stainless steel bushing assembly with a stainless steel Nylock locking nut', source: 'sizes' },
  'parts/tank-shut-off-valve': { alt: 'A brass valve with a red handle on top of a lift tank, with a black hose attached', caption: 'FiberSteel tank shut-off valve assembly', source: 'sizes' },
  'parts/hull-protectors': { alt: 'A black poly hull protector fitted over the end of a lift arm', caption: "FiberSteel's exclusive black poly hull protectors on the lift arms, to protect the hull from bumping into the lift-arm or dock-bracket hardware", source: 'sizes' },
  'parts/tritoon-riser-brackets': { alt: 'A tall galvanized bunk bracket under a carpeted pontoon bunk', caption: 'Extra-tall bunk brackets for tri-toons with extra-deep center pontoons, like Manitou tri-toons whose center pontoon is 5¼ in. lower', source: 'sizes' },
  'parts/lift-guides': { alt: 'Upright guide posts beside a boat on a lift', caption: 'FiberSteel lift guides', source: 'sizes' },
  'parts/pwc-dock-bracket': { alt: 'A galvanized PWC dock bracket standing on a shop floor', caption: 'PWC lift mounting dock bracket', source: 'sizes' },
  'parts/pwc-dock-bracket-stop': { alt: 'A galvanized PWC dock bracket with a stop plate', caption: 'PWC dock bracket with stop', source: 'sizes' },
  'parts/front-mount-bracket': { alt: 'The bracket where a front-mounted lift attaches to a dock', caption: 'Front-mounted lift attachment bracket with a poly bushing', source: 'sizes' },
  'parts/v-brace': { alt: 'A carpeted V-shaped brace at the bow end of a lift', caption: 'V-brace bunk at the bow end, for extra support under some boats', source: 'large' },
  'parts/bunk-brackets-v-bunks': { alt: 'The hull of a boat resting on V-bunks and brackets, seen from below the bow', caption: 'FiberSteel bunk brackets: standard V-bunks and bow V-brace', source: 'vbottom' },

  // ---------- Remotes (FiberSteel's photos of lifts it fitted with Admiral remotes) ----------
  'remotes/3-valve-24000': { alt: 'A boat with an orange hull at the far end of a covered slip, on a large lift', caption: '3-valve Admiral system for 24,000 lb lifts', source: 'remotes' },
  'remotes/1-controller-2-lifts': { alt: 'One remote control box on a post between two lifts in neighboring slips', caption: '1 controller for 2 different lifts', source: 'remotes' },
  'remotes/double-valve-2-tanks': { alt: 'A remote control box on a post beside an empty lift with two tanks', caption: 'Double-valve system for lifts with 2 air tanks', source: 'remotes' },
  'remotes/2-valve-14000': { alt: 'A boat under a red cover on a lift, with a remote control box on a post', caption: '2-valve Admiral on a 14,000 lb lift', source: 'remotes' },

  // ---------- Dock steps ----------
  'docksteps/raised': { alt: 'Galvanized dock steps folded up beside a dock', caption: 'Dock steps shown in the raised position', source: 'dockSteps' },
  'docksteps/down': { alt: 'Dock steps lowered into the water from a dock, with handrails', caption: 'Easy access in and out of the water from your dock, seawall, bulkhead or even a houseboat — and your pets too. Shown in the down position', source: 'dockSteps' },
  'docksteps/pier-dock': { alt: 'Dock steps at the end of a pier-style dock in front of a lake house', caption: 'Dock steps mounted on a pier-style dock', source: 'dockSteps' },
  'docksteps/in-slip': { alt: 'Dock steps lowered into a slip next to a kayak', caption: 'Dock steps mounted in a dock slip', source: 'dockSteps' },

  // ---------- Side topics ----------
  'side/lakehouse': { alt: "Aerial view of G & G's Lakehouse, a two-story lake home with a deck and a lawn", caption: "G & G's Lakehouse, on the Lake of the Ozarks", source: 'vrbo' },
};

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/**/*.jpg', { eager: true });
const byId = new Map(
  Object.entries(files).map(([path, mod]) => [path.replace('../assets/photos/', '').replace(/\.jpg$/, ''), mod.default]),
);

/** The ids of every photo file (for checks) */
export const photoFileIds = () => [...byId.keys()];

/** A photo by id ("pwc/single-pwc"); throws at build time if it doesn't exist, so a typo can't ship. */
export function photo(id: string): SitePhoto {
  const src = byId.get(id);
  const info = photoInfo[id];
  if (!src || !info) throw new Error(`Unknown photo "${id}" — add it to src/assets/photos and src/data/photos.ts`);
  return { id, src, ...info };
}

export const photos = (ids: string[]) => ids.map(photo);
