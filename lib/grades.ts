import { DIMENSION_LABEL, wordsUnlocked } from "./catalog";
import type {
  Attempt,
  Child,
  GradeDimension,
  HouseState,
  ModuleDef,
  ModuleVerdict,
} from "./types";

export type DimensionStatus = "live" | "shaky" | "not-in-play";

export type DimensionRollup = {
  key: GradeDimension;
  label: string;
  status: DimensionStatus;
  hits: number;
  misses: number;
  pendingSpeak: number;
  avgMs?: number;
  note: string;
};

export function verdictKey(kidId: string, moduleId: string) {
  return `${kidId}:${moduleId}`;
}

export function rollupDimension(
  child: Child,
  attempts: Attempt[],
  key: GradeDimension,
): DimensionRollup {
  const unlocked = wordsUnlocked(child);
  const wordish = key === "words" || key === "sentences" || key === "speed" || (key === "vowelPhonics" && child.track === "letters");
  if (child.status === "waiting") {
    return {
      key,
      label: DIMENSION_LABEL[key],
      status: "not-in-play",
      hits: 0,
      misses: 0,
      pendingSpeak: 0,
      note: "Waiting. No fake grade.",
    };
  }
  if (child.track === "letters" && wordish && !unlocked) {
    return {
      key,
      label: DIMENSION_LABEL[key],
      status: "not-in-play",
      hits: 0,
      misses: 0,
      pendingSpeak: 0,
      note: key === "speed" ? "No word-speed until words unlock." : "Locked until probe flag and parent confirm.",
    };
  }

  const mine = attempts.filter((a) => a.kidId === child.id && (key === "speed" ? a.dimension === "words" || a.dimension === "sentences" : a.dimension === key));
  const hits = mine.filter((a) => a.correct).length;
  const misses = mine.filter((a) => !a.correct).length;
  const pendingSpeak = mine.filter((a) => a.spokenGrade === "pending").length;
  const timed = mine.filter((a) => a.correct && a.ms > 0);
  const avgMs = timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : undefined;

  let status: DimensionStatus = mine.length === 0 ? "live" : hits >= misses * 2 && hits >= 2 ? "live" : "shaky";
  if (mine.length === 0) status = "live";

  let note = mine.length === 0 ? "No attempts yet." : `${hits} hits, ${misses} misses. Later hits do not erase misses.`;
  if (key === "speed" && avgMs) note = `Average real-hit time ${avgMs} ms. Replay is not a hit.`;
  if (key === "speaking" && pendingSpeak) note += ` ${pendingSpeak} spoken tries waiting for parent listen.`;

  return {
    key,
    label: DIMENSION_LABEL[key],
    status,
    hits,
    misses,
    pendingSpeak,
    avgMs,
    note,
  };
}

export function moduleStats(childId: string, module: ModuleDef, attempts: Attempt[], verdict?: ModuleVerdict) {
  const mine = attempts.filter((a) => a.kidId === childId && a.moduleId === module.id && a.source !== "placement");
  const hits = mine.filter((a) => a.correct).length;
  const misses = mine.filter((a) => !a.correct).length;
  const cold = mine.filter((a) => a.correct && a.version === 0);
  let auto: ModuleVerdict = "open";
  if (cold.length >= 8) auto = "pass";
  else if (mine.length >= 6 && hits < misses) auto = "fail";
  return {
    hits,
    misses,
    coldHits: cold.length,
    auto,
    verdict: verdict ?? auto,
  };
}

export function allDimensions(): GradeDimension[] {
  return ["letterRecognition", "vowelPhonics", "phonemes", "words", "sentences", "speed", "speaking"];
}

/** One child's standing on one module, in parent-door words. */
export type ModuleKidStatus = "waiting" | "passed" | "failed" | "struggle-stop" | "in-progress" | "not-started" | "off-path";

export const MODULE_STATUS_LABEL: Record<ModuleKidStatus, string> = {
  waiting: "waiting",
  passed: "passed",
  failed: "failed",
  "struggle-stop": "struggle-stop",
  "in-progress": "in progress",
  "not-started": "not started",
  "off-path": "not on path",
};

export type FunctionGrade = {
  key: GradeDimension;
  label: string;
  attempts: number;
  correct: number;
  /** Undefined until there is at least one attempt — never a fake 0%. */
  pct?: number;
  lastAt?: string;
  pendingSpeak: number;
  /** Average ms on real hits; only for the speed row. */
  avgMs?: number;
  note: string;
};

export type ModuleProgress = {
  status: ModuleKidStatus;
  verdict: ModuleVerdict;
  auto: ModuleVerdict;
  hits: number;
  misses: number;
  coldHits: number;
  /** Distinct items with at least one real hit. */
  itemsHit: number;
  items: number;
  pct: number;
  lastAt?: string;
  pendingSpeak: number;
  onPath: boolean;
};

/** Real play on this module for this child, oldest first. Placement probes are not lessons. */
export function moduleAttempts(kidId: string, moduleId: string, attempts: Attempt[]) {
  return attempts.filter((a) => a.kidId === kidId && a.moduleId === moduleId && a.source !== "placement");
}

/** Same rule as the placement ladder: two honest misses in a row is a stop. */
export function struggleStopped(mine: Attempt[]) {
  const last2 = mine.slice(-2);
  return last2.length === 2 && last2.every((a) => !a.correct);
}

export function moduleProgress(child: Child, module: ModuleDef, attempts: Attempt[], verdict?: ModuleVerdict): ModuleProgress {
  const mine = moduleAttempts(child.id, module.id, attempts);
  const stats = moduleStats(child.id, module, attempts, verdict);
  const items = module.items.length;
  const itemsHit = Math.min(items, new Set(mine.filter((a) => a.correct).map((a) => a.itemId)).size);
  const onPath = child.path.includes(module.id);
  const pendingSpeak = mine.filter((a) => a.spokenGrade === "pending").length;
  const lastAt = mine.length ? mine[mine.length - 1].at : undefined;

  let status: ModuleKidStatus;
  if (child.status === "waiting") status = "waiting";
  else if (stats.verdict === "pass") status = "passed";
  else if (stats.verdict === "fail") status = "failed";
  else if (mine.length && struggleStopped(mine)) status = "struggle-stop";
  else if (mine.length) status = "in-progress";
  else if (onPath) status = "not-started";
  else status = "off-path";

  return {
    status,
    verdict: stats.verdict,
    auto: stats.auto,
    hits: stats.hits,
    misses: stats.misses,
    coldHits: stats.coldHits,
    itemsHit,
    items,
    pct: status === "passed" ? 100 : items ? Math.round((itemsHit / items) * 100) : 0,
    lastAt,
    pendingSpeak,
    onPath,
  };
}

/** Which functions a module is graded on, in gambit order. Speed is always graded from timed real hits. */
export function moduleFunctions(module: ModuleDef): GradeDimension[] {
  const has = new Set<GradeDimension>(module.dimensions);
  if (module.items.some((i) => i.dimension === "sentences")) has.add("sentences");
  has.add("speed");
  return allDimensions().filter((d) => has.has(d));
}

export function moduleFunctionGrades(child: Child, module: ModuleDef, attempts: Attempt[]): FunctionGrade[] {
  const mine = moduleAttempts(child.id, module.id, attempts);
  return moduleFunctions(module).map((key) => {
    const label = DIMENSION_LABEL[key];
    if (key === "speed") {
      const timed = mine.filter((a) => a.correct && a.ms > 0);
      const avgMs = timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : undefined;
      return {
        key,
        label,
        attempts: timed.length,
        correct: timed.length,
        lastAt: timed.length ? timed[timed.length - 1].at : undefined,
        pendingSpeak: 0,
        avgMs,
        note: avgMs ? `${(avgMs / 1000).toFixed(1)} s per real hit over ${timed.length}. Replay is not a hit.` : "No timed hits yet.",
      };
    }
    const rows = mine.filter((a) => a.dimension === key);
    const pendingSpeak = rows.filter((a) => a.spokenGrade === "pending").length;
    // A spoken try the parent has not listened to yet is not a hit.
    const correct = rows.filter((a) => a.correct && a.spokenGrade !== "pending").length;
    const graded = rows.length - pendingSpeak;
    const pct = graded > 0 ? Math.round((correct / graded) * 100) : undefined;
    let note = rows.length === 0 ? "No attempts yet." : "Misses stay after a later hit.";
    if (pendingSpeak) note += ` ${pendingSpeak} spoken ${pendingSpeak === 1 ? "try waits" : "tries wait"} for your ear.`;
    return {
      key,
      label,
      attempts: rows.length,
      correct,
      pct,
      lastAt: rows.length ? rows[rows.length - 1].at : undefined,
      pendingSpeak,
      note,
    };
  });
}

export function kidNextModule(child: Child, state: HouseState): ModuleDef | undefined {
  const mods = child.path.map((id) => state.modules.find((m) => m.id === id)).filter(Boolean) as ModuleDef[];
  for (const mod of mods) {
    const v = state.verdicts[verdictKey(child.id, mod.id)];
    if (v === "pass") continue;
    return mod;
  }
  return mods[mods.length - 1] ?? state.modules.find((m) => (child.track === "letters" ? m.track === "letters" : m.track === "words"));
}
