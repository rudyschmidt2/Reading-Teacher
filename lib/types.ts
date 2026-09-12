export type KidId = "riley" | "hudson" | "myles" | "cassidy" | string;

export type ThemeId =
  | "large-animals"
  | "airplanes"
  | "planets-space"
  | "bugs"
  | "spaceships";

export type ChildStatus = "active" | "waiting";
export type Track = "letters" | "words";
export type Stretch = "easier" | "stretch-hard" | "harder";
export type SessionLength = "shorter" | "standard" | "longer";

export type PlacementShelf = "S" | "L" | "C" | "C+" | "A0" | "A1" | "A2" | "A3";

export type GradeDimension =
  | "letterRecognition"
  | "vowelPhonics"
  | "phonemes"
  | "words"
  | "sentences"
  | "speed"
  | "speaking";

export type ModuleVerdict = "pass" | "fail" | "open";

export type PlayKind = "tap" | "drag" | "speak";
export type Widget = "smash" | "ear" | "feed" | "stamp" | "drag" | "say";
export type TileKind = "letter" | "vowel" | "sound";
export type Vowel = "a" | "e" | "i" | "o" | "u";

export type Tile = {
  id: string;
  kind: TileKind;
  label: string;
  vowel?: Vowel;
  phoneme?: string;
};

export type Slot = {
  id: string;
  accepts: TileKind[];
  correctTileId: string;
  glowVowel?: Vowel;
};

export type Choice = {
  id: string;
  label: string;
  emoji?: string;
};

export type LessonItem = {
  id: string;
  kind: PlayKind;
  widget: Widget;
  prompt: string;
  parentHint?: string;
  dimension: GradeDimension;
  choices?: Choice[];
  correctId?: string;
  tiles?: Tile[];
  slots?: Slot[];
  speakTarget?: string;
  word?: string;
  letter?: string;
};

export type ModuleDef = {
  id: string;
  title: string;
  track: Track;
  skill: string;
  stretch: Stretch;
  dimensions: GradeDimension[];
  items: LessonItem[];
  custom?: boolean;
};

export type Child = {
  id: string;
  name: string;
  birthday: string;
  status: ChildStatus;
  track: Track;
  themeToday?: ThemeId;
  themeDate?: string;
  stars: number;
  placementGrade?: PlacementShelf;
  placementNote?: string;
  kidLine?: string;
  ownedBits?: string[];
  path: string[];
  stretch: Stretch;
  sessionLength: SessionLength;
  readyForPrintWords: boolean;
  parentUnlockedWords: boolean;
};

export type Attempt = {
  id: string;
  kidId: string;
  moduleId: string;
  itemId: string;
  version: number;
  kind: PlayKind;
  dimension: GradeDimension;
  correct: boolean;
  ms: number;
  spokenText?: string;
  spokenGrade?: "hit" | "miss" | "pending";
  at: string;
  kidSaw: "not that one" | "star";
  source: "placement" | "daily" | "scout" | "try";
};

export type ScoutReport = {
  kidId: string;
  pack: string;
  ceiling: string;
  floor: string;
  bands: { name: string; tag: "known" | "shaky" | "unknown" }[];
  drafts: { title: string; skill: string; seeds: string; stretch: Stretch }[];
  readyForPrintWords?: boolean;
  status: "pending" | "approved" | "ignored";
};

export type HouseState = {
  version: 1;
  kids: Child[];
  modules: ModuleDef[];
  attempts: Attempt[];
  verdicts: Record<string, ModuleVerdict>;
  scouts: ScoutReport[];
};

export type PlacementItem = {
  id: string;
  rung: "sounds" | "letters" | "cvc" | "names" | "letter-sounds";
  widget: Widget;
  prompt: string;
  parentHint?: string;
  choices: Choice[];
  correctId: string;
  dimension: GradeDimension;
};
