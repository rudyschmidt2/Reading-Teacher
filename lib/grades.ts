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

export function kidNextModule(child: Child, state: HouseState): ModuleDef | undefined {
  const mods = child.path.map((id) => state.modules.find((m) => m.id === id)).filter(Boolean) as ModuleDef[];
  for (const mod of mods) {
    const v = state.verdicts[verdictKey(child.id, mod.id)];
    if (v === "pass") continue;
    return mod;
  }
  return mods[mods.length - 1] ?? state.modules.find((m) => (child.track === "letters" ? m.track === "letters" : m.track === "words"));
}
