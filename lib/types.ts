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
  plan?: KidPlan;
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

export type AttemptSource = "placement" | "daily" | "scout" | "try" | "review";

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
  /** When the parent graded a pending spoken try. */
  gradedAt?: string;
  at: string;
  kidSaw: "not that one" | "star" | "there it is" | "parent will listen";
  source: AttemptSource;
};

/** Who decided a module's verdict. `auto` is the windowed pass rule; `map` and `start-here` were never played. */
export type VerdictBy = "auto" | "parent" | "map" | "start-here";

export type VerdictRecord = {
  verdict: ModuleVerdict;
  by: VerdictBy;
  at: string;
  /** The window the auto rule looked at. */
  window?: { attempts: number; correct: number };
};

export type SessionKind = "daily" | "review" | "scout" | "try" | "place";
export type ItemSource = "review" | "stretch" | "close";

export type SessionResult = {
  itemId: string;
  moduleId: string;
  source: ItemSource;
  /** First-answer outcome on this card: hit, miss, or a spoken try that waits for a parent ear. */
  first: "hit" | "miss" | "pending";
};

export type SessionLog = {
  id: string;
  kidId: string;
  kind: SessionKind;
  /** The module the stretch items came from. */
  moduleId?: string;
  startedAt: string;
  endedAt: string;
  /** Local calendar day the session ended on. */
  day: string;
  items: number;
  wins: number;
  misses: number;
  pending: number;
  endedOn: "win" | "miss" | "enough" | "cap" | "empty";
  results: SessionResult[];
  /** Spoken tries the parent graded as hits since the previous session; each earned a late star. */
  lateWins?: number;
};

export type ReviewCard = {
  moduleId: string;
  stage: 0 | 1 | 2 | 3 | 4;
  /** Local day the card is next due. */
  nextAt: string;
  lastAt: string;
  streak: number;
  /** Review sessions in a row with a first-try miss on this module. */
  slips: number;
};

export type ProposalKind = "next-module" | "next-band" | "ease" | "harden" | "refresh" | "unlock-words" | "map-path";

export type PathEffect =
  | { op: "append"; moduleIds: string[] }
  | { op: "insertAfterActive"; moduleIds: string[] }
  | { op: "insertBefore"; moduleId: string; moduleIds: string[] }
  | { op: "hold"; moduleId: string }
  | { op: "reopen"; moduleId: string }
  | { op: "setModuleStretch"; moduleId: string; stretch: Stretch }
  | { op: "setVerdict"; moduleId: string; verdict: ModuleVerdict; by?: VerdictBy }
  | { op: "unlockWords" }
  | { op: "replacePath"; path: string[] }
  | { op: "createModules"; modules: ModuleDef[]; then: PathEffect }
  | { op: "requestMap" }
  | { op: "requestScout" }
  | { op: "none" };

/** What a finished map wants the path to be. */
export type BuiltPathLike = { path: string[]; passed: string[] };

export type ProposalOption = { id: string; label: string; effects: PathEffect[]; primary?: boolean };

export type Proposal = {
  id: string;
  kidId: string;
  kind: ProposalKind;
  at: string;
  /** Parent words, real numbers. */
  why: string;
  evidence: { attempts?: number; hits?: number; misses?: number; lastAt?: string; band?: string; bits?: string[]; sessions?: string[]; moduleId?: string };
  options: ProposalOption[];
  status: "pending" | "accepted" | "later" | "dismissed";
  decidedAt?: string;
  chosen?: string;
  /** For `later` / `dismissed`: the kind may come back once the kid has this many daily sessions. */
  snoozeUntilSessions?: number;
};

export type KidPlan = {
  /** `path`: the kid follows the approved path on their own. `each`: every module change is a proposal. */
  gate: "path" | "each";
  moduleStretch: Record<string, Stretch>;
  review: ReviewCard[];
  proposals: Proposal[];
  /** Parent asked for a new map; the old report and path stay until the new map finishes. */
  mapRequested?: boolean;
  /** Parent (or an accepted proposal) asked for a scout; the done page offers the tunnel after the next daily. */
  scoutRequested?: boolean;
  /** dailySessions count when the last scout ran. */
  lastScoutSession?: number;
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
  /**
   * 1: paths were back-filled from the starter kids on every load.
   * 2: seeding ran once; `held` is honoured.
   * 3: verdicts carry who set them, sessions are logged, each kid has a plan (review cards, proposals).
   */
  version: 3;
  kids: Child[];
  modules: ModuleDef[];
  attempts: Attempt[];
  verdicts: Record<string, VerdictRecord>;
  scouts: ScoutReport[];
  sessions: SessionLog[];
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
