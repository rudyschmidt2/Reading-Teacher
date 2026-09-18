import {
  BANDS_LETTERS,
  BANDS_WORDS,
  SITTING_CAP,
  answerProbe,
  bandReports,
  bandsForModule,
  buildBandModule,
  currentProbe,
  finishDiagnostic,
  practicePrefill,
  printWordsReady,
  refreshReport,
  regradeRow,
  seedsToBits,
  speedMs,
  startDiagnostic,
  startHere,
} from "../lib/diagnostic.ts";
import { isSpokenHit } from "../lib/phonemes.ts";

// Drive the engine with a "kid" who knows a given set of bands and bits.
// `ms` may be a number or a function of the probe; `spoken` decides what the
// ear does on a speak probe (default: graded like a tap).
function run(track, knows, opts = {}) {
  let p = startDiagnostic(track, new Date("2026-09-14T00:00:00Z"));
  let guard = 0;
  while (p.cursor && guard++ < 500) {
    const probe = currentProbe(p);
    const ok = knows(probe.band, probe.bit, probe);
    const ms = typeof opts.ms === "function" ? opts.ms(probe) : opts.ms ?? 900;
    const spoken = probe.kind === "speak" && opts.spoken ? opts.spoken(probe, ok) : undefined;
    p = answerProbe(p, probe, ok, ms, new Date("2026-09-14T00:00:01Z"), spoken);
  }
  return p;
}

const status = (report, id) => report.bands.find((b) => b.id === id).status;
const checks = [];
const check = (name, ok) => checks.push([name, ok]);

// Every tap probe has a real answer among its choices, unique ids, and every bit builds items.
for (const band of [...BANDS_WORDS, ...BANDS_LETTERS]) {
  for (const pr of band.probes) {
    if (pr.kind === "speak") {
      check(`${pr.id} speak probe has a target and no cards`, Boolean(pr.speakTarget) && pr.choices.length === 0 && pr.widget === "say");
      check(`${pr.id} target is heard as a hit`, isSpokenHit(pr.print ?? pr.speakTarget, pr.speakTarget));
      check(
        `${pr.id} prompt never reads the answer aloud`,
        !pr.print || !pr.prompt.toLowerCase().split(/[^a-z']+/).includes(pr.print.toLowerCase().replace(/\.$/, "")),
      );
    } else {
      check(`${pr.id} correct is a choice`, pr.choices.some((c) => c.id === pr.correctId));
      check(`${pr.id} has 3+ choices`, pr.choices.length >= 3);
    }
    check(`${pr.id} builds items for ${pr.bit}`, band.items(pr.bit).length >= 2);
  }
  const speaks = band.probes.filter((p) => p.kind === "speak");
  check(`${band.id} carries exactly one speak probe, last`, speaks.length === 1 && band.probes[band.probes.length - 1].kind === "speak");
}
const ids = [...BANDS_WORDS, ...BANDS_LETTERS].flatMap((b) => b.probes.map((p) => p.id));
check("probe ids unique", new Set(ids).size === ids.length);
check("Track A is a real ladder (14 bands, 60+ tap probes + 14 speak)", BANDS_WORDS.length === 14 && ids.length > 74);
check("Track B stays at 8 letters, 3 tiles", BANDS_LETTERS[0].probes.filter((p) => p.kind !== "speak").length === 8 && BANDS_LETTERS[0].probes.every((p) => p.kind === "speak" || p.choices.length === 3));
check("Track B never prints a word", BANDS_LETTERS.every((b) => b.probes.every((p) => !p.print || p.print.length === 1)));
check("word bands read a word, sentences read a line", BANDS_WORDS.find((b) => b.id === "cvc").probes.at(-1).print === "sat" && BANDS_WORDS.find((b) => b.id === "sentences").probes.at(-1).print === "I sit.");

// Riley: solid through CVC, missing th and ck, no blends yet.
const rileyP = run("words", (band, bit) => {
  if (["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(band)) return true;
  if (band === "digraphs") return bit === "sh" || bit === "ch";
  return false;
});
const riley = finishDiagnostic("riley", rileyP, "t1");
check("Riley finished", !rileyP.cursor);
check("Riley: cvc known", status(riley.report, "cvc") === "known");
check("Riley: digraphs shaky", status(riley.report, "digraphs") === "shaky");
check("Riley: digraphs missed th, ck", riley.report.bands.find((b) => b.id === "digraphs").missed.join() === "th,ck");
check("Riley: blends unknown (frontier)", status(riley.report, "blends") === "unknown" && riley.report.frontier === "digraphs");
check("Riley: heart words not reached", status(riley.report, "heart-words") === "not-reached");
check("Riley: the note names the same frontier as report.frontier (one definition)", riley.report.note.includes("Frontier: digraphs (shaky") && riley.report.note.includes("Stopped at beginning blends"));
check("Hudson-style no frontier never says Frontier", !finishDiagnostic("hudson", run("words", () => true), "t0").report.note.includes("Frontier"));
check("Riley shelf C+", riley.report.shelf === "C+");
const rileyPath = riley.built.path;
check("Riley path: targeted digraph module first", rileyPath[0] === "dx-riley-digraphs-t1");
check("Riley path: then bank digraphs, blends, blend fix, then heart stretch", rileyPath.slice(1).join() === "rh-digraphs,rh-blends,dx-riley-blends-t1,rh-heart");
check("Riley: known bank modules marked passed", ["rh-sound-speed", "rh-letters", "rh-vowel-contrast", "rh-cvc-smash"].every((id) => riley.built.passed.includes(id)));
const dxDig = riley.built.modules.find((m) => m.id === "dx-riley-digraphs-t1");
check("Riley digraph module targets thin and duck", dxDig.items.some((i) => i.word === "thin") && dxDig.items.some((i) => i.word === "duck"));
check("Riley digraph module keeps one review item", dxDig.items.some((i) => i.word === "ship"));
check("Riley digraph module has drag + speak", dxDig.items.some((i) => i.kind === "drag") && dxDig.items.some((i) => i.kind === "speak"));

// Hudson: knows everything. No frontier, everything passed, one maintenance module.
const hudsonP = run("words", () => true);
const hudson = finishDiagnostic("hudson", hudsonP, "t2");
check("Hudson: all bands known", hudson.report.bands.every((b) => b.status === "known"));
check("Hudson: shelf C+, no frontier", hudson.report.shelf === "C+" && hudson.report.frontier === undefined);
check("Hudson: path is sentences only", hudson.built.path.join() === "rh-sentences" && hudson.built.modules.length === 0);
check("Hudson answered every probe", hudsonP.rows.length === ids.length - BANDS_LETTERS.reduce((n, b) => n + b.probes.length, 0));

// A kid who cannot hear first sounds: two misses stop the band and the map.
const coldP = run("words", () => false);
const cold = finishDiagnostic("kid", coldP, "t3");
check("Cold: stopped after 2 probes", coldP.rows.length === 2);
check("Cold: first sounds unknown, rest not reached", status(cold.report, "first-sounds") === "unknown" && status(cold.report, "letter-names") === "not-reached");
check("Cold: shelf S", cold.report.shelf === "S");
check("Cold: path is sound-speed + targeted + letters stretch", cold.built.path.join() === "rh-sound-speed,dx-kid-first-sounds-t3,rh-letters");

// Two shaky bands in a row end the map.
const wobblyP = run("words", (band, bit) => {
  if (band === "first-sounds") return true;
  if (band === "letter-names") return ["s", "a", "t", "p"].includes(bit);
  if (band === "letter-sounds") return ["s", "t", "p"].includes(bit);
  return true;
});
check("Wobbly: shaky names then shaky sounds ends the map", !wobblyP.cursor && bandReports(wobblyP).find((b) => b.id === "short-vowels").status === "not-reached");
const wobbly = finishDiagnostic("kid", wobblyP, "t4");
check("Wobbly: rh-letters on path, not passed", wobbly.built.path.includes("rh-letters") && !wobbly.built.passed.includes("rh-letters"));
check("Wobbly shelf L", wobbly.report.shelf === "L");

// Resume: progress is plain data; cutting a sitting at the cap and continuing lands the same place.
let split = startDiagnostic("words");
let count = 0;
while (split.cursor) {
  const probe = currentProbe(split);
  split = answerProbe(split, probe, true, 500);
  count += 1;
  if (count === SITTING_CAP) split = JSON.parse(JSON.stringify(split));
}
check("Resume across a sitting cap reaches the end", !split.cursor && split.rows.length === hudsonP.rows.length);

// Myles: names solid, sounds only s and a.
const mylesP = run("letters", (band, bit) => band === "my-names" || (band === "my-sounds" && (bit === "s" || bit === "a")));
const myles = finishDiagnostic("myles", mylesP, "t5");
check("Myles: names known, sounds shaky, first sounds not reached", status(myles.report, "my-names") === "known" && status(myles.report, "my-sounds") === "shaky" && status(myles.report, "my-first-sounds") !== "known");
check("Myles shelf A1", myles.report.shelf === "A1");
check("Myles: letter-names bank passed, targeted sounds first", myles.built.passed.includes("my-letter-names") && myles.built.path[0] === "dx-myles-my-sounds-t5");
check("Myles: no word modules", myles.built.modules.every((m) => m.track === "letters") && myles.built.path.every((id) => id.startsWith("my-") || id.startsWith("dx-myles-my-")));
check("Myles: modules never spell Miles", JSON.stringify(myles).includes("Miles") === false);

// Myles who knows everything gets air-trace as stretch.
const mylesAll = finishDiagnostic("myles", run("letters", () => true), "t6");
check("Myles all known: shelf A3, find-it + air-trace", mylesAll.report.shelf === "A3" && mylesAll.built.path.join() === "my-find-it,my-air-trace");

// --- Speak probes: graded through the ear, pending when nobody heard ------------------------------

// A kid who taps everything right but every spoken answer goes to "Parent will listen".
const quietP = run("words", () => true, { spoken: () => ({ pending: true, heard: "parent-listen" }) });
const quiet = finishDiagnostic("hudson", quietP, "t7");
check("Pending speak rows are neither hits nor misses", quietP.rows.filter((r) => r.pending).every((r) => r.ok === false) && quietP.rows.filter((r) => r.pending).length === 14);
check("Pending speak never holds a band back", quiet.report.bands.every((b) => b.status === "known"));
check("Report counts pending speak per band", quiet.report.bands.every((b) => b.speak && b.speak.pending === 1 && b.speak.hits === 0));
check("Note tells the parent spoken answers wait", quiet.report.note.includes("14 spoken answers wait"));

// Parent grades one later: the row flips, the report refreshes, the path does not.
const regraded = regradeRow(quietP, "DX-cvc-say", true);
check("regradeRow flips the pending row to a hit", regraded.rows.find((r) => r.probeId === "DX-cvc-say").ok === true && !regraded.rows.find((r) => r.probeId === "DX-cvc-say").pending);
check("regradeRow leaves other rows alone", regraded.rows.filter((r) => r.pending).length === 13);
check("regradeRow on a graded row is a no-op", regradeRow(regraded, "DX-cvc-say", false) === regraded);
const refreshed = refreshReport(quiet.report, regraded);
check("refreshReport re-reads the cvc speak hit", refreshed.bands.find((b) => b.id === "cvc").speak.hits === 1 && refreshed.note.includes("13 spoken"));
check("refreshReport keeps what was built", refreshed.built === quiet.report.built && refreshed.pathNote === quiet.report.pathNote);

// A kid who reads the word but cannot say it: a missed speak probe makes the bit shaky, not the band unknown.
const mumbleP = run("words", (band, bit, probe) => probe.kind !== "speak", { spoken: (probe, ok) => ({ heard: ok ? probe.speakTarget : "um" }) });
const mumble = finishDiagnostic("riley", mumbleP, "t8");
check("Missed speak counts as a miss on that bit", mumble.report.bands.find((b) => b.id === "cvc").missed.join() === "a" && mumble.report.bands.find((b) => b.id === "cvc").speak.misses === 1);
check("A bit hit on tap but missed on speak is not known", !mumble.report.bands.find((b) => b.id === "cvc").known.includes("a"));
check("Five tap hits keep CVC known even with the speak miss", status(mumble.report, "cvc") === "known");
check("Three tap hits + speak miss make sentences shaky", status(mumble.report, "sentences") === "shaky" || status(mumble.report, "sentences") === "not-reached");

// --- Speed: average ms on real tap hits, per band and overall ----------------------------------

const speedyP = run("words", () => true, { ms: (probe) => (probe.kind === "speak" ? 9000 : probe.band === "cvc" ? 2000 : 1000) });
const speedy = finishDiagnostic("hudson", speedyP, "t9");
check("speedMs ignores speak rows", speedMs(speedyP.rows.filter((r) => r.band === "cvc")) === 2000);
check("Per-band avgMs lands in the report", speedy.report.bands.find((b) => b.id === "cvc").avgMs === 2000 && speedy.report.bands.find((b) => b.id === "digraphs").avgMs === 1000);
check("Overall speedMs in the report", speedy.report.speedMs > 1000 && speedy.report.speedMs < 2000 && speedy.report.note.includes("Speed:"));
check("Band with no hits has no speed", finishDiagnostic("kid", run("words", () => false), "t10").report.bands.find((b) => b.id === "first-sounds").avgMs === undefined);

// --- Myles readiness rule --------------------------------------------------------------------------

check("Ready needs letter sounds AND first sounds known", printWordsReady("letters", mylesAll.report.bands) === true);
check("Names alone do not open words", printWordsReady("letters", myles.report.bands) === false && myles.report.readyForPrintWords === false);
const soundsOnlyP = run("letters", (band) => band !== "my-first-sounds");
check("Sounds known, first sounds unknown: not ready", finishDiagnostic("myles", soundsOnlyP, "t11").report.readyForPrintWords === false);
check("Full Myles map sets the flag", mylesAll.report.readyForPrintWords === true);
check("Words track has no flag to set", hudson.report.readyForPrintWords === undefined && printWordsReady("words", []) === true);

// --- Start here: parent picks the band the path begins at --------------------------------------

const sh = startHere("riley", "words", riley.report.bands, "blends", ["dx-riley-digraphs-t1", "rh-digraphs", "custom-123"], "s1");
check("Start here: earlier bank modules marked passed", sh.passed.join() === "rh-sound-speed,rh-letters,rh-vowel-contrast,rh-cvc-smash,rh-digraphs");
check("Start here: path begins at the band's bank module", sh.path[0] === "rh-blends");
check("Start here: targeted module on the band's missed bits", sh.path[1] === "dx-riley-blends-s1" && sh.modules.length === 1 && sh.modules[0].items.some((i) => i.word === "stop"));
check("Start here: then the rest of the ladder", sh.path.slice(2, 5).join() === "rh-heart,rh-silent-e,rh-vowel-teams");
check("Start here: parent-made module stays, old map module goes", sh.path.includes("custom-123") && !sh.path.includes("dx-riley-digraphs-t1"));
check("Start here: nothing on the new path counts as passed", sh.unpassed.every((id) => !sh.passed.includes(id)));
const shLetters = startHere("riley", "words", riley.report.bands, "letter-sounds", [], "s2");
check("Start here: a bank module shared with a later band is not passed", !shLetters.passed.includes("rh-letters") && shLetters.path[0] === "rh-letters");
const shMyles = startHere("myles", "letters", myles.report.bands, "my-sounds", myles.built.path, "s3");
check("Start here for Myles: names passed, sounds first, air-trace last", shMyles.passed.join() === "my-letter-names" && shMyles.path[0] === "my-letter-sounds" && shMyles.path.at(-1) === "my-air-trace");
check("Start here: unknown band is undefined", startHere("riley", "words", riley.report.bands, "nope", []) === undefined);

// --- Practice these: pre-fill the form with the band's own item makers -----------------------------

const digBand = BANDS_WORDS.find((b) => b.id === "digraphs");
const pre = practicePrefill(digBand, ["th", "ck"]);
check("Prefill title, skill, seeds, band", pre.title === "Digraphs: th, ck" && pre.skill === digBand.teaches && pre.seeds === "th, ck" && pre.bandId === "digraphs");
check("Prefill drops bits the band cannot build", practicePrefill(digBand, ["zz", "sh"]).bits.join() === "sh");
check("Prefill with nothing valid falls back to the whole band", practicePrefill(digBand, []).bits.join() === "sh,ch,th,ck");
check("seedsToBits parses commas and lines", seedsToBits("th, ck\nsh, th").join() === "th,ck,sh");
const prMod = buildBandModule("riley", "words", "digraphs", seedsToBits(pre.seeds), "p1", pre.title);
check("Practice module uses the band's makers", prMod.id === "pr-riley-digraphs-p1" && prMod.items.some((i) => i.word === "thin") && prMod.items.some((i) => i.word === "duck") && !prMod.items.some((i) => i.word === "ship"));
check("Practice module has tap, drag, and speak", ["tap", "drag", "speak"].every((k) => prMod.items.some((i) => i.kind === k)));
check("Practice module keeps the parent's title", prMod.title === "Digraphs: th, ck");
check("Practice module for a letters band stays letters", buildBandModule("myles", "letters", "my-sounds", ["s", "a"], "p2").track === "letters");
check("Practice module for an unknown band is undefined", buildBandModule("riley", "words", "nope", ["x"]) === undefined);

// --- Module ↔ band lookup for the grading sheet ------------------------------------------------------

check("bandsForModule finds the bank module's band", bandsForModule("words", "rh-blends", "riley").map((b) => b.id).join() === "blends");
check("bandsForModule finds both bands behind rh-letters", bandsForModule("words", "rh-letters", "riley").map((b) => b.id).join() === "letter-names,letter-sounds");
check("bandsForModule finds map and practice modules for this kid only", bandsForModule("words", "dx-riley-digraphs-t1", "riley")[0].id === "digraphs" && bandsForModule("words", "pr-riley-digraphs-p1", "riley")[0].id === "digraphs" && bandsForModule("words", "dx-riley-digraphs-t1", "hudson").length === 0);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} diagnostic checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} diagnostic checks passed.`);
