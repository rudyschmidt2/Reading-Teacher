import { STARTER_KIDS, STARTER_MODULES } from "./catalog.ts";
import { buildPath } from "./diagnostic.ts";
import type { Child, HouseState, ModuleDef, ModuleVerdict } from "./types";

/**
 * Pure helpers for the house record: the empty house, the migration chain
 * that `load()` runs once per saved version, and the one function that is
 * allowed to change a kid's path so the held list stays honest.
 */

export const HOUSE_VERSION = 2 as const;

export function emptyHouse(): HouseState {
  return structuredClone({
    version: HOUSE_VERSION,
    kids: STARTER_KIDS,
    modules: STARTER_MODULES,
    attempts: [],
    verdicts: {},
    scouts: [],
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

type LegacyHouse = Omit<HouseState, "version"> & { version: number };

function isHouseLike(x: unknown): x is LegacyHouse {
  return typeof x === "object" && x !== null && Array.isArray((x as LegacyHouse).kids) && typeof (x as LegacyHouse).version === "number";
}

function starterFor(id: string) {
  return STARTER_KIDS.find((s) => s.id === id);
}

/**
 * v1 → v2. Version 1 re-added every starter module to every kid's path on
 * every load, so a mapped kid's v1 path holds the whole starter list on top
 * of what the map built. The step rebuilds what the map would place (same
 * bank modules; the dx- ids are already on the path) and moves every other
 * starter module that nobody played and nobody graded onto `held`, where the
 * library shows it with "Put back". Starter modules missing from the library
 * are still added — that is the library, not the path.
 */
function migrateV1(house: LegacyHouse): HouseState {
  const played = new Set(house.attempts.map((a) => `${a.kidId}:${a.moduleId}`));
  const verdicts: Record<string, ModuleVerdict> = house.verdicts ?? {};
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
      const verdict = verdicts[`${k.id}:${id}`];
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
  if (house.version !== HOUSE_VERSION) return null;
  const v2 = house as HouseState;
  return withStarterLibrary({
    ...v2,
    kids: v2.kids.map((k) => ({ ...k, held: k.held ?? [], dailySessions: k.dailySessions ?? 0 })),
    scouts: v2.scouts ?? [],
  });
}
