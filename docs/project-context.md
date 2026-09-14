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
- **Skills map before the first daily.** Every active child takes the detailed diagnostic (`lib/diagnostic.ts`) before any daily session. It is tap-only, in the kid's skin, resumable across sittings (20 probes per sitting, "that's enough" saves), and the kid never hears "test" — it is a map to scout.
- Map Track A (Riley/Hudson): 14 bands up the ladder — first sounds → letter names → letter sounds → short vowels → CVC → digraphs → blends → heart words → silent-e → vowel teams → r-controlled → syllables → endings → sentences. One bit per probe (a letter, a vowel, *sh*, *made*…). A band stops on 2 misses in a row or fewer than 2 hits in 4. An unknown band ends the map; two shaky bands in a row end it too. Legacy shelves **S / L / C / C+** are derived from the frontier.
- Map Track B (Myles): 8 letters, names then sounds then first sounds, 3 tiles. Shelves **A0–A3**.
- **The path is built from the map, per bit.** Known band → its bank module is marked passed. Shaky band → a targeted module from exactly the missed bits (plus one review item), then the bank module. Unknown band (frontier) → bank module, then a targeted module on the whole band, then one stretch band. Nothing past that is auto-assigned; Rudy adds from the shelf.
- Parent desk shows the **Skills map**: every band known / shaky / unknown / not reached with the bits, what was built and why, and *Map again*.
- Periodic **scout** probes (weekly / every 5 dailies). Never cold-open the day with a scout. Kid sees a secret-tunnel adventure. Parent sees a scout report. **Daily path does not auto-change.**
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

Phone and desktop are both first-class. One-phone trips, two doors, big one-thumb targets (88px+), short interruptible sessions, offline / flaky-network pack. Placement is tap-only.

## Voice, listen, PWA

Those are **not** this file. See `docs/agent-lanes.md`. Neural TTS, “what / again” replay, and install-to-home-screen belong on the voiceover PR unless that work is later merged.

## Do not

- Do not invent unpaid fake “natural” voices as the only spoken path.
- Do not put fail language on the kid door.
- Do not auto-rewrite a child’s daily path from a scout.
- Do not teach Cassidy while she is waiting.
- Do not spell Myles as Miles.
