import { DIMENSION_LABEL, wordsUnlocked } from "./catalog.ts";
import type {
  Attempt,
  Child,
  GradeDimension,
  HouseState,
  ModuleDef,
  ModuleVerdict,
  VerdictRecord,
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

/** The stored verdict record for one kid on one module, if any. */
export function verdictRecord(house: Pick<HouseState, "verdicts">, kidId: string, moduleId: string): VerdictRecord | undefined {
  return house.verdicts[verdictKey(kidId, moduleId)];
}

export function verdictOf(house: Pick<HouseState, "verdicts">, kidId: string, moduleId: string): ModuleVerdict | undefined {
  return verdictRecord(house, kidId, moduleId)?.verdict;
}

// ---------------------------------------------------------------------------
// One reading of every attempt row
// ---------------------------------------------------------------------------

/** A spoken try nobody has graded yet is neither a hit nor a miss. */
export const isGraded = (a: Attempt) => a.spokenGrade !== "pending";
export const isHit = (a: Attempt) => isGraded(a) && (a.spokenGrade ? a.spokenGrade === "hit" : a.correct);
export const isMiss = (a: Attempt) => isGraded(a) && !isHit(a);
export const isPending = (a: Attempt) => !isGraded(a);
/** First look at a card. Retries on the same card are morale, not evidence. */
export const isCold = (a: Attempt) => a.version === 0;

/** Real lessons: daily, review, and try runs. Placement probes and scout tunnels are diagnostics, not lessons. */
export const isLesson = (a: Attempt) => a.source === "daily" || a.source === "review" || a.source === "try";

function avgMs(rows: Attempt[]): number | undefined {
  const timed = rows.filter((a) => isHit(a) && isCold(a) && a.kind !== "speak" && a.ms > 0);
  return timed.length ? Math.round(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : undefined;
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
      note: key === "speed" ? "No word-speed until words unlock." : "Locked until the map says ready and you confirm.",
    };
  }

  // Lessons only: the map and the scout have their own cards.
  const mine = attempts.filter(
    (a) => a.kidId === child.id && isLesson(a) && (key === "speed" ? a.dimension === "words" || a.dimension === "sentences" : a.dimension === key),
  );
  const hits = mine.filter(isHit).length;
  const misses = mine.filter(isMiss).length;
  const pendingSpeak = mine.filter(isPending).length;
  const speed = avgMs(mine);
  const graded = hits + misses;

  const status: DimensionStatus = graded === 0 ? "live" : hits >= misses * 2 && hits >= 2 ? "live" : "shaky";

  let note = graded === 0 ? "No attempts yet." : `${hits} hits, ${misses} misses. Later hits do not erase misses.`;
  if (key === "speed") note = speed ? `${(speed / 1000).toFixed(1)} s per cold hit. Replay is not a hit.` : "No timed hits yet.";
  if (key === "speaking" && pendingSpeak) note += ` ${pendingSpeak} spoken ${pendingSpeak === 1 ? "try waits" : "tries wait"} for your ear.`;

  return {
    key,
    label: DIMENSION_LABEL[key],
    status,
    hits,
    misses,
    pendingSpeak,
    avgMs: speed,
    note,
  };
}

// ---------------------------------------------------------------------------
// Module pass rule: a window, not a lifetime count
// ---------------------------------------------------------------------------

export const PASS_WINDOW = 10;
export const PASS_NEED = 8;
export const FAIL_MIN = 6;

export type PassWindow = { verdict: ModuleVerdict; attempts: number; correct: number; itemsHit: number; items: number };

/**
 * Look at the last ten first-try graded attempts on the module. Pass when
 * eight or more hit and the kid has hit at least 60% of the module's distinct
 * items; fail (a parent-door word) when six or more were graded and misses
 * outnumber hits; open otherwise. Pending spoken tries are not in the window.
 */
export function passWindow(mine: Attempt[], items: number): PassWindow {
  const cold = mine.filter((a) => isCold(a) && isGraded(a));
  const window = cold.slice(-PASS_WINDOW);
  const correct = window.filter(isHit).length;
  const itemsHit = Math.min(items, new Set(mine.filter(isHit).map((a) => a.itemId)).size);
  const coverage = items ? itemsHit / items : 1;
  let verdict: ModuleVerdict = "open";
  if (window.length >= PASS_NEED && correct >= PASS_NEED && coverage >= 0.6) verdict = "pass";
  else if (window.length >= FAIL_MIN && correct < window.length - correct) verdict = "fail";
  return { verdict, attempts: window.length, correct, itemsHit, items };
}

/** Real play on this module for this child, oldest first. Placement probes and scout rows are not lessons. */
export function moduleAttempts(kidId: string, moduleId: string, attempts: Attempt[]) {
  return attempts.filter((a) => a.kidId === kidId && a.moduleId === moduleId && isLesson(a));
}

type VerdictInput = VerdictRecord | ModuleVerdict | undefined;
const asRecord = (v: VerdictInput): VerdictRecord | undefined => (typeof v === "string" ? { verdict: v, by: "parent", at: "" } : v);

export function moduleStats(childId: string, module: ModuleDef, attempts: Attempt[], verdict?: VerdictInput) {
  const mine = moduleAttempts(childId, module.id, attempts);
  const hits = mine.filter(isHit).length;
  const misses = mine.filter(isMiss).length;
  const cold = mine.filter((a) => isHit(a) && isCold(a));
  const window = passWindow(mine, module.items.length);
  const record = asRecord(verdict);
  return {
    hits,
    misses,
    pending: mine.filter(isPending).length,
    coldHits: cold.length,
    window,
    auto: window.verdict,
    verdict: record?.verdict ?? window.verdict,
    by: record?.by ?? "auto",
    at: record?.at,
  };
}

export function allDimensions(): GradeDimension[] {
  return ["letterRecognition", "vowelPhonics", "phonemes", "words", "sentences", "speed", "speaking"];
}

/** One child's standing on one module, in parent-door words. */
export type ModuleKidStatus = "waiting" | "passed" | "review" | "failed" | "struggle-stop" | "in-progress" | "not-started" | "held" | "off-path";

export const MODULE_STATUS_LABEL: Record<ModuleKidStatus, string> = {
  waiting: "waiting",
  passed: "passed",
  review: "reviewing",
  failed: "failed",
  "struggle-stop": "struggle-stop",
  "in-progress": "in progress",
  "not-started": "not started",
  held: "held",
  "off-path": "not on path",
};

export type FunctionGrade = {
  key: GradeDimension;
  label: string;
  attempts: number;
  correct: number;
  /** Undefined until there is at least one graded attempt — never a fake 0%. */
  pct?: number;
  lastAt?: string;
  pendingSpeak: number;
  /** Average ms on cold real hits; only for the speed row. */
  avgMs?: number;
  note: string;
};

export type ModuleProgress = {
  status: ModuleKidStatus;
  verdict: ModuleVerdict;
  auto: ModuleVerdict;
  by: VerdictRecord["by"];
  hits: number;
  misses: number;
  coldHits: number;
  window: PassWindow;
  /** Distinct items with at least one real hit. */
  itemsHit: number;
  items: number;
  /** Undefined until the kid has played the module — never a fake 0%. */
  pct?: number;
  attempted: boolean;
  lastAt?: string;
  pendingSpeak: number;
  onPath: boolean;
};

/** Two honest misses in a row is a stop. Pending spoken tries are not misses. */
export function struggleStopped(mine: Attempt[]) {
  const graded = mine.filter(isGraded);
  const last2 = graded.slice(-2);
  return last2.length === 2 && last2.every(isMiss);
}

export function moduleProgress(child: Child, module: ModuleDef, attempts: Attempt[], verdict?: VerdictInput): ModuleProgress {
  const mine = moduleAttempts(child.id, module.id, attempts);
  const stats = moduleStats(child.id, module, attempts, verdict);
  const items = module.items.length;
  const itemsHit = stats.window.itemsHit;
  const onPath = child.path.includes(module.id);
  const held = Boolean(child.held?.includes(module.id));
  const reviewing = Boolean(child.plan?.review.some((c) => c.moduleId === module.id));
  const pendingSpeak = stats.pending;
  const lastAt = mine.length ? mine[mine.length - 1].at : undefined;
  const attempted = mine.length > 0;

  let status: ModuleKidStatus;
  if (child.status === "waiting") status = "waiting";
  else if (stats.verdict === "pass") status = reviewing ? "review" : "passed";
  else if (stats.verdict === "fail") status = "failed";
  else if (attempted && struggleStopped(mine)) status = "struggle-stop";
  else if (attempted) status = "in-progress";
  else if (onPath) status = "not-started";
  else if (held) status = "held";
  else status = "off-path";

  const pct = stats.verdict === "pass" && attempted ? 100 : attempted && items ? Math.round((itemsHit / items) * 100) : undefined;

  return {
    status,
    verdict: stats.verdict,
    auto: stats.auto,
    by: stats.by,
    hits: stats.hits,
    misses: stats.misses,
    coldHits: stats.coldHits,
    window: stats.window,
    itemsHit,
    items,
    pct,
    attempted,
    lastAt,
    pendingSpeak,
    onPath,
  };
}

/** Which functions a module is graded on, in gambit order. Speed is a word function: only modules with words or lines carry it. */
export function moduleFunctions(module: ModuleDef): GradeDimension[] {
  const has = new Set<GradeDimension>(module.dimensions);
  if (module.items.some((i) => i.dimension === "sentences")) has.add("sentences");
  const wordy = module.items.some((i) => i.dimension === "words" || i.dimension === "sentences");
  if (wordy) has.add("speed");
  else has.delete("speed");
  return allDimensions().filter((d) => has.has(d));
}

export function moduleFunctionGrades(child: Child, module: ModuleDef, attempts: Attempt[]): FunctionGrade[] {
  const mine = moduleAttempts(child.id, module.id, attempts);
  return moduleFunctions(module).map((key) => {
    const label = DIMENSION_LABEL[key];
    if (key === "speed") {
      const wordRows = mine.filter((a) => a.dimension === "words" || a.dimension === "sentences");
      const timed = wordRows.filter((a) => isHit(a) && isCold(a) && a.kind !== "speak" && a.ms > 0);
      const speed = avgMs(wordRows);
      return {
        key,
        label,
        attempts: timed.length,
        correct: timed.length,
        lastAt: timed.length ? timed[timed.length - 1].at : undefined,
        pendingSpeak: 0,
        avgMs: speed,
        note: speed ? `${(speed / 1000).toFixed(1)} s per cold hit over ${timed.length}. Replay is not a hit.` : "No timed hits yet.",
      };
    }
    const rows = mine.filter((a) => a.dimension === key);
    const pendingSpeak = rows.filter(isPending).length;
    const correct = rows.filter(isHit).length;
    const graded = rows.length - pendingSpeak;
    const pct = graded > 0 ? Math.round((correct / graded) * 100) : undefined;
    let note = graded === 0 ? "No attempts yet." : "Misses stay after a later hit.";
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

/**
 * The module the kid works on next: the first path module that is not passed.
 * Undefined when the path is finished — the plan turns that into a review
 * session and a proposal for the parent, never a replay of the last module.
 */
export function kidNextModule(child: Child, state: Pick<HouseState, "modules" | "verdicts">): ModuleDef | undefined {
  const locked = !wordsUnlocked(child);
  for (const id of child.path) {
    const mod = state.modules.find((m) => m.id === id);
    if (!mod) continue;
    if (locked && mod.track === "words") continue;
    if (verdictOf(state, child.id, mod.id) === "pass") continue;
    return mod;
  }
  return undefined;
}

/** The label and short explanation of who set a verdict. */
export function verdictProvenance(p: Pick<ModuleProgress, "verdict" | "auto" | "by" | "window" | "attempted" | "hits" | "misses">): string {
  const w = p.window;
  if (p.verdict === "open") {
    if (!p.attempted) return `No attempts yet. Auto-pass needs ${PASS_NEED} of the last ${PASS_WINDOW} cold tries.`;
    return `${w.correct} of ${w.attempts} cold tries right; needs ${PASS_NEED} of ${PASS_WINDOW}.`;
  }
  if (p.by === "map") return "Passed on the skills map. Not played as a lesson.";
  if (p.by === "start-here") return "Passed by Start here. Not played as a lesson.";
  if (p.by === "parent") return `Set by you. The sheet alone says ${p.auto} (${w.correct}/${w.attempts} cold).`;
  if (p.verdict === "pass") return `${w.correct} of ${w.attempts} cold tries right. Passed.`;
  return `${p.hits} hits under ${p.misses} misses. Kid hears "not that one", never fail.`;
}
