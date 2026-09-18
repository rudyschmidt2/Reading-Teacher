export type KidId = "riley" | "hudson" | "myles" | "cassidy" | string;

export type ThemeId =
  | "large-animals"
  | "airplanes"
  | "planets-space"
  | "bugs"
  | "spaceships"
  | "farming-equipment"
  | "race-cars";

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
export type Widget = "smash" | "ear" | "feed" | "stamp" | "drag" | "say" | "trace";
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
  /** Module ids the parent held or dropped from the path. Nothing automatic puts them back. */
  held?: string[];
  stretch: Stretch;
  sessionLength: SessionLength;
  readyForPrintWords: boolean;
  parentUnlockedWords: boolean;
  dailySessions: number;
  lastDailyDate?: string;
  lastScoutDate?: string;
  diagnostic?: DiagnosticProgress;
  diagnosticReport?: DiagnosticReport;
};

export type BandStatus = "known" | "shaky" | "unknown" | "not-reached";

export type ProbeKind = "tap" | "speak";

export type DiagnosticRow = {
  probeId: string;
  band: string;
  bit: string;
  ok: boolean;
  ms: number;
  at: string;
  /** Tap unless said otherwise; speak rows never count toward speed. */
  kind?: ProbeKind;
  /** A spoken answer nobody has graded yet ("Parent will listen"). Not a hit, not a miss. */
  pending?: boolean;
  heard?: string;
};

export type DiagnosticProgress = {
  track: Track;
  rows: DiagnosticRow[];
  /** Index of the next band and probe to ask. Null once the map is finished. */
  cursor: { band: number; probe: number } | null;
  startedAt: string;
  finishedAt?: string;
};

export type BandReport = {
  id: string;
  title: string;
  status: BandStatus;
  hits: number;
  answered: number;
  total: number;
  known: string[];
  missed: string[];
  /** Average ms on real tap hits in this band. Undefined until there is one. */
  avgMs?: number;
  /** Spoken probes in this band: graded hits and misses, plus ones still waiting for a parent ear. */
  speak?: { hits: number; misses: number; pending: number };
};

export type DiagnosticReport = {
  track: Track;
  at: string;
  bands: BandReport[];
  /** First band that is not known. Undefined when everything probed was known. */
  frontier?: string;
  shelf: PlacementShelf;
  note: string;
  /** What the map built and marked passed. Kept apart from `note` so a regrade can refresh the map without touching it. */
  pathNote?: string;
  kidLine: string;
  built: { moduleId: string; title: string; why: string }[];
  /** Average ms on real tap hits across the whole map. */
  speedMs?: number;
  /** Letters track only: letter sounds and first sounds both known. The parent still unlocks words by hand. */
  readyForPrintWords?: boolean;
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

export type ScoutDraft = {
  title: string;
  skill: string;
  seeds: string;
  stretch: Stretch;
  /** When set, the draft is built with this band's own item makers on these bits. */
  bandId?: string;
  bits?: string[];
};

export type ScoutReport = {
  kidId: string;
  pack: string;
  ceiling: string;
  floor: string;
  bands: { name: string; tag: "known" | "shaky" | "unknown"; id?: string; hits?: number; answered?: number; missed?: string[] }[];
  drafts: ScoutDraft[];
  readyForPrintWords?: boolean;
  status: "pending" | "approved" | "ignored";
  at?: string;
  answered?: number;
  hits?: number;
};

export type HouseState = {
  /** 1: paths were back-filled from the starter kids on every load. 2: seeding ran once; `held` is honoured. */
  version: 2;
  kids: Child[];
  modules: ModuleDef[];
  attempts: Attempt[];
  verdicts: Record<string, ModuleVerdict>;
  scouts: ScoutReport[];
};

export type PlacementItem = {
  id: string;
  rung: string;
  widget: Widget;
  prompt: string;
  parentHint?: string;
  choices: Choice[];
  correctId: string;
  dimension: GradeDimension;
  /** Tap unless said otherwise. A speak probe has no choices; the kid says `speakTarget`. */
  kind?: ProbeKind;
  speakTarget?: string;
  /** Print the kid reads on a speak probe (a letter, a word, a line). The teacher does not read it aloud. */
  print?: string;
};
