import { STARTER_KIDS, STARTER_MODULES } from "./catalog.ts";
import { buildPath } from "./diagnostic.ts";
import type { Child, HouseState, KidPlan, ModuleDef, ModuleVerdict, VerdictRecord } from "./types";

/**
 * Pure helpers for the house record: the empty house, the migration chain
 * that `load()` runs once per saved version, and the one function that is
 * allowed to change a kid's path so the held list stays honest.
 */

export const HOUSE_VERSION = 3 as const;

export function defaultPlan(): KidPlan {
  return { gate: "path", moduleStretch: {}, review: [], proposals: [] };
}

export function planOf(kid: Child): KidPlan {
  return kid.plan ?? defaultPlan();
}

export function emptyHouse(): HouseState {
  return structuredClone({
    version: HOUSE_VERSION,
    kids: STARTER_KIDS.map((k) => ({ ...k, held: [], plan: defaultPlan() })),
    modules: STARTER_MODULES,
    attempts: [],
    verdicts: {},
    scouts: [],
    sessions: [],
  });
}

/**
 * Set a kid's path. Ids that leave the path are remembered in `held`; ids that
 * come back (parent added them again) leave `held`. Nothing automatic reads
 * the path back in, so a Hold, a Drop, a map build, or a Start here survives
 * every later page load.
 */
export function withPath(kid: Child, path: string[]): Child {
  const next = new Set(path);
  const removed = kid.path.filter((id) => !next.has(id));
  const held = new Set([...(kid.held ?? []), ...removed]);
  for (const id of path) held.delete(id);
  return { ...kid, path, held: [...held] };
}

type LegacyVerdicts = Record<string, ModuleVerdict | VerdictRecord>;
type LegacyHouse = Omit<HouseState, "version" | "verdicts" | "sessions"> & { version: number; verdicts?: LegacyVerdicts; sessions?: HouseState["sessions"] };

function isHouseLike(x: unknown): x is LegacyHouse {
  return typeof x === "object" && x !== null && Array.isArray((x as LegacyHouse).kids) && typeof (x as LegacyHouse).version === "number";
}

function starterFor(id: string) {
  return STARTER_KIDS.find((s) => s.id === id);
}

const verdictOfLegacy = (v: ModuleVerdict | VerdictRecord | undefined): ModuleVerdict | undefined => (typeof v === "string" ? v : v?.verdict);

/**
 * v1 → v2. Version 1 re-added every starter module to every kid's path on
 * every load, so a mapped kid's v1 path holds the whole starter list on top
 * of what the map built. The step rebuilds what the map would place (same
 * bank modules; the dx- ids are already on the path) and moves every other
 * starter module that nobody played and nobody graded onto `held`, where the
 * library shows it with "Put back". Starter modules missing from the library
 * are still added — that is the library, not the path.
 */
function migrateV1(house: LegacyHouse): LegacyHouse {
  const played = new Set(house.attempts.map((a) => `${a.kidId}:${a.moduleId}`));
  const verdicts: LegacyVerdicts = house.verdicts ?? {};
  const kids = house.kids.map((k) => {
    const starter = starterFor(k.id);
    const base: Child = {
      ...starter,
      ...k,
      name: k.id === "myles" ? "Myles" : k.name,
      path: k.path ?? starter?.path ?? [],
      dailySessions: k.dailySessions ?? 0,
    } as Child;
    if (!k.diagnosticReport) return { ...base, held: base.held ?? [] };
    const wanted = new Set<string>(k.diagnosticReport.built.map((b) => b.moduleId));
    if (k.diagnostic) {
      for (const id of buildPath(k.id, k.diagnostic, k.diagnosticReport.bands, "migrate").path) {
        if (!id.startsWith("dx-")) wanted.add(id);
      }
    }
    const starterPath = new Set(starter?.path ?? []);
    const path = base.path.filter((id) => {
      if (!starterPath.has(id) || wanted.has(id) || played.has(`${k.id}:${id}`)) return true;
      const verdict = verdictOfLegacy(verdicts[`${k.id}:${id}`]);
      // A pass came from the map (or is done either way); open/fail means Rudy touched it.
      return verdict !== undefined && verdict !== "pass";
    });
    return withPath({ ...base, held: base.held ?? [] }, path);
  });
  return {
    ...house,
    version: 2,
    kids,
    scouts: house.scouts ?? [],
  };
}

/**
 * v2 → v3. Verdicts were bare words; now they say who set them. A stored pass
 * on a module the kid never played belongs to the map (or Start here); any
 * other stored verdict was the parent's. Sessions start empty; every kid gets
 * a plan (review cards, proposals) with the path gate open.
 */
function migrateV2(house: LegacyHouse): LegacyHouse {
  const played = new Set(house.attempts.filter((a) => a.source !== "placement").map((a) => `${a.kidId}:${a.moduleId}`));
  const verdicts: Record<string, VerdictRecord> = {};
  for (const [key, raw] of Object.entries(house.verdicts ?? {})) {
    if (typeof raw !== "string") {
      verdicts[key] = raw;
      continue;
    }
    const by = raw === "pass" && !played.has(key) ? "map" : "parent";
    verdicts[key] = { verdict: raw, by, at: "" };
  }
  return {
    ...house,
    version: 3,
    verdicts,
    sessions: house.sessions ?? [],
    kids: house.kids.map((k) => ({ ...k, plan: k.plan ?? defaultPlan() })),
  };
}

/** Add starter modules the library does not have yet. Never touches a path. */
function withStarterLibrary(house: HouseState): HouseState {
  const known = new Set(house.modules.map((m: ModuleDef) => m.id));
  const extras = STARTER_MODULES.filter((m) => !known.has(m.id));
  return extras.length ? { ...house, modules: [...house.modules, ...extras] } : house;
}

/**
 * Turn whatever was in localStorage into the current house shape. Returns
 * null when the record is not a house at all or is newer than this build.
 */
export function migrateHouse(raw: unknown): HouseState | null {
  if (!isHouseLike(raw)) return null;
  let house: LegacyHouse = raw;
  if (house.version === 1) house = migrateV1(house);
  if (house.version === 2) house = migrateV2(house);
  if (house.version !== HOUSE_VERSION) return null;
  const v3 = house as HouseState;
  return withStarterLibrary({
    ...v3,
    verdicts: v3.verdicts ?? {},
    sessions: v3.sessions ?? [],
    kids: v3.kids.map((k) => ({ ...k, held: k.held ?? [], dailySessions: k.dailySessions ?? 0, plan: { ...defaultPlan(), ...(k.plan ?? {}) } })),
    scouts: v3.scouts ?? [],
  });
}
