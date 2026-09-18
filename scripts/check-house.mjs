import { STARTER_KIDS, STARTER_MODULES } from "../lib/catalog.ts";
import { answerProbe, bandsFor, currentProbe, finishDiagnostic, startDiagnostic, startHere } from "../lib/diagnostic.ts";
import { HOUSE_VERSION, emptyHouse, migrateHouse, withPath } from "../lib/house.ts";

const checks = [];
const check = (name, ok, detail = "") => checks.push([name, ok, detail]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const reload = (house) => migrateHouse(JSON.parse(JSON.stringify(house)));
const riley = () => STARTER_KIDS.find((k) => k.id === "riley");

// Empty house.
const fresh = emptyHouse();
check("empty house is on the current version", fresh.version === HOUSE_VERSION && HOUSE_VERSION === 3);
check("empty house has sessions and a plan per kid", Array.isArray(fresh.sessions) && fresh.kids.every((k) => k.plan && k.plan.gate === "path"));
check("empty house carries every starter module", fresh.modules.length === STARTER_MODULES.length);
check("loading the empty house twice changes nothing", same(reload(reload(fresh)), reload(fresh)));

// withPath: the held list follows the path.
const r0 = { ...riley(), held: [] };
const dropped = r0.path[1];
const r1 = withPath(r0, r0.path.filter((id) => id !== dropped));
check("dropping a module remembers it as held", r1.held.length === 1 && r1.held[0] === dropped && !r1.path.includes(dropped));
const r2 = withPath(r1, [...r1.path, dropped]);
check("adding it back clears held", r2.held.length === 0 && r2.path.includes(dropped));
const r3 = withPath(r1, r1.path.slice(0, 2));
check("held accumulates across drops", r3.held.length === 1 + (r1.path.length - 2));
check("withPath never mutates the kid it was given", r0.path.length === riley().path.length && r0.held.length === 0);

// D1: a v2 house keeps a short path across loads.
const short = ["rh-digraphs", "rh-blends"];
const v2 = { ...fresh, kids: fresh.kids.map((k) => (k.id === "riley" ? withPath(k, short) : k)) };
const v2a = reload(v2);
const v2b = reload(v2a);
check("v2: a 2-module path is still 2 modules after a load", same(v2a.kids.find((k) => k.id === "riley").path, short));
check("v2: and after another load", same(v2b.kids.find((k) => k.id === "riley").path, short));
check("v2: the held list survives the reload", (() => {
  const held = v2b.kids.find((k) => k.id === "riley").held;
  return riley().path.filter((id) => !short.includes(id)).every((id) => held.includes(id));
})());
check("v2: a hold survives a reload", (() => {
  const held = reload({ ...fresh, kids: fresh.kids.map((k) => (k.id === "hudson" ? withPath(k, k.path.filter((id) => id !== "rh-cvc-smash")) : k)) });
  const h = held.kids.find((k) => k.id === "hudson");
  return !h.path.includes("rh-cvc-smash") && h.held.includes("rh-cvc-smash");
})());

// D1: Start here survives a hard refresh.
const reports = bandsFor("words").map((b) => ({ id: b.id, title: b.title, status: "unknown", hits: 0, answered: 0, total: b.probes.length, known: [], missed: [] }));
const plan = startHere("riley", "words", reports, "digraphs", riley().path, "t1");
check("startHere builds a plan for digraphs", Boolean(plan) && plan.path.length > 0 && plan.path.length < riley().path.length);
const afterStart = { ...fresh, modules: [...fresh.modules, ...plan.modules], kids: fresh.kids.map((k) => (k.id === "riley" ? withPath(k, plan.path) : k)) };
const refreshed = reload(reload(afterStart));
check("Start here path is identical after two loads", same(refreshed.kids.find((k) => k.id === "riley").path, plan.path));
check("Start here held the earlier bank modules", plan.passed.every((id) => refreshed.kids.find((k) => k.id === "riley").held.includes(id)));

// v1 → v2 migration.
const v1 = JSON.parse(JSON.stringify({ ...fresh, version: 1 }));
for (const k of v1.kids) delete k.held;
const m1 = migrateHouse(v1);
check("v1 migrates all the way to the current version", m1 && m1.version === HOUSE_VERSION);
check("v1 kids get an empty held list", m1.kids.every((k) => Array.isArray(k.held) && k.held.length === 0));
check("v1 paths are kept as saved", same(m1.kids.map((k) => k.path), v1.kids.map((k) => k.path)));
check("migrated house is stable across loads", same(reload(m1), reload(reload(m1))));

// v1 repair: the audit's live case. Riley's map built a 5-module path; v1's
// load() then back-filled every starter module on top of it.
let rileyMap = startDiagnostic("words", new Date("2026-09-14T00:00:00Z"));
while (rileyMap.cursor) {
  const pr = currentProbe(rileyMap);
  const ok = ["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(pr.band) || (pr.band === "digraphs" && (pr.bit === "sh" || pr.bit === "ch"));
  rileyMap = answerProbe(rileyMap, pr, ok, 900, new Date("2026-09-14T00:00:01Z"));
}
const rileyDone = finishDiagnostic("riley", rileyMap, "t1");
const mapPath = rileyDone.built.path;
const inflatedPath = [...mapPath, ...riley().path.filter((id) => !mapPath.includes(id))];
const inflated = JSON.parse(JSON.stringify({
  ...fresh,
  version: 1,
  modules: [...fresh.modules, ...rileyDone.built.modules],
  verdicts: Object.fromEntries(rileyDone.built.passed.map((id) => [`riley:${id}`, "pass"])),
  kids: fresh.kids.map((k) => (k.id === "riley" ? { ...k, path: inflatedPath, diagnostic: rileyMap, diagnosticReport: rileyDone.report } : k)),
}));
for (const k of inflated.kids) delete k.held;
check("fixture: the map path is 5 modules and v1 inflated it past 10", mapPath.length === 5 && inflatedPath.length > 10);
const repaired = migrateHouse(inflated).kids.find((k) => k.id === "riley");
check("v1 repair brings the path back to exactly what the map built, in order", repaired.path.join() === mapPath.join(), repaired.path.join());
check("v1 repair records every module it took off as held", inflatedPath.filter((id) => !mapPath.includes(id)).every((id) => repaired.held.includes(id)));
check("v1 repair is stable on the next load", same(reload(migrateHouse(inflated)).kids.find((k) => k.id === "riley").path, mapPath));
check("v1 repair leaves a module the kid played alone", (() => {
  const withPlay = { ...inflated, attempts: [{ id: "a", kidId: "riley", moduleId: "rh-endings", itemId: "x", version: 0, kind: "tap", dimension: "words", correct: true, ms: 1, at: "", kidSaw: "star", source: "daily" }] };
  return migrateHouse(withPlay).kids.find((k) => k.id === "riley").path.includes("rh-endings");
})());
check("v1 repair leaves a module Rudy graded alone", (() => {
  const graded = { ...inflated, verdicts: { ...inflated.verdicts, "riley:rh-silent-e": "open" } };
  return migrateHouse(graded).kids.find((k) => k.id === "riley").path.includes("rh-silent-e");
})());
check("v1 repair does not touch an unmapped kid's path", same(migrateHouse(inflated).kids.find((k) => k.id === "hudson").path, riley().path));

// v2 → v3: bare verdicts gain provenance; sessions and plans appear.
const v2house = JSON.parse(JSON.stringify({ ...fresh, version: 2, verdicts: { "riley:rh-letters": "pass", "riley:rh-cvc-smash": "open", "hudson:rh-digraphs": "pass" }, attempts: [{ id: "a", kidId: "hudson", moduleId: "rh-digraphs", itemId: "x", version: 0, kind: "tap", dimension: "words", correct: true, ms: 1, at: "", kidSaw: "star", source: "daily" }] }));
delete v2house.sessions;
for (const k of v2house.kids) delete k.plan;
const m2 = migrateHouse(v2house);
check("v2 migrates to v3", m2 && m2.version === 3);
check("v2: a pass nobody played is the map's", m2.verdicts["riley:rh-letters"].verdict === "pass" && m2.verdicts["riley:rh-letters"].by === "map");
check("v2: a pass on a module the kid played was the parent's", m2.verdicts["hudson:rh-digraphs"].by === "parent");
check("v2: an open verdict was the parent's", m2.verdicts["riley:rh-cvc-smash"].verdict === "open" && m2.verdicts["riley:rh-cvc-smash"].by === "parent");
check("v2: sessions start empty and every kid gets a plan", Array.isArray(m2.sessions) && m2.kids.every((k) => k.plan && Array.isArray(k.plan.review) && Array.isArray(k.plan.proposals)));
check("v2 → v3 is stable across loads", same(reload(m2), reload(reload(m2))));
check("v3 verdict records survive a reload untouched", reload(m2).verdicts["riley:rh-letters"].by === "map");

// Library still back-fills; the path does not.
const missingLib = { ...fresh, modules: fresh.modules.slice(1) };
const libFixed = reload(missingLib);
check("a starter module missing from the library comes back", libFixed.modules.length === STARTER_MODULES.length);
check("but nothing is added to a path for it", same(libFixed.kids.map((k) => k.path), fresh.kids.map((k) => k.path)));

// Garbage in.
check("a non-house record is rejected", migrateHouse({ hello: 1 }) === null && migrateHouse(null) === null);
check("a newer version is rejected instead of guessed at", migrateHouse({ ...fresh, version: 99 }) === null);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, detail] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
if (failed.length) {
  console.error(`\n${failed.length} house checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} house checks passed.`);
