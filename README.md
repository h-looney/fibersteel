# FiberSteel Boat Lifts — website redesign concept

A modern, front-end-only redesign of [lakeboatlifts.com](https://lakeboatlifts.com/) for **FiberSteel Boat Lifts**
(factory-direct sales and service at 3910 Old Route 5, Camdenton, MO — Lake of the Ozarks). It keeps what makes the
current site FiberSteel's — the palm-and-sun logo, the royal blue and sun yellow, bold headings, the menu groups, and
hundreds of FiberSteel's own photos of lifts on the water — and adds the tools today's boat owners expect.

Built with [Astro](https://astro.build) 7 (the same stack and package versions as the HMI concept): every page is
pre-rendered static HTML with responsive WebP images, self-hosted fonts and only a few kilobytes of JavaScript.

The concept also includes **FiberSteel mode** — an optional demo of a staff side, where the team could work website
requests, schedule installs and service, track customers' lifts and warranties, stock, dealers and dealer orders, the
books and reports, and manage the website. It's purely a demo of what's possible; a real one would be customized to
FiberSteel's needs. Use the **Demo · Public | FiberSteel mode** switch at the bottom-left of any page (or "Staff
sign-in" in the footer). See [FiberSteel mode](#fibersteel-mode-the-optional-staff-demo) below.

> **Live preview:** [h-looney.github.io/fibersteel](https://h-looney.github.io/fibersteel/) — a concept, not
> FiberSteel's site; it runs on sample data and nothing typed into it is sent anywhere.
>
> **Status (2026-11-10):** research, the public site, FiberSteel mode, the GitHub Pages preview and three demo videos
> are done. See [Where this stands](#where-this-stands).

## Quick start

Requires Node.js 22.22 or newer.

```bash
npm install
npm run dev       # http://localhost:4321 with hot reload
npm run build     # static site → dist/
npm run preview   # serve the production build locally
npm run check     # TypeScript + Astro diagnostics

npm test                # unit tests: the lift-size formula, open/closed hours, the data rules, website publishing checks
npm run test:site       # checks on the built site in dist/ (links, SEO tags, redirects, wording, prices)
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
| `/installs/`, `/installs/[install]/` | **Lifts we've installed** — the installs showcase (filter by boat, lift size, docking) and a page per install. Switched on or off in FiberSteel mode | — |
| `/remotes/` | Admiral remote control blower systems: features, the prices the current site lists, how many valves, other remotes' warranty contacts | Remote control blowers (two pages) |
| `/dock-steps/` | Self-raising floating dock steps: dimensions, the current prices, videos, photos | Dock steps |
| `/used-lifts/` | Used lifts: the rules (first come, first served…) and listings (samples) | Used lifts |
| `/dealers/`, `/dealers/become-a-dealer/` | **Dealer locator** (factory first, filter by state, sort by distance — computed in the browser) and a dealership inquiry | Dealers |
| `/owners/` | Owner help hub: service, warranty, registration, guides, remotes, videos | — |
| `/service/` | **Service & parts request** with photo upload preview | (phone only) |
| `/warranty/`, `/warranty/register/` | The warranty in plain words + the full text, remote-system warranty contacts, cancellations; **warranty registration** | Warranty |
| `/owners/blower-guide/` | Blower controller guides (FiberSteel's videos, its one written tip) and the raise/lower Do's & Don'ts | Blower control use guide |
| `/owners/dos-and-donts/` | The Do's & Don'ts as real, printable text | Do's & Don'ts (a picture of text) |
| `/about/`, `/contact/` | About (FiberSteel's argument for square poly tanks, Dean, videos); contact (both lines, hours, map on request, a short form) | About Us, Contact Us |
| `/lake-info/`, `/lakefront-rental/`, `/e-lux-bikes/` | The side topics, kept out of the main path | Local lake info, Lakefront Vrbo, E-LuX bikes |
| `/privacy/` | A plain-words privacy policy (draft) | — (none) |
| `/<old address>/` | The current site's addresses (`/pwc-lifts`, `/v-bottom-%26-cat-hull-1`, `/dock-steps-1`…) send people to the new pages — see `src/data/redirects.ts` | |
| `/sitemap.xml`, `/404` | Sitemap and a custom not-found page | |
| `/office/…` | **FiberSteel mode** (optional staff demo, not indexed) — phase 3 | |

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
  size and docking), a page per install, and on each lift-type page (that section stays hidden until a type has one).
- **The data:** `src/data/installs.ts`. An install names a lift size from `lifts.ts`, the boat, the slip and docking,
  the town (never the street), the month, a short write-up, "what was built for it" and photos.
- **The installs there now are samples**: FiberSteel's own photos and captions from its current site (e.g. "24,000 lb
  lift in a 14 ft wide slip, for a 53 ft Nor-Tech"), with made-up towns, months and write-ups. Every card and page says
  "Sample". FiberSteel's real installs replace them — added over time, or, with FiberSteel mode, posted by staff.
- **The on/off switch** (FiberSteel mode → Website → Installs): `src/data/features.ts` + `<html data-installs>` set by
  an inline script from localStorage `fs-site-features`, so `[data-feature="installs"]` hides with no flash. Off, the
  menu drops "Our installs" and the home and lift pages simply skip the section.

## FiberSteel mode (the optional staff demo)

FiberSteel mode is an idea for running the business from the same system as the website, shaped around a lift builder
and installer: quotes, site visits, shop builds, installs on the lake, service and warranty, dealers. It's **purely a
demo** — everything can be clicked, edited and saved, but **nothing leaves the browser** (email, texts, QuickBooks and
payments are simulated), and every record is sample data generated in the browser (IndexedDB), so each person who opens
it gets their own copy. A real FiberSteel mode would be customized to how FiberSteel works; every screen says so in a
note at the top. **Reset demo data** (profile menu, or Settings → Demo data) starts over.

**Sign-in profiles** show how roles change what people see: **Dean** with full access (the one real name, because the
site says "For help, call Dean"; labelled "Full access", since the site doesn't say who owns the business), and
placeholders for the service desk (Jamie), office & accounting (Pat), the shop (Travis) and an install crew lead
(Jesse, with a phone-first day view). Coming from the public site (the mode switch, "Staff sign-in", or a form's
hand-off link) opens the profile picker, then the page the link pointed to. Full access can change each role's sections
under Settings → Team.

| Section | What it does |
| --- | --- |
| Dashboard | Today by role: revenue, today's schedule (installs on the water, service calls, site visits, shop builds), the shop's week, requests waiting, receivables, dealer orders to ship, installs to post, a "needs attention" list and "Things to try" |
| My day | Phone-first view for the crews: today's stops with call and directions, the lift going in, checklist, parts, photos and the owner's signature; the shop profile gets the shop's week and what's short |
| Inbox | Quote, service and warranty requests, dealer inquiries and messages — website forms, calls, walk-ins, Facebook, boat shows. Quotes show the boat, the slip and FiberSteel's formula worked out; service requests show the owner's lifts, whether the part is covered and whether the $95 fee applies; warranty registrations find the lift by serial or customer and register it; dealer inquiries become prospect accounts |
| Jobs & schedule | Site visits, shop builds, installs, service and warranty calls, deliveries and remote installs on a board, a list and a schedule by crew (two install crews, the service techs, the shop). Builds show their bill of materials and what's short; finishing an install adds the lift to the customer's record; a finished job says what's next (invoice it, write the quote, or close it) |
| Customers & lifts | Owners, marinas and dealers with where the dock is (arm, mile marker, cove). Every lift: serial, install date and installer, boat and slip, bunks, extras, remote — and the warranty by part with end dates, worked out from FiberSteel's published terms. Register, book service, start a claim, fit a remote, or move a lift to a new owner (the warranty is for the original purchaser) |
| Warranty | Claims from open to replaced (or not covered, or referred to the remote's maker), registrations waiting, and a coverage check for any lift and part with the published terms |
| Inventory | One location. Finished lifts in the yard, components, dock steps and resale stock; what's set aside for builds and jobs; how many of each lift the shop could build from stock now; purchase orders and receiving; activity; vendors |
| Dealers | Sample dealer accounts (invented — the real dealer list is under Website), orders at dealer prices that start shop builds when confirmed and invoice the dealer when shipped, and prospects from the website's dealer form |
| Accounting | Invoices and quotes (an accepted quote orders the lift: a shop build and an install), payments, bills, banking and reports (P&L, sales tax, receivables). Books kept **in-house** or **synced to QuickBooks Online** (simulated) |
| Analytics | Overview, crews & shop, service by part and problem, sizes sold (stand-in names), requests & conversion, dealer sales, inventory health, and "not seen in a year" (a sample idea) — every chart has a table |
| Website | **Lifts we've installed** (post finished installs with photos and the owners' OK, and switch the showcase on or off), used lifts, the public dealer list, and publishing — published changes show as previews on the public pages in the same browser |
| Settings | Business profile, team & permissions, website forms (who each request is assigned to, and the addresses the real site would email), prices & fees, books & invoices, notifications, demo data |

**In this demo the public site and FiberSteel mode are connected:** send any public form and the request shows up in
the inbox — live, if FiberSteel mode is open in another tab — and the confirmation links to it. On the real site every
request is emailed to the address FiberSteel chooses, for the team to review; FiberSteel mode would be an optional
extra on top.

### Sample data

- Generated around today's date: about 15 months of history behind the reports, five weeks of detailed requests, jobs
  and invoices, and three weeks of schedule ahead, so it always looks current. It comes out the same at any time of
  day; only today's jobs move along with the clock (started, finished).
- **Customers, figures and crews are invented** (phone numbers in the reserved 555-01xx range, example.com emails).
  Dean appears only as a profile and is never rated; the placeholder crew and shop people are the only ones the
  reports rate.
- FiberSteel's lift sizes are real (the sizes page); their **prices, costs, stock, bills of materials and time
  standards are samples**. Prices from the current site: the Admiral remotes, the dock steps, the $95 service fee and
  the $200 remote installation.
- The **dealer accounts are invented "(sample)" businesses**, so no invented order or sales figure sits next to a real
  dealer; the real dealer list is the one under Website → Dealer list.
- Reports that rank what sold or what used parts (Sizes sold, Inventory health) use **stand-in names** ("Boat lift C",
  "Add-on B"), so invented figures never sit next to a real FiberSteel product; the live system would show real names
  with real history.
- Warranty coverage uses only what FiberSteel's Warranty page states.

### How it's built

- A client-only [Preact](https://preactjs.com) app (`src/office/`) mounted by `src/pages/office/[...section].astro`.
  Each section is its own pre-rendered page, so links and refreshes work on any static host. The public pages ship no
  framework JavaScript.
- `src/office/data/types.ts` is the data model, written the way an API would return it. `seed.ts` builds the sample
  data; `actions.ts` holds every change and its side effects (finishing a build puts the lift in the yard and sets it
  aside for its install; finishing the install takes it out of stock and adds it to the customer's record; shipping a
  dealer order invoices the dealer); `selectors.ts` holds the shared calculations, including the warranty terms.
- To make it real, replace `store.ts` (IndexedDB) and the actions with calls to a backend, and the simulated
  integrations (email/text, QuickBooks Online, payments) with their APIs. `src/office/bridge.ts` is where the public
  forms hand off today and where published installs, used lifts and dealer changes are read back by the public pages.

### What's real and what's simulated

| Real | Simulated or sample |
| --- | --- |
| FiberSteel's lift sizes, the formula, the warranty terms and the prices the current site shows | Customers, requests, jobs, invoices, payments, stock, costs, lift prices and time standards |
| The public dealer list (Website → Dealer list), FiberSteel's photos and the sample installs' captions | Dealer accounts and their orders and discounts, crew names, every report figure |
| The public forms' hand-off into the inbox (in the same browser) | Email and text replies, QuickBooks sync, payments, and publishing (previews in that browser only) |

## Demo videos

`.claude/skills/fibersteel-videos/` makes narrated demo videos for FiberSteel, locally and for free — adapted from the
HMI concept's video skill, itself from the K54 team's `k54-videos` kit, which must be installed once (`~/.demo-video`):
Playwright records in its own headless Chromium (never your own browser or anything signed in), Kokoro narrates (voice
`af_heart`, Apache 2.0), and ffmpeg assembles an H.264 MP4 with captions.

```bash
bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh website-tour --check     # the flow only, ~30 s (builds the site first)
bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh website-tour --no-build  # → video-drafts/website-tour.mp4 (+ .captioned.mp4, .vtt, frames)
```

| Video | Shows | Length |
| --- | --- | --- |
| `website-tour` | The lift and quote path first — lifts by boat type, a lift page, the sizes and the calculator, a quote request (emailed to FiberSteel for review) — then the familiar pages: remotes, dock steps, used lifts, dealers, owner help, the warranty, contact, and the side topics in the footer | 2:01 |
| `installs-feature` | "Lifts we've installed": filters, an install page, the lift pages, adding installs over time or with FiberSteel mode (said to be a demo), posting one from a finished job, publishing, and the on/off switch | 1:46 |
| `fibersteel-mode-tour` | FiberSteel mode, introduced as an optional, customizable demo: profiles, dashboard, inbox, jobs and schedule, customers and lifts, warranty, inventory, dealers, accounting, analytics, website | 1:48 |

Each is a `script.json` (narration per scene) and a `flow.mjs` (what the browser does). The website tour hides the
demo's mode switch and the forms' hand-off note, and nothing that leaves the concept site is ever clicked (dealer
sites, the Vrbo listing, maps, `tel:` and `mailto:` links). Every narration line is levelled to the same loudness
(`lib/level.mjs`, with the kit's own levelling off — `"loudnorm": false`), and the run fails if a line in the finished
video is off. `video-drafts/` is gitignored. The skill's `SKILL.md` has the full steps, including the frame review.

## Forms & a future backend

The quote, service, warranty, dealer and contact forms validate in the browser and show a confirmation, but **nothing
is sent anywhere yet** — submissions are logged to the browser console and, for the concept demo, handed to FiberSteel
mode in the same browser (`src/office/bridge.ts`). On the real site each request would be emailed to the address
FiberSteel chooses, for the team to review. To connect a backend, add a `data-endpoint` attribute to the `<form>` (in
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
| `navigation.ts`, `redirects.ts`, `features.ts` | Menus, old addresses, the on/off switches |

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

| Phase | State |
| --- | --- |
| 1. Research (passive) | Done 2026-11-10 — `research/FACTS.md` (gitignored) |
| 2. Public site | Done — build, `npm run check`, 28 unit, 11 site and 12 browser tests pass; screenshots reviewed at 1440 and 390 px |
| 3. FiberSteel mode | Done — build, `npm run check`, 39 unit, 12 site and 22 browser tests pass (10 of them for FiberSteel mode); every section reviewed at 1280 and 390 px |
| 4. Publishing | Done 2026-11-10 — [github.com/h-looney/fibersteel](https://github.com/h-looney/fibersteel), live at [h-looney.github.io/fibersteel](https://h-looney.github.io/fibersteel/). `.github/workflows/deploy.yml` (HMI's, cut down) deploys every push to `main` once the unit tests and the built-site checks pass |
| 5. Demo videos | Done — three videos in `video-drafts/` (gitignored): `website-tour` 2:01, `installs-feature` 1:46, `fibersteel-mode-tour` 1:48; loudness checks passed and every frame reviewed (see [Demo videos](#demo-videos)) |
| 6. Proposal | Done — kept outside the repo |

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
- **Videos**: all seven are on the "Dean P" YouTube channel; one more (a second roto-molding clip, `IYGZDALI-_s`) no
  longer plays when embedded. Is there a FiberSteel channel to link? Do you roto-mold your own tanks (the site could
  say so)?
- **The installs showcase**: which recent installs do you have photos of (and the owners' OK to share them)? How
  should the OK be asked for (a line in the order form?) Which ones to feature? On at launch, or once there are enough
  real ones to replace the samples?
- **Service email**: the service department uses a Gmail address — move it to @lakeboatlifts.com?
- **Side topics**: keep the Vrbo rental and E-LuX bikes on the site, move them, or drop them? The local lake info's
  lake-level link now lands on Ameren's permitting page — which page should it point to?
- **Online payment for dock steps** (PayPal today): keep it on the new site?
- **The privacy policy** is a draft in plain words — please review.
- **Reviews**: none were invented. Real reviews (Google, Facebook, Yelp) could be added with permission.
- **Logo**: a vector original (SVG/EPS/AI) would be sharper than the PNG.

**FiberSteel mode** (only if FiberSteel is interested — it's an optional demo):

- **Is a staff side wanted at all**, and which parts would matter most (requests, the schedule, the shop, warranty,
  dealers, the books)?
- **The team**: who does what, and Dean's role? The demo only knows "For help, call Dean"; everyone else is a
  placeholder.
- **The shop**: how builds are planned today, real bills of materials and build times, and how stock is counted.
- **Serial numbers and registrations**: what a FiberSteel serial or order number looks like, and how warranty
  registrations are recorded today.
- **Prices and terms**: lift and installation prices (samples in the demo), whether site visits are charged, how long a
  quote is good for (the demo uses 30 days), and whether Venmo and PayPal are taken for lifts or only for dock steps.
- **Sales tax**: how it applies to installation, labor and dealer sales (the demo taxes lifts, parts and remotes only,
  at a sample rate).
- **Books**: is QuickBooks in use (the demo can sync to it), or something else?
- **Dealers**: dealer pricing, territories and freight (all samples in the demo).
- **Admiral remotes**: whose warranty covers them (the site names FirstMate's and Captain's Choice's makers only)?
- **Check-up calls**: does FiberSteel do yearly check-ups or spring reminders? The "Not seen in a year" report is only
  an idea.
