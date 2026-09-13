import {
  FARMING_HOSTS,
  farmingHostForSitting,
  farmingTrayHint,
  isFarming,
  paintChoices as paintFarmChoices,
  paintCorrectId as paintFarmCorrectId,
} from "./farming-skin";
import type { Choice, LessonItem, PlacementItem, ThemeId } from "./types";

export { FARMING_HOSTS, farmingHostForSitting, isFarming };

export const RACE_HOST = {
  id: "race-crew",
  label: "Rev and the pit crew",
  emoji: "🏎️",
  win: "Checkered flag. Helmet visor flash!",
  miss: "Car wobbles off the track. Helmet bonk. Not that one.",
} as const;

export function isRace(themeId?: ThemeId) {
  return themeId === "race-cars";
}

/** After-pictures only. Never lead *car / red / pit / stop*. */
const RACE_WORD_EMOJI: Record<string, string> = {
  sat: "🏎️",
  sit: "🪑",
  sip: "🍼",
  pin: "📌",
  pan: "🍳",
  tap: "⛽",
  tip: "🏎️",
  tin: "🥤",
  nap: "😴",
  ant: "🐜",
  mat: "🟩",
  man: "🧑‍🚒",
  map: "🗺️",
  hop: "🏎️",
  pot: "🫕",
  top: "🏎️",
  mug: "☕",
  mud: "🟤",
  sun: "☀️",
  ship: "🚢",
  shop: "🏪",
  chop: "🥪",
  chip: "🍟",
  thin: "➖",
  duck: "🦆",
  step: "🪜",
  trip: "👟",
  rain: "🌧️",
  "I sit.": "🪑",
  "The ant sat.": "🐜",
  "I hop to the red mug.": "☕",
};

export function sittingHost(themeId: ThemeId | undefined, seed: string) {
  if (isFarming(themeId)) return farmingHostForSitting(seed);
  if (isRace(themeId)) return RACE_HOST;
  return null;
}

/** Honest miss once. Theme lines already say it; do not append again. */
export function honestMissLine(line: string) {
  const base = line.replace(/\s*Not that one\.?/gi, "").trim().replace(/[.!]+$/, "");
  return `${base}. Not that one.`;
}

export function skinMiss(themeId: ThemeId | undefined, fallback: string, seed: string) {
  const host = sittingHost(themeId, seed);
  return honestMissLine(host?.miss ?? fallback);
}

export function skinWin(themeId: ThemeId | undefined, fallback: string, seed: string) {
  const host = sittingHost(themeId, seed);
  return host?.win ?? fallback;
}

export function paintChoices(item: LessonItem | PlacementItem, themeId?: ThemeId): Choice[] {
  if (isFarming(themeId)) return paintFarmChoices(item, themeId);
  const base = item.choices ?? [];
  if (!isRace(themeId) || base.length === 0) return base;
  return base.map((c) => {
    if (c.id === "car" || c.id === "red" || c.id === "pit" || c.id === "stop") return c;
    const emoji = RACE_WORD_EMOJI[c.id] ?? RACE_WORD_EMOJI[c.label];
    return emoji ? { ...c, emoji } : c;
  });
}

export function paintCorrectId(item: LessonItem | PlacementItem, themeId?: ThemeId) {
  if (isFarming(themeId)) return paintFarmCorrectId(item, themeId);
  return item.correctId;
}

export function trayHint(themeId: ThemeId | undefined, slotCount: number) {
  if (isFarming(themeId)) return farmingTrayHint(slotCount);
  if (isRace(themeId)) {
    return slotCount <= 1
      ? "One pit slot. Park the letter or sound. No word bays."
      : "Three pit bays. Tap a tile to send it.";
  }
  return "Tap a fat tile to send it. Same as a drag.";
}
