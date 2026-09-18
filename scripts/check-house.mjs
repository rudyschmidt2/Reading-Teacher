import { STARTER_KIDS, STARTER_MODULES } from "../lib/catalog.ts";
import { bandsFor, startHere } from "../lib/diagnostic.ts";
import { HOUSE_VERSION, emptyHouse, migrateHouse, withPath } from "../lib/house.ts";

const checks = [];
const check = (name, ok) => checks.push([name, ok]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const reload = (house) => migrateHouse(JSON.parse(JSON.stringify(house)));
const riley = () => STARTER_KIDS.find((k) => k.id === "riley");

// Empty house.
const fresh = emptyHouse();
check("empty house is on the current version", fresh.version === HOUSE_VERSION && HOUSE_VERSION === 2);
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
check("v1 migrates to v2", m1 && m1.version === 2);
check("v1 kids get an empty held list", m1.kids.every((k) => Array.isArray(k.held) && k.held.length === 0));
check("v1 paths are kept as saved", same(m1.kids.map((k) => k.path), v1.kids.map((k) => k.path)));
check("migrated house is stable across loads", same(reload(m1), reload(reload(m1))));

// v1 repair: a map-built path that v1 inflated back to the whole starter list.
const mapBuilt = ["rh-digraphs", "dx-riley-digraphs-t1", "rh-blends"];
const inflated = JSON.parse(JSON.stringify({
  ...fresh,
  version: 1,
  modules: [...fresh.modules, { id: "dx-riley-digraphs-t1", title: "x", track: "words", skill: "", stretch: "stretch-hard", dimensions: [], items: [] }],
  verdicts: { "riley:rh-letters": "pass", "riley:rh-cvc-smash": "pass", "riley:rh-heart": "pass" },
  kids: fresh.kids.map((k) =>
    k.id === "riley"
      ? {
          ...k,
          path: [...mapBuilt, ...k.path.filter((id) => !mapBuilt.includes(id))],
          diagnosticReport: { track: "words", at: "2026-09-18", bands: [], shelf: "C", note: "", kidLine: "", built: [{ moduleId: "dx-riley-digraphs-t1", title: "x", why: "" }] },
        }
      : k,
  ),
}));
const repaired = migrateHouse(inflated).kids.find((k) => k.id === "riley");
check("v1 repair drops the map-passed bank modules the back-fill put back", !repaired.path.includes("rh-letters") && !repaired.path.includes("rh-cvc-smash") && !repaired.path.includes("rh-heart"));
check("v1 repair keeps the map-built modules in order", repaired.path.slice(0, 3).join() === mapBuilt.join());
check("v1 repair keeps unpassed starter modules (they may be the parent's)", repaired.path.some((id) => !mapBuilt.includes(id)));
check("v1 repair records the dropped ones as held", ["rh-letters", "rh-cvc-smash", "rh-heart"].every((id) => repaired.held.includes(id)));
check("v1 repair leaves a played passed module alone", (() => {
  const withPlay = { ...inflated, attempts: [{ id: "a", kidId: "riley", moduleId: "rh-heart", itemId: "x", version: 0, kind: "tap", dimension: "words", correct: true, ms: 1, at: "", kidSaw: "star", source: "daily" }] };
  return migrateHouse(withPlay).kids.find((k) => k.id === "riley").path.includes("rh-heart");
})());

// Library still back-fills; the path does not.
const missingLib = { ...fresh, modules: fresh.modules.slice(1) };
const libFixed = reload(missingLib);
check("a starter module missing from the library comes back", libFixed.modules.length === STARTER_MODULES.length);
check("but nothing is added to a path for it", same(libFixed.kids.map((k) => k.path), fresh.kids.map((k) => k.path)));

// Garbage in.
check("a non-house record is rejected", migrateHouse({ hello: 1 }) === null && migrateHouse(null) === null);
check("a newer version is rejected instead of guessed at", migrateHouse({ ...fresh, version: 99 }) === null);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} house checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} house checks passed.`);
