# Reading Teacher — lasting house rules

This is the product bible. It lives here so it is **not** trapped in a chat (the Program agent or the voiceover agent). Later agents should read this file before changing play, grades, or kid copy.

## Family

| Child | Age | Path |
| --- | --- | --- |
| Riley | 7 | Full stretch word-reading |
| Hudson | 6 | Same bank as Riley; may linger on neighbors |
| Myles | 3 | Letters and sounds only until scout flag **and** Rudy unlocks (`ready_for_print_words`). Spelling is **Myles**, never Miles. |
| Cassidy | 1 | Waiting. No items. No fake grades. Activate is a parent-desk button, not a lesson. |

Rudy (parent) enters ages/birthdays and can try, reorder, ease, harden, or author modules. Curriculum is not locked. The daily path does **not** auto-jump — Rudy does.

## Pedagogy

- Phonics-heavy. Default stretch is **stretch-hard**.
- Riley/Hudson ladder: SATPIN → CVC → digraphs/blends → heart words → silent-e / teams / r-controlled / syllables / endings → short sentences.
- **Skills map before the first daily.** Every active child takes the detailed diagnostic (`lib/diagnostic.ts`) before any daily session. It is in the kid's skin, resumable across sittings (20 probes per sitting, "that's enough" saves), and the kid never hears "test" — it is a map to scout.
- Map Track A (Riley/Hudson): 14 bands up the ladder — first sounds → letter names → letter sounds → short vowels → CVC → digraphs → blends → heart words → silent-e → vowel teams → r-controlled → syllables → endings → sentences. One bit per probe (a letter, a vowel, *sh*, *made*…). A band stops on 2 misses in a row or fewer than 2 hits in 4. An unknown band ends the map; two shaky bands in a row end it too. Legacy shelves **S / L / C / C+** are derived from the frontier.
- Map Track B (Myles): 8 letters, names then sounds then first sounds, 3 tiles. Shelves **A0–A3**.
- **Every band ends with one speak probe.** The kid reads print (a letter, a word, a line) that the teacher never says aloud; first sounds ask for the sound itself. The ear grades it like a lesson speak step; "Parent will listen" stores it as **pending** — not a hit, not a miss — until Rudy grades it on the desk, and then the map re-reads itself (bands, shelf, frontier, readiness) without touching the path.
- **Speed is a real number.** Average ms on first-answer tap hits, per band and for the whole map (`speedMs`). Speak probes never count toward speed. Shown as "0.9 s per hit"; no label, no fake zero.
- **One word for frontier:** the first band that is not known (shaky or unknown). `report.frontier`, the note, the desk, and `/parent/grades` all name the same band.
- **The path is built from the map, per bit.** Known band → its bank module is marked passed. Shaky band → a targeted module from exactly the missed bits (plus one review item), then the bank module. Unknown band (frontier) → bank module, then a targeted module on the whole band, then one stretch band. Nothing past that is auto-assigned; Rudy adds from the shelf.
- **Rudy picks the start.** On the desk Skills map every band has **Start here** (earlier bank modules pass, the path rebuilds from that band, hand-made modules stay; confirm first) and, when bits were missed, **Practice these** (pre-fills Create-a-module with that band's missed bits; the module is built from the band's own tap / drag / speak items, id `pr-<kid>-<band>-…`, badge *practice* on the grades page).
- **The path is seeded once.** `HouseState.version` is 2; `lib/house.ts` migrates older records. Nothing re-adds starter modules on load. Modules Rudy holds, drops, or that Start here / the map take off go on the kid's `held` list and only come back when Rudy adds them (library shows *held · Put back*).
- **Myles's readiness is a rule, not a checkbox.** `readyForPrintWords` turns true when the map says letter sounds **and** first sounds are both known (a scout that says so raises it too, never lowers it). The desk shows *Scout says ready / not yet*; Rudy still confirms the first word module by hand.
- Parent desk shows the **Skills map**: every band known / shaky / unknown / not reached with the bits, hits, speed, whether they could say it, what was built and why, Start here, Practice these, and *Map again*. `/parent/grades` shows shelf + frontier per kid ("Kids on the map") with a link into the map, and each module's green sheet shows what the map said about its band.
- Periodic **scout** probes (weekly / every 5 dailies). Never cold-open the day with a scout. Kid sees a secret-tunnel adventure and plays every item in the pack. Parent sees a real scout report (`scoutReportFrom`: each item mapped to its band and bit, known / shaky / unknown against what was asked, ceiling, floor, drafts built from the missed bits). It is saved on every exit, including "that's enough". **Daily path does not auto-change.**
- After a session, Rudy reads the real sheet and create / reorder / ease / harden from what that child actually did.

## Kid door vs parent door

- Kids: stars, stickers, adventure. Never hear fail / “wrong” / red-X / DNF.
- Honest miss: they must know it wasn’t right. Line is **“Not that one.”** Wobble. Tile hops home. No fake win. Stars only on real hits. Then try another version of the same word/skill until a real hit.
- Parent desk: real grades, known-vs-unknown map, pass/fail, last session, Try / Ease / Harden / Hold, create/reorder modules.
- Parent grade gambit: letter recognition, vowel phonics, phonemes, words, sentences, spoken words, speed, module pass/fail.
- Parent door on the landing page and the kid picker is **hold-to-open**. The picker has a **Grades** hold at the bottom so Rudy can reach the desk from the same screen the kids tap. Host hold during play is **that’s enough**.

## Play

- Widgets: smash, ear, feed, stamp, drag, say, trace.
- Drag letters / vowels / sounds into word trays, then speak. Phone: tap-to-send is the same move.
- Vowel faces stay locked across skins: red *a*, gold *e*, indigo *i*, orange *o*, purple *u*.
- Themes are skins only — same phonics IDs every day.

## Daily themes (kid picks)

Large animals, airplanes, planets and space, bugs, spaceships, farming and equipment (trucks, choppers, wheat, silage, corn, tractors, implements, cars — not a cute-farm teacher), race cars (track, helmets, pit stops; miss is wobble / helmet bonk, never DNF).

## Trip mode

Phone and desktop are both first-class. One-phone trips, two doors, big one-thumb targets (88px+), short interruptible sessions, offline / flaky-network pack. At phone width three choice cards deal 2 + 1 so all three sit above the dock; drag slots shrink to 80px so a four-slot word fits.

## Checks

`npm run check` runs every `scripts/check-*.mjs` (the merge queue runs the same set): deal, diagnostic (speak probes, speed, readiness, Start here, practice), house (migration, held list, D1 path stability), listen, phonemes, placement, scout cadence, scout report, skip-stuck. `npm run build && npm run smoke` drives a built app in Chrome at 390 × 844 and saves screenshots (`SHOTS=`); `BASE_URL=` points it at the live site. `npm run lint` must be zero errors.

## Voice, listen, PWA

Those are **not** this file. See `docs/agent-lanes.md`. Neural TTS, “what / again” replay, and install-to-home-screen belong on the voiceover PR unless that work is later merged.

## Do not

- Do not invent unpaid fake “natural” voices as the only spoken path.
- Do not put fail language on the kid door.
- Do not auto-rewrite a child’s daily path from a scout.
- Do not teach Cassidy while she is waiting.
- Do not spell Myles as Miles.
