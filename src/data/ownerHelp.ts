/**
 * Owner help: FiberSteel's Do's & Don'ts (published on the current site only as a picture of text, ©DMP'08 —
 * transcribed here so screen readers and search engines can read it) and the blower guides (FiberSteel's own videos).
 * The wording is FiberSteel's, with spelling fixed. No operating instructions were added: call the service line.
 */
export const dosDonts = {
  intro:
    'Here are some boat lift users’ Do’s & Don’ts. They are the basic rules for boat lift usage that can and will affect the performance and warranties of the boat lifts.',
  dos: [
    'Do perform a test run carefully as you raise your boat on the lift the first time, to check bunk positioning and hull clearance over the lift structure.',
    'Do use common sense when operating the lift. You are responsible for its usage!',
    'Do learn and remember the proper positioning of the boat over the lift before raising.',
    'Do raise the lift at least so the frame is out of the water when no boat is on the lift.',
    'Do give your lift a visual inspection for loose or damaged parts periodically.',
    'Do be aware of overhead roof and structure clearance when raising the boat on the lift.',
    'Do allow the lift to lower away from the boat hull before pulling the boat out of the slip.',
    'Do ask your dealer or installer, or call the factory, if you have questions.',
    'Do remember YOU are solely responsible for the use of the boat lift.',
    'Do practice safe boating — always!',
  ],
  donts: [
    "Don't put any boat on the lift other than what it was installed or built for.",
    "Don't back in a boat over a lift that was installed and designed for a straight pull-in.",
    "Don't raise the lift under a boat backed in when the lift was installed as a straight pull-in.",
    "Don't raise the lift under a boat pulled straight in when the lift was installed as a back-in.",
    "Don't pull the boat over the lift area until the lift has lowered down completely.",
    "Don't run the boat onto the bunks of a lift that has not been lowered completely.",
    "Don't operate your lift if it has broken, damaged, loose or missing parts.",
    "Don't let anyone untrained use your lift.",
    "Don't leave the boat without mooring lines (at 3 points is best).",
    "Don't leave the boat lift in the down position when not in use!",
    "Don't run the blower with the tank shut-off valve closed.",
    "Don't operate the lift with swimmers in the boat slip!",
    "Don't operate boat lifts under the influence of drugs or alcohol.",
  ],
};

export interface Video {
  provider: 'youtube';
  id: string;
  /** The video's title on YouTube */
  title: string;
  /** What FiberSteel's page says about it */
  caption: string;
  /** A FiberSteel photo to show until the video is played (no third-party request until then) */
  poster: string;
}

/** FiberSteel's own videos (YouTube, checked 2026-11-10). IYGZDALI-_s, a second roto-molding clip, no longer plays when embedded. */
export const videos: Video[] = [
  { provider: 'youtube', id: '2gqVc7PhQFY', title: 'FiberSteel Boat Lifts & Marine Products video (2016)', caption: 'An overview of the FiberSteel product line', poster: 'vbottom/16000-with-guides' },
  { provider: 'youtube', id: 'SR-sWVL4A3M', title: 'Raising and lowering of a FiberSteel boat lift', caption: 'A FiberSteel boat lift smoothly lowering and raising in the water', poster: 'pontoon/tritoon-lowering' },
  { provider: 'youtube', id: '6RJ2ViN4ZiE', title: 'FiberSteel Boat Lifts single valve blower operating instructions', caption: 'Using a single-valve manual blower', poster: 'parts/tank-shut-off-valve' },
  { provider: 'youtube', id: '-ira5yKwrUE', title: 'FiberSteel Boat Lifts: instructions for operating the double valve blower controller', caption: 'The 2-valve blower controller box, on a 16,000 lb lift', poster: 'performance/16000-lift' },
  { provider: 'youtube', id: 'bfT7C_Cj4Vw', title: 'Roto-molding a FiberSteel Boat Lifts tank', caption: 'The poly tank roto-molding process, during the cooling stage', poster: 'shallow/8000-shallow-2' },
  { provider: 'youtube', id: 'eVFlWfieyfk', title: 'Dock steps: self-raising, floating, HD steel construction — how to raise the steps', caption: 'Floating dock steps demo', poster: 'docksteps/down' },
  { provider: 'youtube', id: 'AR3ZCHHfERM', title: 'FiberSteel Super Stairs', caption: 'One of the best investments you’ll ever make for your dock', poster: 'docksteps/pier-dock' },
];

export const getVideo = (id: string) => {
  const v = videos.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown video ${id}`);
  return v;
};

/** The blower guides page (/blower-control-use-guide-1): FiberSteel's three videos and its one written tip */
export const blowerGuides = [
  { title: 'Single-valve blower box', video: '6RJ2ViN4ZiE' },
  { title: 'Double-valve blower box controller', video: '-ira5yKwrUE', tip: 'Rotate the handles in the direction of the arrows to open the valves.' },
  { title: 'Demo: a lift lowering and raising', video: 'SR-sWVL4A3M' },
];
