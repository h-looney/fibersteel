# FiberSteel Boat Lifts — website redesign concept

A modern, front-end-only redesign of [lakeboatlifts.com](https://lakeboatlifts.com/) for **FiberSteel Boat Lifts**
(factory-direct sales and service at 3910 Old Route 5, Camdenton, MO — Lake of the Ozarks). It keeps what makes the
current site FiberSteel's — the palm-and-sun logo, the royal blue and sun yellow, bold headings, the menu groups, and
hundreds of FiberSteel's own photos of lifts on the water — and adds the tools today's boat owners expect.

Built with [Astro](https://astro.build) 7 (the same stack and package versions as the HMI concept): every page is
pre-rendered static HTML with responsive WebP images, self-hosted fonts and only a few kilobytes of JavaScript.

> **Live preview:** [h-looney.github.io/fibersteel](https://h-looney.github.io/fibersteel/) — a concept, not
> FiberSteel's site; it runs on sample data and nothing typed into it is sent anywhere.
>
> **Status (2026-11-10):** research, the site, the GitHub Pages preview and two demo videos are done. See
> [Where this stands](#where-this-stands).

## Quick start

Requires Node.js 22.22 or newer.

```bash
npm install
npm run dev       # http://localhost:4321 with hot reload
npm run build     # static site → dist/
npm run preview   # serve the production build locally
npm run check     # TypeScript + Astro diagnostics

npm test                # unit tests: the lift-size formula, open/closed hours, the data rules
npm run test:site       # checks on the built site in dist/ (links, SEO tags, redirects, wording, prices, no names)
npm run test:browser    # browser tests against dist/ built with --base /fibersteel (Playwright's Chromium)
```

The browser tests use Playwright's own Chromium from `~/.cache/ms-playwright` (or `CHROME_PATH`) with a fresh
temporary profile — never anyone's everyday Chrome. Every request to another server is stubbed, so nothing leaves the
machine.

## Sharing a preview online

`npm run build` produces plain static files in `dist/`, so any static host can serve the site — no server needed.

- **GitHub Pages** (where the concept preview lives): `.github/workflows/deploy.yml` runs the unit tests, builds for
  the Pages address, checks the built site and publishes on every push to `main`. The site is served from a subfolder
  (`https://h-looney.github.io/fibersteel/`); to try that locally, run
  `npm run build -- --site https://h-looney.github.io --base /fibersteel` and then `npm run preview -- --base /fibersteel`.
- **Cloudflare Pages or Netlify**: connect the repo (build command `npm run build`, output folder `dist`).

So the site works in a subfolder, internal links go through `withBase()` from `src/scripts/url.ts` — write
`href={withBase('/contact/')}` rather than `href="/contact/"`. At the site root it changes nothing. `npm run test:site`
fails if a built page links somewhere that doesn't exist or skips the base path.

Copies served from any domain other than lakeboatlifts.com add a `noindex` tag (`src/components/SEO.astro`), so
previews stay out of search results.

## Pages

Every page and topic of the current site is here (21 pages + home, read 2026-11-10). The menu keeps the current site's
groups — lifts & sizes, remotes & owner help, used lifts, dock steps, dealers, about & contact — and the side topics
(lake info, the Vrbo rental, E-LuX bikes) move to the footer's "Around the lake".

| URL | What it is | On the current site |
| --- | --- | --- |
| `/` | Home: hero with live open/closed status, quick facts, lifts by boat type, the lift size calculator, installs, why square poly tanks, add-ons, dealers & warranty, FAQ | Home |
| `/lifts/` | All lifts by boat type, every size at a glance, what to have ready for a quote | — |
| `/lifts/[type]/` | 7 pages: PWC; V-bottom & cat-hull; pontoons & tri-toons; performance boats & cruisers; large boats & cruisers; front-mounted; shallow-water. Each: FiberSteel's own tagline (with its source page), the sizes, how it's set up (bunks, guides, walkboards, docking — with FiberSteel's photos and captions), installs of that type, a captioned photo gallery with a viewer, and a quote pre-filled for the boat type | The 7 lift pages |
| `/lifts/sizes/` | The lift size calculator, every standard size and spec (each with its source page), parts & features | Our lift sizes |
| `/quote/` | **3-step quote request**: the boat, the slip, how to reach you — with FiberSteel's formula worked out live | Contact form (name/email/message only) |
| `/installs/`, `/installs/[install]/` | **Lifts we've installed** — the installs showcase (filter by boat, lift size, docking) and a page per install. Can be left off (`src/data/features.ts`) | — |
| `/remotes/` | Admiral remote control blower systems: features, the prices the current site lists, how many valves, other remotes' warranty contacts | Remote control blowers (two pages) |
| `/dock-steps/` | Self-raising floating dock steps: dimensions, the current prices, videos, photos | Dock steps |
| `/used-lifts/` | Used lifts: the rules (first come, first served…) and listings (samples) | Used lifts |
| `/dealers/`, `/dealers/become-a-dealer/` | **Dealer locator** (factory first, filter by state, sort by distance — computed in the browser) and a dealership inquiry | Dealers |
| `/owners/` | Owner help hub: service, warranty, registration, guides, remotes, videos | — |
| `/service/` | **Service & parts request** with photo upload preview | (phone only) |
| `/warranty/`, `/warranty/register/` | The warranty in plain words + the full text, remote-system warranty contacts, cancellations; **warranty registration** | Warranty |
| `/owners/blower-guide/` | Blower controller guides (FiberSteel's videos, its one written tip) and the raise/lower Do's & Don'ts | Blower control use guide |
| `/owners/dos-and-donts/` | The Do's & Don'ts as real, printable text | Do's & Don'ts (a picture of text) |
| `/about/`, `/contact/` | About (FiberSteel's argument for square poly tanks, help choosing a lift, videos); contact (both lines, hours, map on request, a short form) | About Us, Contact Us |
| `/lake-info/`, `/lakefront-rental/`, `/e-lux-bikes/` | The side topics, kept out of the main path | Local lake info, Lakefront Vrbo, E-LuX bikes |
| `/privacy/` | A plain-words privacy policy (draft) | — (none) |
| `/<old address>/` | The current site's addresses (`/pwc-lifts`, `/v-bottom-%26-cat-hull-1`, `/dock-steps-1`…) send people to the new pages — see `src/data/redirects.ts` | |
| `/sitemap.xml`, `/404` | Sitemap and a custom not-found page | |

## What's new compared with the current site

- **A lift size calculator** built on FiberSteel's own formula from its home page (dry weight + fuel at 7 lb a gallon
  + 2,000 lb up to 30 ft, 3,000 lb over), naming the standard size that covers it — and handing the numbers to the
  quote form.
- **A 3-step quote request** that asks for exactly what the home page says FiberSteel needs: the boat's brand, model,
  length and weight, and the slip's width × length — plus docking style, water depth, extras and where the dock is.
  It works the formula out live and points out-of-state visitors to dealers.
- **Service & parts requests** (with photos) and **warranty registration** online.
- **Lifts by boat type with real specs**: every size and spec is only what FiberSteel's pages state, stored with the
  page it came from (`src/data/lifts.ts`, `src/data/sources.ts`). No lift prices — the current site shows none.
- **Lifts we've installed** — FiberSteel's own lifts on the water as the showcase (see below).
- **A dealer locator**: the factory first, then every authorized dealer, filtered by state or sorted by distance from
  the visitor (worked out in the browser; nothing is sent). Dead dealer links are fixed or removed.
- **Owner help as real pages**: the Do's & Don'ts become readable, printable text (they're a picture today), with the
  blower guides and FiberSteel's videos.
- **Live open/closed status** (Central time) in the top bar, footer, contact page and call sheet — "By appointment"
  on Saturdays.
- **A phone action bar** — Call (sales or service) · Directions · Get a quote — and a mobile menu.
- **Old addresses keep working**: every current page's address redirects to its new page.
- **Local SEO**: per-page titles and descriptions, Open Graph images, `LocalBusiness` (both phone lines, hours, the
  service area), `Product` for each lift type, `FAQPage`, `BreadcrumbList`, an `ItemList` of dealers, a sitemap.
- **Performance**: static HTML, WebP images at responsive sizes, self-hosted fonts, maps and videos only on request
  (no request to another server until the visitor asks — the browser tests check every page).
- **Accessibility**: semantic landmarks, skip link, keyboard-friendly menus, dialogs and photo viewer,
  reduced-motion support, WCAG AA contrast — axe reports no violations on any page at 1440 px or 390 px.
- **A privacy policy** (the current site has none).

## Lifts we've installed (the installs showcase)

The showcase is FiberSteel's own lifts on the water: the lift size, the boat, the slip, the docking style and what was
built for it (bunks, guides, walkboards, a remote). It sells the lift and the custom work at the same time.

- **Where they show:** three featured ones on the home page, all of them on `/installs/` (filter by boat type, lift
  size and docking), a page per install, and on each lift-type page (a type with none yet skips the section).
- **The data:** `src/data/installs.ts`. An install names a lift size from `lifts.ts`, the boat, the slip and docking,
  the town (never the street), the month, a short write-up, "what was built for it" and photos.
- **The installs there now are samples**: FiberSteel's own photos and captions from its current site (e.g. "24,000 lb
  lift in a 14 ft wide slip, for a 53 ft Nor-Tech"), with made-up towns, months and write-ups. Every card and page says
  "Sample". FiberSteel's real installs replace them, added over time from the photos FiberSteel sends of finished jobs.
- **Leaving it off** (until there are real photos, say): set `installs: false` in `src/data/features.ts` and rebuild.
  The install pages aren't built and the sitemap drops them, and `<html data-installs="off">` (set in `BaseLayout`)
  hides everything marked `[data-feature="installs"]`: the menu drops "Our installs" and the home and lift pages simply
  skip the section.

## Demo videos

`.claude/skills/fibersteel-videos/` makes narrated demo videos for FiberSteel, locally and for free — adapted from the
HMI concept's video skill, itself from the K54 team's `k54-videos` kit, which must be installed once (`~/.demo-video`):
Playwright records in its own headless Chromium (never your own browser or anything signed in), Kokoro narrates (voice
`af_heart`, Apache 2.0), and ffmpeg assembles an H.264 MP4 with captions.

```bash
bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh website-tour --check     # the flow only, ~30 s (builds the site first)
bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh website-tour --no-build  # → video-drafts/website-tour.mp4 (+ with-captions/, captions/, frames/)
```

| Video | Shows | Length |
| --- | --- | --- |
| `website-tour` | The lift and quote path first — lifts by boat type, a lift page, the sizes and the calculator, a quote request (emailed to FiberSteel for review) — then the familiar pages: remotes, dock steps, used lifts, dealers, owner help, the warranty, contact, and the side topics in the footer | 1:56 |
| `installs-feature` | "Lifts we've installed": filters, an install page, the lift and home pages, adding installs over time from FiberSteel's photos, and the site with the showcase left off, then back on | 0:55 |

Each is a `script.json` (narration per scene) and a `flow.mjs` (what the browser does). Both hide the forms'
concept-demo note (the real site emails each request), and nothing that leaves the concept site is ever clicked (dealer
sites, the Vrbo listing, maps, `tel:` and `mailto:` links). Every narration line is levelled to the same loudness
(`lib/level.mjs`, with the kit's own levelling off — `"loudnorm": false`), and the run fails if a line in the finished
video is off. The videos play with captions off: the MP4 to send has no caption track, and the captions
(`video-drafts/captions/`) and a copy with them burned in (`video-drafts/with-captions/`) are kept apart from it,
because players such as VLC and mpv show a caption file named like the video automatically. The run fails if either
check doesn't pass. `video-drafts/` is gitignored. The skill's `SKILL.md` has the full steps, including the frame
review.

## Forms & a future backend

The quote, service, warranty, dealer and contact forms validate in the browser and show a confirmation, but **nothing
is sent anywhere yet** — submissions are logged to the browser console, and the confirmation says the demo sent
nothing. On the real site each request would be emailed to the address FiberSteel chooses, for the team to review. To connect a backend, add a `data-endpoint` attribute to the `<form>` (in
`src/components/QuoteForm.astro` or `RequestForm.astro`); the fields are POSTed as JSON. See `src/scripts/forms.ts`.
Photo uploads are previewed locally and would need multipart handling server-side. Dock steps are ordered through a
request (no payments in the concept; the current site uses PayPal buttons).

## Editing content

Almost everything lives in `src/data/`:

| File | Contents |
| --- | --- |
| `site.ts` | Name, address, phones, emails, hours (they drive the open/closed status), social links, map |
| `lifts.ts` | **The lift sizes** (with each spec's source), the size groups, the lift-size formula, the lift types (taglines, sizes, options, photos), parts & features |
| `sources.ts` | The current site's pages that the facts come from (checked 2026-11-10) |
| `photos.ts` | Every FiberSteel photo: alt text, FiberSteel's caption, the page it came from |
| `installs.ts` | The installs showcase (samples) |
| `products.ts` | Admiral remotes, dock steps and WaveArmor — with the prices the current site shows |
| `warranty.ts` | Warranty terms (plain-words summary + full text), remote-system contacts, cancellations, the service fee |
| `dealers.ts` | The dealer list (businesses only) with approximate coordinates for the distance sort |
| `usedLifts.ts` | Used-lift rules and listings (samples) |
| `ownerHelp.ts` | Do's & Don'ts, the blower guides, FiberSteel's videos |
| `faqs.ts` | FAQ answers (only FiberSteel's own facts) |
| `sideTopics.ts` | Lake info, the rental, E-LuX bikes |
| `navigation.ts`, `redirects.ts`, `features.ts` | Menus, old addresses, the parts of the site that can be left out |

Design tokens (colors, type scale, spacing) are CSS custom properties in `src/styles/tokens.css`. The announcement bar
is set in `src/layouts/BaseLayout.astro` — change the text and bump `announcementId` to show it again.

## Images

Photos and the logo come from FiberSteel's current website (read once on 2026-11-10; the originals are kept in the
gitignored `research/` folder). They were re-saved at up to 1600 px with their metadata stripped and renamed by what
they show (several original file names included customers' names). Photos with identifiable people — including one
of a child — were left out.

- **Other companies' products** (Admiral remotes, WaveArmor docking stations, E-LuX bikes) get labelled placeholders
  (`src/components/BrandPlaceholder.astro`): their marketing photos are never copied. FiberSteel's own photos of lifts
  it fitted with Admiral remotes are used, captioned as FiberSteel captioned them.
- **The logo** is cut from the large PNG on the current site, with the white around the oval made transparent. The
  favicon (`public/favicon.svg`) is a simple redrawing of the palm-in-the-sun — a stand-in until FiberSteel has a
  vector original.

## Why there's no link checker

The HMI concept checks dozens of manufacturer links nightly and sends them through `/go/` pages. FiberSteel builds its
own lifts, so its current site has only 13 outbound links (dealers, Admiral, Ameren, Vrbo, Facebook, Yelp). A single
visit to each on 2026-11-10 found 3 that don't work — Woodland Marina's old `/site/` page (its home page works, so the
concept links that), Indian Creek Marina's site (down; listed without a website) and Ameren's lake-level page (now
its permitting page). That's too few to justify the machinery: the concept keeps every outbound link in one data file,
and a monthly link check fits in Website Care.

## Where this stands

| Step | State |
| --- | --- |
| Research (passive) | Done 2026-11-10 — `research/FACTS.md` (gitignored) |
| The site | Done — build, `npm run check`, 28 unit, 14 site and 12 browser tests pass; screenshots reviewed at 1440 and 390 px |
| Publishing | Done 2026-11-10 — [github.com/h-looney/fibersteel](https://github.com/h-looney/fibersteel), live at [h-looney.github.io/fibersteel](https://h-looney.github.io/fibersteel/). `.github/workflows/deploy.yml` (HMI's, cut down) deploys every push to `main` once the unit tests and the built-site checks pass |
| Demo videos | Done — two videos in `video-drafts/` (gitignored): `website-tour` 1:56, `installs-feature` 0:55; loudness and caption checks passed and every frame reviewed (see [Demo videos](#demo-videos)) |
| Proposal | Done — kept outside the repo |

## To confirm with FiberSteel

- **The name.** The current site writes FIBERSTEEL, Fibersteel and FiberSteel (the logo), and the warranty says
  "Fibersteel Boat Lifts, LLC." The concept writes **FiberSteel** everywhere — is that right, and what's the legal
  spelling?
- **Hours** appear three ways: the Contact page (weekdays 9–4:30, Saturday by appointment — used here), the footer
  widget ("Open today 9:00 am – 5:00 pm") and the data Google reads (Monday 8:30–5, Tuesday–Friday 9–5, Saturday
  9–noon). Which is right? The open/closed badges follow `site.ts`.
- **Address**: "3910 Old Route 5" (footer, Google) vs "3910 N. Hwy 5" (Contact, Dealers). Which should the site use?
- **Lift sizes**: the home page lists an **11,000 lb** lift and leaves out the **20,000 lb** one; captions show
  **6,000 lb** shallow-water lifts that the sizes page doesn't list; the sizes page's group says "up to 5,700 lb dry
  weight" but its 8,000 lb lift says "up to about 5,500 lb". What are the current standard sizes?
- **Formula vs. the sizes page**: by the home page's formula a 3,200 lb boat with 30 gallons needs 5,410 lb — more
  than the 4,800 lb lift the sizes page suggests for "dry weights up to about 3,200 lb". Which should the calculator
  follow? (It uses the formula.)
- **Prices shown on the new site** (each is on the current site): Admiral remotes $2,345 / $2,520 / $2,785 / $2,985 /
  A/B split $2,785, installation on the lake $200; dock steps $2,195 (cash, check, Venmo) or $2,350 online, installation
  $200, shipping about $550; the $95 service fee after the first year. Are they current, and should the site show them?
  The dock-steps page also says "a $90 surcharge with PayPal", but the two prices differ by $155.
- **Admiral**: which models do you sell now (Admiral, Admiral Pro, Admiral A+)? Who handles Admiral warranties? A
  third number, 573-216-7827, is listed for Admiral information — whose line is it, and should it be on the site?
- **WaveArmor and E-LuX**: still carried? (The concept keeps them, with placeholders instead of their photos.) Can you
  share their dealer media-kit photos?
- **Used lifts**: the current page had no listing with details on 2026-11-10; the concept shows samples with "Call for
  price". Should real listings show prices?
- **Dealers**: names as the page writes them vary — "Sullivann/Sullivan Marina", "Scales Point/Pointe", "Two Rivers"
  vs "Two Branch" Marina, Mid Town Marina in "East Dubuque, Iowa" (East Dubuque is in Illinois), "Potsboro" (Pottsboro).
  Woodland Marina's link goes to a missing page (the concept links its home page); Indian Creek Marina's site is down;
  Wildcat Marina links to Facebook. Admiral Remote Controls is listed among the dealers — keep it there? Staff names
  were left off the dealer cards — fine?
- **Dealer coordinates** for the distance sort are approximate town centers. Exact addresses would sharpen it.
- **Membership**: the About page shows the Lake of the Ozarks Marine Dealers Association logo — are you a member, and
  may the site say so?
- **Videos**: all seven are on a personal YouTube channel; one more (a second roto-molding clip, `IYGZDALI-_s`) no
  longer plays when embedded. Is there a FiberSteel channel to link? Do you roto-mold your own tanks (the site could
  say so)?
- **The installs showcase**: which recent installs do you have photos of (and the owners' OK to share them)? How
  should the OK be asked for (a line in the order form?) Which ones to feature? On at launch, or once there are enough
  real ones to replace the samples?
- **A general sales email**: the current site shows one person's address for sales. The new pages name no one
  ("Call us" — whoever answers may be someone else), so they show no sales address until there's a general one
  (e.g. sales@lakeboatlifts.com). Is there one? It goes in `site.ts` (`sales.email`).
- **Service email**: the service department uses a Gmail address — move it to @lakeboatlifts.com?
- **Side topics**: keep the Vrbo rental and E-LuX bikes on the site, move them, or drop them? The local lake info's
  lake-level link now lands on Ameren's permitting page — which page should it point to?
- **Online payment for dock steps** (PayPal today): keep it on the new site?
- **The privacy policy** is a draft in plain words — please review.
- **Reviews**: none were invented. Real reviews (Google, Facebook, Yelp) could be added with permission.
- **Logo**: a vector original (SVG/EPS/AI) would be sharper than the PNG.
