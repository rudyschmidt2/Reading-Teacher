import { BANK_MODULES } from "../lib/banks.ts";
import { STARTER_KIDS } from "../lib/catalog.ts";
import {
  PASS_NEED,
  isHit,
  kidNextModule,
  moduleFunctionGrades,
  moduleFunctions,
  moduleProgress,
  moduleStats,
  passWindow,
  rollupDimension,
  struggleStopped,
  verdictProvenance,
} from "../lib/grades.ts";

// Every case here was a wrong number on Rudy's desk before this file existed
// (logic-audit.md A1–A8). Each check names the bug it pins.

const checks = [];
const check = (name, ok, detail = "") => checks.push([name, ok, detail]);

const riley = { ...STARTER_KIDS.find((k) => k.id === "riley"), held: [], plan: { gate: "path", moduleStretch: {}, review: [], proposals: [] } };
const myles = { ...STARTER_KIDS.find((k) => k.id === "myles"), held: [], plan: { gate: "path", moduleStretch: {}, review: [], proposals: [] } };
const letters = BANK_MODULES.find((m) => m.id === "rh-letters");
const cvc = BANK_MODULES.find((m) => m.id === "rh-cvc-smash");
const myNames = BANK_MODULES.find((m) => m.id === "my-letter-names");

let n = 0;
const att = (over = {}) => ({
  id: `a${n++}`,
  kidId: "riley",
  moduleId: letters.id,
  itemId: letters.items[n % letters.items.length].id,
  version: 0,
  kind: "tap",
  dimension: "letterRecognition",
  correct: true,
  ms: 800,
  at: `2026-09-18T10:00:${String(n).padStart(2, "0")}Z`,
  kidSaw: "star",
  source: "daily",
  ...over,
});
const hit = (o) => att({ correct: true, ...o });
const miss = (o) => att({ correct: false, kidSaw: "not that one", ...o });
const pending = (o) => att({ correct: false, kind: "speak", dimension: "speaking", spokenGrade: "pending", spokenText: "parent-listen", kidSaw: "parent will listen", ...o });
const many = (k, f) => Array.from({ length: k }, () => f());

// A1: a parent-graded spoken Hit is a hit everywhere.
const gradedHit = pending({ spokenGrade: "hit", correct: true, gradedAt: "2026-09-18T12:00:00Z" });
check("A1: isHit reads a parent-graded Hit as a hit", isHit(gradedHit));
check("A1: speaking row counts the graded Hit", moduleFunctionGrades(riley, letters, [gradedHit]).find((g) => g.key === "speaking").correct === 1);
check("A1: desk rollup counts the graded Hit", rollupDimension(riley, [gradedHit], "speaking").hits === 1 && rollupDimension(riley, [gradedHit], "speaking").misses === 0);
const gradedMiss = pending({ spokenGrade: "miss", correct: false, gradedAt: "x" });
check("A1: a parent-graded Miss is a miss", !isHit(gradedMiss) && rollupDimension(riley, [gradedMiss], "speaking").misses === 1);

// A2: pending spoken tries are neither misses nor a struggle-stop.
const twoPending = [pending(), pending()];
check("A2: two pending speaks are not a struggle-stop", struggleStopped(twoPending) === false);
check("A2: pending speaks are not misses on the module", moduleStats("riley", letters, twoPending).misses === 0 && moduleStats("riley", letters, twoPending).pending === 2);
check("A2: module status stays in progress with only pending speaks", moduleProgress(riley, letters, twoPending).status === "in-progress");
check("A2: desk rollup shows 0 misses and 2 waiting", (() => {
  const r = rollupDimension(riley, twoPending, "speaking");
  return r.misses === 0 && r.pendingSpeak === 2;
})());
check("A2: six pending speaks never auto-fail", moduleStats("riley", letters, many(6, pending)).auto === "open");
check("A2: struggle-stop still fires on two real misses", struggleStopped([hit(), miss(), miss()]) === true);
check("A2: a pending try between two misses does not break the stop", struggleStopped([miss(), pending(), miss()]) === true);

// A3: the pass rule is a window with an accuracy term, not a lifetime count.
check("A3: 8 cold hits + 12 misses is not a pass", moduleStats("riley", letters, [...many(8, hit), ...many(12, miss)]).auto === "fail");
check("A3: 8 of the last 10 cold right passes", passWindow([...many(2, miss), ...many(8, hit)], 4).verdict === "pass");
check("A3: 7 of 10 stays open", passWindow([...many(3, miss), ...many(7, hit)], 4).verdict === "open");
check("A3: retries on the same card are not in the window", passWindow(many(9, () => hit({ version: 1 })), 4).verdict === "open");
check("A3: 4 cold hits on a 4-item module is not enough yet", passWindow(many(4, hit), 4).verdict === "open");
check("A3: coverage matters — 8 hits on one item of five stays open", passWindow(many(8, () => hit({ itemId: "only-one" })), 5).verdict === "open");
check("A3: fail needs six graded and more misses than hits", passWindow([...many(2, hit), ...many(4, miss)], 4).verdict === "fail" && passWindow([...many(2, hit), ...many(3, miss)], 4).verdict === "open");
check("A3: PASS_NEED is 8", PASS_NEED === 8);

// A4: scout rows never feed a module's verdict.
const scoutHits = many(4, () => hit({ source: "scout", moduleId: "scout:RH-1" }));
const scoutOnModule = many(4, () => hit({ source: "scout" }));
check("A4: scout hits recorded under the module still do not count", moduleStats("riley", letters, [...scoutOnModule, ...many(4, hit)]).coldHits === 4);
check("A4: scout rows are excluded from module attempts entirely", moduleStats("riley", letters, scoutHits).hits === 0);

// A5: desk rollup and grades page read the same rows.
const placementRows = [miss({ source: "placement", moduleId: "placement" }), hit({ source: "placement", moduleId: "placement", version: 1 })];
check("A5: placement probes never enter the desk rollup", rollupDimension(riley, placementRows, "letterRecognition").hits === 0 && rollupDimension(riley, placementRows, "letterRecognition").misses === 0);
check("A5: scout rows never enter the desk rollup", rollupDimension(riley, scoutHits, "letterRecognition").hits === 0);
check("A5: desk speed uses cold word hits only", (() => {
  const rows = [hit({ dimension: "words", ms: 1000 }), hit({ dimension: "words", ms: 3000, version: 1 }), hit({ dimension: "words", ms: 5000, kind: "speak" })];
  return rollupDimension(riley, rows, "speed").avgMs === 1000;
})());

// A6: no fake 0%.
check("A6: an unplayed module has no percentage", moduleProgress(riley, letters, []).pct === undefined && moduleProgress(riley, letters, []).attempted === false);
check("A6: an unplayed function has no percentage", moduleFunctionGrades(riley, letters, []).every((g) => g.pct === undefined));
check("A6: a played module has a percentage", moduleProgress(riley, letters, [hit()]).pct !== undefined);

// A7: no word-speed grade on a letters module.
check("A7: a letters-only module has no Speed function", !moduleFunctions(myNames).includes("speed"));
check("A7: a word module keeps Speed", moduleFunctions(cvc).includes("speed"));
check("A7: Myles rollup keeps speed locked", rollupDimension(myles, [], "speed").status === "not-in-play");

// A8: verdicts remember who set them.
const mapPass = { verdict: "pass", by: "map", at: "2026-09-18T00:00:00Z" };
check("A8: a map pass reads as passed", moduleProgress(riley, letters, [], mapPass).status === "passed" && moduleProgress(riley, letters, [], mapPass).by === "map");
check("A8: a map pass with no play has no fake progress", moduleProgress(riley, letters, [], mapPass).pct === undefined);
check("A8: provenance says the map, not you", verdictProvenance(moduleProgress(riley, letters, [], mapPass)).startsWith("Passed on the skills map"));
check("A8: a parent verdict says set by you", verdictProvenance(moduleProgress(riley, letters, [miss()], { verdict: "pass", by: "parent", at: "" })).startsWith("Set by you"));
check("A8: an auto pass says how", verdictProvenance(moduleProgress(riley, letters, many(8, hit), { verdict: "pass", by: "auto", at: "" })).includes("8 of 8 cold tries"));
check("A8: a bare string verdict still works (legacy callers)", moduleStats("riley", letters, [], "pass").verdict === "pass");

// D2: the path never falls back to the last module.
const house = { modules: BANK_MODULES, verdicts: { "riley:rh-letters": mapPass, "riley:rh-cvc-smash": mapPass } };
check("D2: every module passed → no next module (not a replay)", kidNextModule({ ...riley, path: ["rh-letters", "rh-cvc-smash"] }, house) === undefined);
check("D2: first unpassed module is next", kidNextModule({ ...riley, path: ["rh-letters", "rh-cvc-smash", "rh-digraphs"] }, house).id === "rh-digraphs");
check("D4: a word module is skipped for a letters kid", kidNextModule({ ...myles, path: ["rh-cvc-smash", "my-letter-names"] }, { modules: BANK_MODULES, verdicts: {} }).id === "my-letter-names");

// Review sessions count as lessons.
check("review rows count as lessons", moduleStats("riley", letters, [hit({ source: "review" })]).hits === 1);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, detail] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
if (failed.length) {
  console.error(`\n${failed.length} grade checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} grade checks passed.`);
