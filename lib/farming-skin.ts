import type { Choice, LessonItem, PlacementItem, ThemeId } from "./types";

/** Hosts from farming-equipment.md. Equipment only — no cute-farm teacher. */
export const FARMING_HOSTS = [
  {
    id: "tractor",
    label: "Tractor",
    emoji: "🚜",
    win: "Hitch clicks. Tractor pulls through!",
    miss: "Wheels spin. Hitch pin hops out. Not that one.",
  },
  {
    id: "chopper",
    label: "Chopper",
    emoji: "🌽",
    win: "Spout blows the chop into the wagon!",
    miss: "Chopper coughs. Spout misses the wagon. Not that one.",
  },
  {
    id: "truck",
    label: "Truck",
    emoji: "🚛",
    win: "Tailgate dumps into the pit!",
    miss: "Tailgate clanks. Load hops back. Not that one.",
  },
  {
    id: "car",
    label: "Car",
    emoji: "🚗",
    win: "Farm car parks. Lights flash!",
    miss: "Horn honks. Rolls back a foot. Not that one.",
  },
  {
    id: "implement",
    label: "Implement",
    emoji: "🛠️",
    win: "Hitch locks. Tool bites the ground!",
    miss: "Unhooks. Tool clanks. Not that one.",
  },
] as const;

export type FarmingHost = (typeof FARMING_HOSTS)[number];

/** Tractor → Chopper → Truck → Car → Implement by sitting, not by skill. */
export function farmingHostForSitting(seed: string): FarmingHost {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n += seed.charCodeAt(i);
  return FARMING_HOSTS[n % FARMING_HOSTS.length];
}

type PicTriple = { choices: [string, string, string][]; hit: string };

function pics(rows: [string, string, string][]): Choice[] {
  return rows.map(([id, label, emoji]) => ({ id, label, emoji }));
}

/** Same item IDs. Farming pictures only. */
const FARM_SOUND_ITEMS: Record<string, PicTriple> = {
  S1: { hit: "silage", choices: [["silage", "silage", "🌾"], ["nest", "nest", "🪺"], ["tap", "tap", "🔧"]] },
  S2: { hit: "mud", choices: [["mud", "mud", "🟤"], ["nest", "nest", "🪺"], ["pig", "pig", "🐷"]] },
  S3: { hit: "truck", choices: [["truck", "truck", "🚛"], ["pig", "pig", "🐷"], ["sun", "sun", "☀️"]] },
  S4: { hit: "silage", choices: [["silage", "silage", "🌾"], ["dog", "dog", "🐶"], ["cup", "cup", "🥤"]] },
  "P-s1": { hit: "silage", choices: [["silage", "silage", "🌾"], ["nest", "nest", "🪺"], ["tap", "tap", "🔧"]] },
  "SD-S1": { hit: "silage", choices: [["silage", "silage", "🌾"], ["nest", "nest", "🪺"], ["tap", "tap", "🔧"]] },
  "SD-S2": { hit: "truck", choices: [["truck", "truck", "🚛"], ["pig", "pig", "🐷"], ["sun", "sun", "☀️"]] },
  "SD-S3": { hit: "axle", choices: [["axle", "axle", "⚙️"], ["igloo", "igloo", "🧊"], ["nest", "nest", "🪺"]] },
  "SD-S4": { hit: "mud", choices: [["mud", "mud", "🟤"], ["nest", "nest", "🪺"], ["pig", "pig", "🐷"]] },
};

/** After-read / beside-tray costumes. Word IDs stay the word. */
const FARM_WORD_EMOJI: Record<string, string> = {
  sat: "🚜",
  sit: "🚜",
  pin: "📌",
  pan: "🛢️",
  tap: "📯",
  tip: "🚛",
  tin: "🥫",
  pit: "🌾",
  nap: "🚛",
  ant: "🌾",
  mat: "🚜",
  man: "🚜",
  map: "🗺️",
  hop: "🚛",
  hot: "🔥",
  pot: "🫕",
  top: "🚛",
  mug: "☕",
  mud: "🟤",
  sun: "🌽",
  red: "🚜",
  chop: "🌽",
  shop: "🔧",
  stop: "🚜",
  trip: "🚛",
  blot: "🛢️",
  rain: "🌾",
  car: "🚗",
  "I sit.": "🚜",
  "A pin.": "📌",
  "The ant sat.": "🌾",
  "I tap it.": "📯",
  "I hop to the red mug.": "🚛",
};

export function isFarming(themeId?: ThemeId) {
  return themeId === "farming-equipment";
}

export function paintChoices(item: LessonItem | PlacementItem, themeId?: ThemeId): Choice[] {
  const base = item.choices ?? [];
  if (!isFarming(themeId) || base.length === 0) return base;
  const sound = FARM_SOUND_ITEMS[item.id];
  if (sound) return pics(sound.choices);
  return base.map((c) => {
    const emoji = FARM_WORD_EMOJI[c.id] ?? FARM_WORD_EMOJI[c.label] ?? c.emoji;
    return emoji ? { ...c, emoji } : c;
  });
}

export function paintCorrectId(item: LessonItem | PlacementItem, themeId?: ThemeId) {
  if (!isFarming(themeId)) return item.correctId;
  return FARM_SOUND_ITEMS[item.id]?.hit ?? item.correctId;
}

export function farmingTrayHint(slotCount: number) {
  if (slotCount <= 1) return "One hopper. Park the letter or sound. No word tray.";
  return "Hitch pads · hopper gate · wagon bay. Tap a tile to send it.";
}
