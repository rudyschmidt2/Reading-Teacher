import { wordsUnlocked } from "./catalog.ts";
import { addDays } from "./clock.ts";
import { bandsFor, buildBandModule } from "./diagnostic.ts";
import {
  isCold,
  isHit,
  isMiss,
  kidNextModule,
  moduleAttempts,
  passWindow,
  verdictKey,
  verdictOf,
  verdictRecord,
} from "./grades.ts";
import { planOf, withPath } from "./house.ts";
import { tripSessionLength } from "./trip.ts";
import type {
  Attempt,
  BuiltPathLike,
  Child,
  HouseState,
  ItemSource,
  LessonItem,
  ModuleDef,
  PathEffect,
  Proposal,
  ProposalKind,
  ProposalOption,
  ReviewCard,
  SessionLog,
  Stretch,
  VerdictRecord,
} from "./types";

/**
 * The continue-learning loop. Pure: every function takes the kid and the
 * house and returns new values. The store applies them.
 *
 *   place → learn the active module → pass it → it joins spaced review →
 *   the next queued module goes active → when the path runs out, a kid
 *   stalls, a review slips, or Myles's readiness rule fires, the engine writes
 *   a PROPOSAL and the kid keeps doing review until the parent taps Accept.
 *
 * The engine never edits the path. `applyProposal` runs only from a parent
 * tap. Following the approved path to its next module is not a change.
 */

export type PlanState = "placing" | "learning" | "reviewing";

export const REVIEW_DAYS = [2, 5, 12, 30, 60] as const;
/** Sessions a snoozed or dismissed proposal stays quiet for. */
export const SNOOZE_SESSIONS = 3;
const SIZE = { shorter: 5, standard: 7, longer: 9 } as const;

type House = Pick<HouseState, "modules" | "verdicts" | "attempts" | "sessions">;

export const activeModule = kidNextModule;

export function planState(child: Child, house: Pick<HouseState, "modules" | "verdicts">): PlanState {
  if (!child.diagnosticReport) return "placing";
  return activeModule(child, house) ? "learning" : "reviewing";
}

const moduleOf = (house: Pick<HouseState, "modules">, id: string) => house.modules.find((m) => m.id === id);

/** A module the kid may play right now: letters modules always, word modules once words are unlocked. */
export function usableFor(child: Child, mod?: ModuleDef): mod is ModuleDef {
  return Boolean(mod && (mod.track === "letters" || wordsUnlocked(child)));
}

export function queuedModules(child: Child, house: Pick<HouseState, "modules" | "verdicts">): ModuleDef[] {
  const active = activeModule(child, house);
  const from = active ? child.path.indexOf(active.id) + 1 : child.path.length;
  return child.path
    .slice(from)
    .map((id) => moduleOf(house, id))
    .filter((m): m is ModuleDef => Boolean(m) && verdictOf(house, child.id, m!.id) !== "pass");
}

/** Modules this kid has passed, most recently passed first (path order breaks ties). */
export function passedModules(child: Child, house: Pick<HouseState, "modules" | "verdicts">): ModuleDef[] {
  const rows = house.modules
    .map((m) => ({ m, rec: verdictRecord(house, child.id, m.id) }))
    .filter((r) => r.rec?.verdict === "pass");
  const order = (m: ModuleDef) => {
    const i = child.path.indexOf(m.id);
    return i === -1 ? 999 : i;
  };
  return rows.sort((a, b) => (b.rec!.at || "").localeCompare(a.rec!.at || "") || order(b.m) - order(a.m)).map((r) => r.m);
}

// ---------------------------------------------------------------------------
// Spaced review
// ---------------------------------------------------------------------------

export function newReviewCard(moduleId: string, today: string): ReviewCard {
  return { moduleId, stage: 0, nextAt: addDays(today, REVIEW_DAYS[0]), lastAt: today, streak: 0, slips: 0 };
}

export function withReviewCard(child: Child, moduleId: string, today: string): Child {
  const plan = planOf(child);
  if (plan.review.some((c) => c.moduleId === moduleId)) return child;
  return { ...child, plan: { ...plan, review: [...plan.review, newReviewCard(moduleId, today)] } };
}

export function withoutReviewCard(child: Child, moduleId: string): Child {
  const plan = planOf(child);
  return { ...child, plan: { ...plan, review: plan.review.filter((c) => c.moduleId !== moduleId) } };
}

export function dueReview(child: Child, today: string): ReviewCard[] {
  return planOf(child)
    .review.filter((c) => c.nextAt <= today)
    .sort((a, b) => a.nextAt.localeCompare(b.nextAt));
}

/** Move a card after a review sitting: every pulled item hit → next stage; any first-try miss → back a stage, due tomorrow. */
export function bumpCard(card: ReviewCard, hits: number, misses: number, today: string): ReviewCard {
  if (hits + misses === 0) return card;
  if (misses === 0) {
    const stage = Math.min(4, card.stage + 1) as ReviewCard["stage"];
    return { ...card, stage, nextAt: addDays(today, REVIEW_DAYS[stage]), lastAt: today, streak: card.streak + 1, slips: 0 };
  }
  const stage = Math.max(0, card.stage - 1) as ReviewCard["stage"];
  return { ...card, stage, nextAt: addDays(today, 1), lastAt: today, streak: 0, slips: card.slips + 1 };
}

/** A stage-4 card that has been clean for a while is retired: the skill stuck. */
const retired = (c: ReviewCard) => c.stage === 4 && c.streak >= 6;

// ---------------------------------------------------------------------------
// Session shape
// ---------------------------------------------------------------------------

export type SessionEntry = { item: LessonItem; moduleId: string; source: ItemSource };

export type Session = {
  kind: "daily" | "review";
  /** The module the stretch items came from. */
  moduleId?: string;
  entries: SessionEntry[];
  /** One known item to end on a real win when the last stretch card missed. */
  closers: SessionEntry[];
  reviewed: string[];
};

/** One tap, one drag, one speak, one trace up front, then the rest. */
export function leadOrder(items: LessonItem[]): LessonItem[] {
  const taps = items.filter((it) => it.kind === "tap" && it.widget !== "trace");
  const drags = items.filter((it) => it.kind === "drag");
  const speaks = items.filter((it) => it.kind === "speak");
  const traces = items.filter((it) => it.widget === "trace");
  const lead = [taps[0], drags[0], speaks[0], traces[0]].filter(Boolean) as LessonItem[];
  const used = new Set(lead.map((it) => it.id));
  return [...lead, ...items.filter((it) => !used.has(it.id))];
}

/** Three choices for an eased card: the right one plus the first two foils. Authored lists put the answer first. */
function easeChoices(item: LessonItem): LessonItem {
  if (!item.choices || item.choices.length <= 3 || !item.correctId) return item;
  const right = item.choices.find((c) => c.id === item.correctId);
  if (!right) return item;
  return { ...item, choices: [right, ...item.choices.filter((c) => c.id !== item.correctId).slice(0, 2)] };
}

function reviewItemFor(child: Child, mod: ModuleDef, attempts: Attempt[], card: ReviewCard, taken: Set<string>): LessonItem | undefined {
  const mine = moduleAttempts(child.id, mod.id, attempts);
  const lastMiss = [...mine].reverse().find(isMiss);
  const missed = lastMiss ? mod.items.find((i) => i.id === lastMiss.itemId) : undefined;
  if (missed && !taken.has(missed.id)) return missed;
  const pool = mod.items.filter((i) => (i.kind === "tap" && i.widget !== "trace") || i.kind === "speak").filter((i) => !taken.has(i.id));
  const list = pool.length ? pool : mod.items.filter((i) => !taken.has(i.id));
  return list.length ? list[card.streak % list.length] : undefined;
}

export function sessionSize(child: Child, width: number): number {
  return SIZE[tripSessionLength(child.sessionLength, width)];
}

export function moduleStretch(child: Child, moduleId: string): Stretch {
  return planOf(child).moduleStretch[moduleId] ?? child.stretch;
}

/**
 * Build today's session: warm-up review (0–2 due cards) → stretch on the
 * active module shaped by its stretch knob → at least one speak step → one
 * closer held back for a win at the end. With no active module the whole
 * session is a review ("victory lap") from due cards and recently passed
 * modules.
 */
export function buildSession(child: Child, house: House, today: string, width = 390): Session {
  const size = sessionSize(child, width);
  const active = activeModule(child, house);
  const due = dueReview(child, today);
  const entries: SessionEntry[] = [];
  const taken = new Set<string>();
  const reviewed: string[] = [];
  const push = (item: LessonItem, moduleId: string, source: ItemSource) => {
    const key = `${moduleId}:${item.id}`;
    if (taken.has(key)) return false;
    taken.add(key);
    entries.push({ item, moduleId, source });
    return true;
  };

  const warmCount = active ? Math.min(2, due.length) : due.length;
  for (const card of due.slice(0, warmCount)) {
    const mod = moduleOf(house, card.moduleId);
    if (!usableFor(child, mod)) continue;
    const it = reviewItemFor(child, mod, house.attempts, card, new Set(entries.filter((e) => e.moduleId === mod.id).map((e) => e.item.id)));
    if (it && push(it, mod.id, "review") && !reviewed.includes(mod.id)) reviewed.push(mod.id);
  }

  if (!active) {
    const pool: ModuleDef[] = [];
    for (const id of [...due.map((c) => c.moduleId), ...passedModules(child, house).map((m) => m.id)]) {
      const mod = moduleOf(house, id);
      if (usableFor(child, mod) && !pool.some((m) => m.id === mod.id)) pool.push(mod);
    }
    let round = 0;
    while (entries.length < size && round < 8 && pool.length) {
      let added = false;
      for (const mod of pool.slice(0, 3)) {
        const next = leadOrder(mod.items).find((it) => !taken.has(`${mod.id}:${it.id}`));
        if (next && push(next, mod.id, "review")) {
          added = true;
          if (!reviewed.includes(mod.id)) reviewed.push(mod.id);
        }
        if (entries.length >= size) break;
      }
      if (!added) break;
      round += 1;
    }
    return { kind: "review", entries, closers: [], reviewed };
  }

  const stretch = moduleStretch(child, active.id);
  const room = Math.max(3, size - entries.length - (stretch === "harder" ? 1 : 0));
  const cap = stretch === "easier" ? Math.min(room, 4) : room;
  // Rotate through the module: cards the kid missed come back first, then
  // cards never hit cold, then known cards. A phone session of five never
  // deals the same five twice while the module still has fresh cards.
  const mine = moduleAttempts(child.id, active.id, house.attempts);
  const hitCold = new Set(mine.filter((a) => isHit(a) && isCold(a)).map((a) => a.itemId));
  const missedIds = new Set(mine.filter(isMiss).map((a) => a.itemId));
  const ordered = leadOrder(active.items);
  let lead = [
    ...ordered.filter((i) => !hitCold.has(i.id) && missedIds.has(i.id)),
    ...ordered.filter((i) => !hitCold.has(i.id) && !missedIds.has(i.id)),
    ...ordered.filter((i) => hitCold.has(i.id)),
  ];
  if (stretch === "easier") {
    const lastHit = [...mine].reverse().find(isHit);
    const warm = lastHit ? active.items.find((i) => i.id === lastHit.itemId) : undefined;
    if (warm) lead = [warm, ...lead.filter((i) => i.id !== warm.id)];
    lead = lead.map(easeChoices);
  }
  for (const it of lead.slice(0, cap)) push(it, active.id, "stretch");

  if (!entries.some((e) => e.item.kind === "speak")) {
    const speak = active.items.find((i) => i.kind === "speak" && !taken.has(`${active.id}:${i.id}`));
    if (speak) {
      const lastStretch = [...entries].reverse().find((e) => e.source === "stretch" && e.item.kind !== "speak");
      if (lastStretch && entries.filter((e) => e.source === "stretch").length >= cap) {
        const idx = entries.indexOf(lastStretch);
        taken.delete(`${active.id}:${lastStretch.item.id}`);
        taken.add(`${active.id}:${speak.id}`);
        entries[idx] = { item: speak, moduleId: active.id, source: "stretch" };
      } else {
        push(speak, active.id, "stretch");
      }
    }
  }

  if (stretch === "harder") {
    const next = queuedModules(child, house).find((m) => usableFor(child, m));
    const it = next ? leadOrder(next.items)[0] : undefined;
    if (next && it) push(it, next.id, "stretch");
  }

  const closers: SessionEntry[] = [];
  for (const mod of passedModules(child, house).filter((m) => usableFor(child, m))) {
    const it = leadOrder(mod.items).find((i) => i.kind === "tap" && i.widget !== "trace" && !taken.has(`${mod.id}:${i.id}`));
    if (it) {
      closers.push({ item: it, moduleId: mod.id, source: "close" });
      break;
    }
  }

  return { kind: "daily", moduleId: active.id, entries, closers, reviewed };
}

// ---------------------------------------------------------------------------
// After a session: cards, counters, the auto verdict, proposals
// ---------------------------------------------------------------------------

const pid = (kind: ProposalKind, now: Date) => `pp-${kind}-${now.getTime().toString(36)}`;

function opt(id: string, label: string, effects: PathEffect[], primary = false): ProposalOption {
  return { id, label, effects, primary };
}

function kidSessions(house: House, kidId: string, kind?: SessionLog["kind"]): SessionLog[] {
  return house.sessions.filter((s) => s.kidId === kidId && (!kind || s.kind === kind));
}

const stretchOf = (log: SessionLog) => log.results.filter((r) => r.source === "stretch");
const hitsOf = (log: SessionLog) => stretchOf(log).filter((r) => r.first === "hit").length;
const missesOf = (log: SessionLog) => stretchOf(log).filter((r) => r.first === "miss").length;

/**
 * The next ladder band this kid has not passed and does not have on the path.
 * `held` is not a filter: the map's own build parks the later starter
 * modules there, so a held bank module is exactly what comes next. A parent
 * who really does not want it taps Dismiss.
 */
export function nextBandFor(child: Child, house: Pick<HouseState, "modules" | "verdicts">) {
  const bands = bandsFor(child.track);
  const onPath = new Set(child.path);
  return bands.find((b) => b.bankModule && !onPath.has(b.bankModule) && verdictOf(house, child.id, b.bankModule) !== "pass");
}

export function proposeNextBand(child: Child, house: Pick<HouseState, "modules" | "verdicts">, now: Date, stamp = now.getTime().toString(36)): Proposal | undefined {
  const report = child.diagnosticReport;
  if (!report) return undefined;
  const known = report.bands.filter((b) => b.status === "known").map((b) => b.title);
  const passed = passedModules(child, house).length;
  const band = nextBandFor(child, house);
  if (!band) {
    return {
      id: pid("next-band", now),
      kidId: child.id,
      kind: "next-band",
      at: now.toISOString(),
      why: `${child.name} has finished every module on the path and every band on the ladder (${passed} passed). What comes next is your call.`,
      evidence: {},
      options: [
        opt("scout", "Send a scout for what's next", [{ op: "requestScout" }], true),
        opt("library", "Add from the library", [{ op: "none" }]),
        opt("map", "Map again first", [{ op: "requestMap" }]),
      ],
      status: "pending",
    };
  }
  const result = report.bands.find((b) => b.id === band.id);
  const missed = result?.missed ?? [];
  const practice = missed.length ? buildBandModule(child.id, child.track, band.id, missed, stamp) : undefined;
  const status = result && result.status !== "not-reached" ? `${result.status}, ${result.hits}/${result.answered}${missed.length ? `, missed ${missed.join(", ")}` : ""}` : "not reached on the map";
  const bank = band.bankModule!;
  const options: ProposalOption[] = [
    opt(
      "add",
      `Add ${band.title}`,
      practice ? [{ op: "createModules", modules: [practice], then: { op: "append", moduleIds: [practice.id, bank] } }] : [{ op: "append", moduleIds: [bank] }],
      true,
    ),
  ];
  if (practice) options.push(opt("practice", "Add only the practice module", [{ op: "createModules", modules: [practice], then: { op: "append", moduleIds: [practice.id] } }]));
  options.push(opt("map", "Map again first", [{ op: "requestMap" }]));
  options.push(opt("library", "Pick from the library", [{ op: "none" }]));
  return {
    id: pid("next-band", now),
    kidId: child.id,
    kind: "next-band",
    at: now.toISOString(),
    why: `${child.name} finished every module on the path (${passed} passed). The map says the next band is ${band.title} (${status}).${known.length ? ` Known: ${known.join(", ")}.` : ""}`,
    evidence: { band: band.id, bits: missed },
    options,
    status: "pending",
  };
}

function proposeEase(child: Child, mod: ModuleDef, logs: SessionLog[], house: House, now: Date, stamp: string): Proposal {
  const mine = moduleAttempts(child.id, mod.id, house.attempts);
  const hits = mine.filter(isHit).length;
  const misses = mine.filter(isMiss).length;
  const missedItems = [...mine].filter(isMiss).map((a) => a.itemId);
  const counts = new Map<string, number>();
  for (const id of missedItems) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topItem = top ? mod.items.find((i) => i.id === top[0]) : undefined;
  const topLine = topItem ? ` Missed "${topItem.word ?? topItem.letter ?? topItem.prompt}" ${top![1]}×.` : "";
  const bits = [...new Set(mine.filter(isMiss).map((a) => mod.items.find((i) => i.id === a.itemId)).map((i) => i?.word ?? i?.letter).filter(Boolean) as string[])];
  const band = bandsFor(child.track).find((b) => b.bankModule === mod.id || mod.id.includes(`-${b.id}-`));
  const practice = band && bits.length ? buildBandModule(child.id, child.track, band.id, bits, stamp) : undefined;
  const days = logs.map((l) => l.day.slice(5)).join(", ");
  const options: ProposalOption[] = [opt("ease", "Ease it", [{ op: "setModuleStretch", moduleId: mod.id, stretch: "easier" }], true)];
  if (practice) options.push(opt("neighbor", "Neighbor practice first", [{ op: "createModules", modules: [practice], then: { op: "insertBefore", moduleId: mod.id, moduleIds: [practice.id] } }]));
  options.push(opt("hold", "Hold it, move on", [{ op: "hold", moduleId: mod.id }]));
  options.push(opt("keep", "Keep going as is", [{ op: "none" }]));
  return {
    id: pid("ease", now),
    kidId: child.id,
    kind: "ease",
    at: now.toISOString(),
    why: `${child.name} stalled on ${mod.title} two sessions running (${days}): ${hits} hits, ${misses} misses.${topLine} They heard "not that one", never fail.`,
    evidence: { moduleId: mod.id, hits, misses, sessions: logs.map((l) => l.id), bits },
    options,
    status: "pending",
  };
}

function proposeHarden(child: Child, mod: ModuleDef, logs: SessionLog[], house: House, now: Date): Proposal {
  const mine = moduleAttempts(child.id, mod.id, house.attempts).filter((a) => isCold(a) && isHit(a) && a.kind !== "speak" && a.ms > 0);
  const avg = mine.length ? Math.round(mine.reduce((s, a) => s + a.ms, 0) / mine.length) : undefined;
  const cold = logs.reduce((n, l) => n + hitsOf(l), 0);
  return {
    id: pid("harden", now),
    kidId: child.id,
    kind: "harden",
    at: now.toISOString(),
    why: `${child.name} is coasting on ${mod.title}: ${cold}/${cold} cold hits over two sessions${avg ? `, ${(avg / 1000).toFixed(1)} s per hit` : ""}. Harden?`,
    evidence: { moduleId: mod.id, hits: cold, misses: 0, sessions: logs.map((l) => l.id) },
    options: [
      opt("harden", "Harden", [{ op: "setModuleStretch", moduleId: mod.id, stretch: "harder" }], true),
      opt("done", "Mark done, move on", [{ op: "setVerdict", moduleId: mod.id, verdict: "pass" }]),
      opt("keep", "Keep as is", [{ op: "none" }]),
    ],
    status: "pending",
  };
}

function proposeRefresh(child: Child, mod: ModuleDef, card: ReviewCard, house: House, now: Date, stamp: string): Proposal {
  const mine = moduleAttempts(child.id, mod.id, house.attempts).filter((a) => a.source === "review");
  const missed = [...new Set(mine.filter(isMiss).map((a) => mod.items.find((i) => i.id === a.itemId)?.word ?? mod.items.find((i) => i.id === a.itemId)?.letter).filter(Boolean) as string[])];
  const band = bandsFor(child.track).find((b) => b.bankModule === mod.id || mod.id.includes(`-${b.id}-`));
  const mini = band && missed.length ? buildBandModule(child.id, child.track, band.id, missed, stamp, `${mod.title} refresher`) : undefined;
  const options: ProposalOption[] = [opt("reopen", `Reopen ${mod.title}`, [{ op: "reopen", moduleId: mod.id }], true)];
  if (mini) options.push(opt("mini", "Mini refresher", [{ op: "createModules", modules: [mini], then: { op: "insertAfterActive", moduleIds: [mini.id] } }]));
  options.push(opt("keep", "Keep reviewing", [{ op: "none" }]));
  return {
    id: pid("refresh", now),
    kidId: child.id,
    kind: "refresh",
    at: now.toISOString(),
    why: `${mod.title} is slipping in review: ${card.slips} review sittings in a row with a first-try miss${missed.length ? ` (${missed.join(", ")})` : ""}.`,
    evidence: { moduleId: mod.id, bits: missed },
    options,
    status: "pending",
  };
}

export function proposeUnlockWords(child: Child, now: Date): Proposal {
  const report = child.diagnosticReport;
  const sounds = report?.bands.find((b) => b.id === "my-sounds");
  const first = report?.bands.find((b) => b.id === "my-first-sounds");
  const line = sounds && first ? ` Letter sounds ${sounds.hits}/${sounds.answered}, first sounds ${first.hits}/${first.answered} on the map.` : "";
  return {
    id: pid("unlock-words", now),
    kidId: child.id,
    kind: "unlock-words",
    at: now.toISOString(),
    why: `${child.name}: letter sounds and first sounds are both known.${line} The rule says ready for print words. Your call.`,
    evidence: {},
    options: [opt("unlock", "Unlock words", [{ op: "unlockWords" }], true), opt("later", "Not yet", [{ op: "none" }])],
    status: "pending",
  };
}

function proposeNextModule(child: Child, passed: ModuleDef, next: ModuleDef, now: Date): Proposal {
  return {
    id: pid("next-module", now),
    kidId: child.id,
    kind: "next-module",
    at: now.toISOString(),
    why: `${child.name} passed ${passed.title}. Next on the path: ${next.title}.`,
    evidence: { moduleId: next.id },
    options: [
      opt("start", `Start ${next.title}`, [{ op: "reopen", moduleId: next.id }], true),
      opt("hold", `Hold ${next.title}, pick another`, [{ op: "none" }]),
    ],
    status: "pending",
  };
}

/** The new map is done; the path is the parent's, so the rebuild is offered, not applied. */
export function proposeMapPath(child: Child, built: BuiltPathLike, now: Date): Proposal {
  const current = child.path;
  const kept = current.filter((id) => !id.startsWith(`dx-${child.id}-`) && !bandsFor(child.track).some((b) => b.bankModule === id));
  const merged = [...built.path, ...kept.filter((id) => !built.path.includes(id))];
  const added = built.path.filter((id) => !current.includes(id)).length;
  const dropped = current.filter((id) => !built.path.includes(id)).length;
  const passes: PathEffect[] = built.passed.map((id) => ({ op: "setVerdict", moduleId: id, verdict: "pass", by: "map" }));
  return {
    id: pid("map-path", now),
    kidId: child.id,
    kind: "map-path",
    at: now.toISOString(),
    why: `New map for ${child.name}. The map would build a ${built.path.length}-module path (${added} new, ${dropped} of the current ${current.length} dropped${kept.length ? `, ${kept.length} you added by hand` : ""}).`,
    evidence: {},
    options: [
      opt("use", "Use the new path", [...passes, { op: "replacePath", path: built.path }], true),
      opt("merge", "Merge: new path, keep my modules", [...passes, { op: "replacePath", path: merged }]),
      opt("keep", "Keep the current path", [{ op: "none" }]),
    ],
    status: "pending",
  };
}

const quiet = (plan: Child["plan"], kind: ProposalKind, sessions: number) =>
  Boolean(
    plan?.proposals.some(
      (p) => p.kind === kind && ((p.status === "later" || p.status === "dismissed") && (p.snoozeUntilSessions ?? 0) > sessions),
    ),
  );

export type AfterSession = { kid: Child; verdicts: Record<string, VerdictRecord>; stars: number };

/**
 * Apply one finished session. Review cards move, counters tick, the active
 * module's auto verdict is re-read, and any proposal the evidence supports is
 * added to the inbox. The path is not touched.
 */
export function afterSession(child: Child, house: House, log: SessionLog, now = new Date()): AfterSession {
  const today = log.day;
  const plan = { ...planOf(child), review: [...planOf(child).review] };
  let kid: Child = { ...child, plan };
  const verdicts = { ...house.verdicts };
  const stamp = now.getTime().toString(36);

  if (log.kind === "daily" || log.kind === "review") {
    const tally = new Map<string, { hit: number; miss: number }>();
    for (const r of log.results) {
      if (r.source !== "review") continue;
      const t = tally.get(r.moduleId) ?? { hit: 0, miss: 0 };
      if (r.first === "hit") t.hit += 1;
      else if (r.first === "miss") t.miss += 1;
      tally.set(r.moduleId, t);
    }
    plan.review = plan.review
      .map((card) => {
        const t = tally.get(card.moduleId);
        return t ? bumpCard(card, t.hit, t.miss, today) : card;
      })
      .filter((c) => !retired(c));
    if (log.wins >= 1) {
      kid = { ...kid, dailySessions: (kid.dailySessions ?? 0) + 1, lastDailyDate: today };
    }
  }
  if (log.kind === "scout") {
    kid = { ...kid, lastScoutDate: today };
    plan.lastScoutSession = kid.dailySessions ?? 0;
    plan.scoutRequested = false;
  }

  let justPassed: ModuleDef | undefined;
  if (log.moduleId && (log.kind === "daily" || log.kind === "try")) {
    const mod = moduleOf(house, log.moduleId);
    const rec = verdictRecord(house, child.id, log.moduleId);
    if (mod && (!rec || rec.by === "auto")) {
      const w = passWindow(moduleAttempts(child.id, mod.id, house.attempts), mod.items.length);
      const key = verdictKey(child.id, mod.id);
      if (w.verdict === "open") delete verdicts[key];
      else verdicts[key] = { verdict: w.verdict, by: "auto", at: now.toISOString(), window: { attempts: w.attempts, correct: w.correct } };
      if (w.verdict === "pass") {
        if (rec?.verdict !== "pass") justPassed = mod;
        if (!plan.review.some((c) => c.moduleId === mod.id)) plan.review.push(newReviewCard(mod.id, today));
      }
    }
  }

  const houseNow: House = { ...house, verdicts };
  const sessions = kid.dailySessions ?? 0;
  const fresh: Proposal[] = [];

  if (justPassed && plan.gate === "each") {
    const next = queuedModules(kid, houseNow).find((m) => usableFor(kid, m));
    if (next) {
      kid = withPath(kid, kid.path.filter((id) => id !== next.id));
      fresh.push(proposeNextModule(kid, justPassed, next, now));
    }
  }

  if (kid.status === "active" && kid.diagnosticReport && !activeModule(kid, houseNow) && !quiet(plan, "next-band", sessions)) {
    const p = proposeNextBand(kid, houseNow, now, stamp);
    if (p) fresh.push(p);
  }

  if (log.kind === "daily" && log.moduleId) {
    const mod = moduleOf(house, log.moduleId);
    const recent = kidSessions(houseNow, child.id, "daily").filter((s) => s.moduleId === log.moduleId).slice(-2);
    if (mod && recent.length === 2 && verdicts[verdictKey(child.id, mod.id)]?.verdict !== "pass") {
      const stalled = recent.every((s) => missesOf(s) > hitsOf(s) || s.endedOn === "miss");
      const coasting = recent.every((s) => missesOf(s) === 0 && hitsOf(s) >= 5);
      if (stalled && !quiet(plan, "ease", sessions)) fresh.push(proposeEase(kid, mod, recent, houseNow, now, stamp));
      else if (coasting && !quiet(plan, "harden", sessions)) fresh.push(proposeHarden(kid, mod, recent, houseNow, now));
    }
  }

  const slipping = plan.review.find((c) => c.slips >= 2);
  if (slipping && !quiet(plan, "refresh", sessions)) {
    const mod = moduleOf(house, slipping.moduleId);
    if (mod) fresh.push(proposeRefresh(kid, mod, slipping, houseNow, now, stamp));
  }

  if (kid.track === "letters" && kid.readyForPrintWords && !kid.parentUnlockedWords && !quiet(plan, "unlock-words", sessions)) {
    fresh.push(proposeUnlockWords(kid, now));
  }

  plan.proposals = mergeProposals(plan.proposals, fresh);
  return { kid: { ...kid, plan }, verdicts, stars: 0 };
}

/** One pending proposal per kind; a newer one replaces an older pending one. Decided ones are kept (last 20). */
export function mergeProposals(existing: Proposal[], fresh: Proposal[]): Proposal[] {
  const kinds = new Set(fresh.map((p) => p.kind));
  const kept = existing.filter((p) => !(p.status === "pending" && kinds.has(p.kind)));
  const decided = kept.filter((p) => p.status !== "pending").slice(-20);
  const pending = kept.filter((p) => p.status === "pending");
  return [...decided, ...pending, ...fresh];
}

export function pendingProposals(child: Child): Proposal[] {
  return planOf(child).proposals.filter((p) => p.status === "pending");
}

// ---------------------------------------------------------------------------
// The parent decides
// ---------------------------------------------------------------------------

type Applied = { house: HouseState; kid: Child };

function setVerdictRec(house: HouseState, kidId: string, moduleId: string, rec: VerdictRecord | undefined): HouseState {
  const verdicts = { ...house.verdicts };
  const key = verdictKey(kidId, moduleId);
  if (rec) verdicts[key] = rec;
  else delete verdicts[key];
  return { ...house, verdicts };
}

export function applyEffect(house: HouseState, kid: Child, effect: PathEffect, now: Date, today: string): Applied {
  const at = now.toISOString();
  switch (effect.op) {
    case "none":
      return { house, kid };
    case "append":
      return { house, kid: withPath(kid, [...kid.path, ...effect.moduleIds.filter((id) => !kid.path.includes(id))]) };
    case "insertAfterActive": {
      const active = activeModule(kid, house);
      const idx = active ? kid.path.indexOf(active.id) + 1 : 0;
      const ids = effect.moduleIds.filter((id) => !kid.path.includes(id));
      const path = [...kid.path.slice(0, idx), ...ids, ...kid.path.slice(idx)];
      return { house, kid: withPath(kid, path) };
    }
    case "insertBefore": {
      const idx = Math.max(0, kid.path.indexOf(effect.moduleId));
      const ids = effect.moduleIds.filter((id) => !kid.path.includes(id));
      const path = [...kid.path.slice(0, idx), ...ids, ...kid.path.slice(idx)];
      return { house, kid: withPath(kid, path) };
    }
    case "hold":
      return { house, kid: withPath(kid, kid.path.filter((id) => id !== effect.moduleId)) };
    case "reopen": {
      const next = setVerdictRec(house, kid.id, effect.moduleId, undefined);
      const path = kid.path.includes(effect.moduleId) ? kid.path : [...kid.path, effect.moduleId];
      const reopened = withoutReviewCard(withPath(kid, path), effect.moduleId);
      return { house: next, kid: reopened };
    }
    case "setModuleStretch": {
      const plan = planOf(kid);
      return { house, kid: { ...kid, plan: { ...plan, moduleStretch: { ...plan.moduleStretch, [effect.moduleId]: effect.stretch } } } };
    }
    case "setVerdict": {
      const next = setVerdictRec(house, kid.id, effect.moduleId, { verdict: effect.verdict, by: effect.by ?? "parent", at });
      const withCard = effect.verdict === "pass" && effect.by !== "map" ? withReviewCard(kid, effect.moduleId, today) : kid;
      return { house: next, kid: effect.verdict === "pass" ? withCard : withoutReviewCard(withCard, effect.moduleId) };
    }
    case "unlockWords": {
      if (!kid.readyForPrintWords) return { house, kid };
      const path = [...kid.path.filter((id) => id !== "rh-cvc-smash"), "rh-cvc-smash"];
      return { house, kid: withPath({ ...kid, parentUnlockedWords: true, track: "words" }, path) };
    }
    case "replacePath":
      return { house, kid: withPath(kid, effect.path) };
    case "createModules": {
      const known = new Set(house.modules.map((m) => m.id));
      const modules = [...house.modules, ...effect.modules.filter((m) => !known.has(m.id))];
      return applyEffect({ ...house, modules }, kid, effect.then, now, today);
    }
    case "requestMap": {
      const plan = planOf(kid);
      return { house, kid: { ...kid, plan: { ...plan, mapRequested: true } } };
    }
    case "requestScout": {
      const plan = planOf(kid);
      return { house, kid: { ...kid, plan: { ...plan, scoutRequested: true } } };
    }
  }
}

/** A parent tapped one option. Effects run in order; the proposal is marked accepted with what was chosen. */
export function applyProposal(house: HouseState, kidId: string, proposalId: string, optionId: string, now: Date, today: string): HouseState {
  const kid = house.kids.find((k) => k.id === kidId);
  if (!kid) return house;
  const plan = planOf(kid);
  const proposal = plan.proposals.find((p) => p.id === proposalId);
  const option = proposal?.options.find((o) => o.id === optionId);
  if (!proposal || !option) return house;
  let applied: Applied = { house, kid };
  for (const effect of option.effects) applied = applyEffect(applied.house, applied.kid, effect, now, today);
  const nextPlan = planOf(applied.kid);
  const decided: Child = {
    ...applied.kid,
    plan: {
      ...nextPlan,
      proposals: nextPlan.proposals.map((p) => (p.id === proposalId ? { ...p, status: "accepted" as const, decidedAt: now.toISOString(), chosen: optionId } : p)),
    },
  };
  return { ...applied.house, kids: applied.house.kids.map((k) => (k.id === kidId ? decided : k)) };
}

/** Later keeps the kind quiet for a few sessions; Dismiss too, so the inbox never nags. */
export function snoozeProposal(kid: Child, proposalId: string, status: "later" | "dismissed", now: Date): Child {
  const plan = planOf(kid);
  return {
    ...kid,
    plan: {
      ...plan,
      proposals: plan.proposals.map((p) =>
        p.id === proposalId ? { ...p, status, decidedAt: now.toISOString(), snoozeUntilSessions: (kid.dailySessions ?? 0) + SNOOZE_SESSIONS } : p,
      ),
    },
  };
}
