import { SCOUT_MY1, SCOUT_RH1 } from "../lib/banks.ts";
import { bandBitForItem, classifyWord, scoutReportFrom } from "../lib/diagnostic.ts";

const checks = [];
const check = (name, ok) => checks.push([name, ok]);
const at = new Date("2026-09-18T12:00:00Z");

// Every word the scout packs (and the bank) can ask lands on a real band with a bit the band can build from.
const words = [
  ["sit", "cvc", "i"],
  ["pin", "cvc", "i"],
  ["hop", "cvc", "o"],
  ["red", "cvc", "e"],
  ["stop", "blends", "st"],
  ["trip", "blends", "tr"],
  ["ship", "digraphs", "sh"],
  ["duck", "digraphs", "ck"],
  ["thin", "digraphs", "th"],
  ["made", "silent-e", "a_e"],
  ["like", "silent-e", "i_e"],
  ["rain", "vowel-teams", "ai"],
  ["day", "vowel-teams", "ay"],
  ["car", "r-controlled", "ar"],
  ["her", "r-controlled", "er"],
  ["the", "heart-words", "the"],
  ["I", "heart-words", "I"],
  ["cats", "endings", "-s"],
  ["sitting", "endings", "-ing"],
  ["jumped", "endings", "-ed"],
  ["napkin", "syllables", "napkin"],
  ["basket", "syllables", "basket"],
  ["I like a pig.", "sentences", "I like a pig."],
];
for (const [word, band, bit] of words) {
  const got = classifyWord(word);
  check(`classifyWord ${word} → ${band}/${bit}`, got.band === band && got.bit === bit);
}

// Scout items map onto the ladder.
const rh = Object.fromEntries(SCOUT_RH1.map((it) => [it.id, bandBitForItem("words", it)]));
check("RH1-1 sit → cvc i", rh["RH1-1"].band === "cvc" && rh["RH1-1"].bit === "i");
check("RH1-2 build pin → cvc i", rh["RH1-2"].band === "cvc");
check("RH1-3 stop → blends", rh["RH1-3"].band === "blends" && rh["RH1-3"].bit === "st");
check("RH1-5 made → silent-e", rh["RH1-5"].band === "silent-e");
check("RH1-6 say like → silent-e i_e", rh["RH1-6"].band === "silent-e" && rh["RH1-6"].bit === "i_e");
check("RH1-7 line → sentences", rh["RH1-7"].band === "sentences");
const my = Object.fromEntries(SCOUT_MY1.map((it) => [it.id, bandBitForItem("letters", it)]));
check("MY1-1 stamp s → my-names s", my["MY1-1"].band === "my-names" && my["MY1-1"].bit === "s");
check("MY1-4 /m/ → my-sounds m", my["MY1-4"].band === "my-sounds" && my["MY1-4"].bit === "m");
check("MY1-6 park t → my-names t", my["MY1-6"].band === "my-names" && my["MY1-6"].bit === "t");
check("MY1-7 first sound → my-first-sounds /s/", my["MY1-7"].band === "my-first-sounds" && my["MY1-7"].bit === "/s/");

// Riley's tunnel: CVC and blends fine, silent-e missed twice, the line read but pending.
const byId = (id) => SCOUT_RH1.find((it) => it.id === id);
const riley = scoutReportFrom(
  "riley",
  "words",
  [
    { item: byId("RH1-1"), ok: true, ms: 1200 },
    { item: byId("RH1-2"), ok: true, ms: 3000 },
    { item: byId("RH1-3"), ok: true, ms: 1500 },
    { item: byId("RH1-5"), ok: false, ms: 2000 },
    { item: byId("RH1-6"), ok: false, ms: 4000, pending: true, heard: "parent-listen" },
    { item: byId("RH1-7"), ok: true, ms: 2500 },
  ],
  at,
);
const band = (r, id) => r.bands.find((b) => b.id === id);
check("Scout report is real: 6 answered, 4 hits", riley.answered === 6 && riley.hits === 4);
check("Scout: cvc known from two hits", band(riley, "cvc").tag === "known" && band(riley, "cvc").hits === 2);
check("Scout: one hit alone is shaky, never known", band(riley, "blends").tag === "shaky" && band(riley, "sentences").tag === "shaky");
check("Scout: silent-e missed → unknown, missed bit a_e", band(riley, "silent-e").tag === "unknown" && band(riley, "silent-e").missed.join() === "a_e");
check("Scout: pending speak is not a miss", band(riley, "silent-e").answered === 2 && band(riley, "silent-e").hits === 0);
check("Scout: untouched bands are not listed", !band(riley, "heart-words") && riley.bands.length === 4);
check("Scout: ceiling is the highest known band", riley.ceiling === "CVC words");
check("Scout: floor is the first weak band", riley.floor === "Beginning blends");
check("Scout: one draft per weak band with misses, built from the band", riley.drafts.length === 1 && riley.drafts[0].bandId === "silent-e" && riley.drafts[0].bits.join() === "a_e" && riley.drafts[0].title === "Silent-e: a_e");
check("Scout: no hardcoded strings", !JSON.stringify(riley).includes("short-i CVC") && !JSON.stringify(riley).includes("beginning blend\""));
check("Scout: words track carries no readiness flag", riley.readyForPrintWords === undefined && riley.status === "pending" && riley.pack === "RH-1");

// Myles's tunnel, all right: names and sounds known, but one first-sound probe cannot make him ready.
const myAll = scoutReportFrom("myles", "letters", SCOUT_MY1.map((item) => ({ item, ok: true, ms: 1000 })), at);
check("Myles scout: names + sounds known", band(myAll, "my-names").tag === "known" && band(myAll, "my-sounds").tag === "known");
check("Myles scout: a single first-sound hit is shaky", band(myAll, "my-first-sounds").tag === "shaky");
check("Myles scout: not ready for print words on one probe", myAll.readyForPrintWords === false);
check("Myles scout: ceiling Letter sounds, no drafts", myAll.ceiling === "Letter sounds" && myAll.drafts.length === 0 && myAll.floor === "First sounds");
check("Myles scout never spells Miles or prints a word", !JSON.stringify(myAll).includes("Miles") && myAll.drafts.every((d) => d.bits.every((b) => b.length <= 3)));

// Myles missing sounds: draft on exactly the missed letters.
const myMiss = scoutReportFrom(
  "myles",
  "letters",
  SCOUT_MY1.map((item) => ({ item, ok: !(item.id === "MY1-4" || item.id === "MY1-5"), ms: 1000 })),
  at,
);
check("Myles scout: missed sounds → unknown band, draft on m, i", band(myMiss, "my-sounds").tag === "unknown" && myMiss.drafts[0].bandId === "my-sounds" && myMiss.drafts[0].bits.join() === "m,i");

// An empty tunnel (that's enough on the first card) still reports honestly.
const none = scoutReportFrom("hudson", "words", [], at);
check("Empty scout: nothing known, nothing found", none.bands.length === 0 && none.ceiling === "none yet" && none.floor === "none found" && none.drafts.length === 0);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} scout report checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} scout report checks passed.`);
