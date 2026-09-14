import {
  BANDS_LETTERS,
  BANDS_WORDS,
  SITTING_CAP,
  answerProbe,
  bandReports,
  currentProbe,
  finishDiagnostic,
  startDiagnostic,
} from "../lib/diagnostic.ts";

// Drive the engine with a "kid" who knows a given set of bands and bits.
function run(track, knows) {
  let p = startDiagnostic(track, new Date("2026-09-14T00:00:00Z"));
  let guard = 0;
  while (p.cursor && guard++ < 500) {
    const probe = currentProbe(p);
    const ok = knows(probe.band, probe.bit);
    p = answerProbe(p, probe, ok, 900, new Date("2026-09-14T00:00:01Z"));
  }
  return p;
}

const status = (report, id) => report.bands.find((b) => b.id === id).status;
const checks = [];
const check = (name, ok) => checks.push([name, ok]);

// Every probe has a real answer among its choices, unique ids, and every bit builds items.
for (const band of [...BANDS_WORDS, ...BANDS_LETTERS]) {
  for (const pr of band.probes) {
    check(`${pr.id} correct is a choice`, pr.choices.some((c) => c.id === pr.correctId));
    check(`${pr.id} has 3+ choices`, pr.choices.length >= 3);
    check(`${pr.id} builds items for ${pr.bit}`, band.items(pr.bit).length >= 2);
  }
}
const ids = [...BANDS_WORDS, ...BANDS_LETTERS].flatMap((b) => b.probes.map((p) => p.id));
check("probe ids unique", new Set(ids).size === ids.length);
check("Track A is a real ladder (14 bands, 60+ probes)", BANDS_WORDS.length === 14 && ids.length > 60);
check("Track B stays at 8 letters, 3 tiles", BANDS_LETTERS[0].probes.length === 8 && BANDS_LETTERS[0].probes.every((p) => p.choices.length === 3));

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

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} diagnostic checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} diagnostic checks passed.`);
