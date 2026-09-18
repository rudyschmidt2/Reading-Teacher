import { answerProbe, currentProbe, finishDiagnostic, startDiagnostic } from "../lib/diagnostic.ts";
import { emptyHouse, planOf, withPath } from "../lib/house.ts";
import {
  activeModule,
  afterSession,
  applyProposal,
  buildSession,
  bumpCard,
  dueReview,
  mergeProposals,
  newReviewCard,
  pendingProposals,
  planState,
  proposeMapPath,
  proposeNextBand,
  proposeUnlockWords,
  queuedModules,
  snoozeProposal,
} from "../lib/plan.ts";

// The worked runs from continue-learning-workflow.md. Each run drives the
// pure engine the way the store does: attempts land, a session log is
// written, afterSession returns the new kid / verdicts / proposals, and a
// parent tap goes through applyProposal. The path is only ever written by
// that tap (or by following it).

const checks = [];
const check = (name, ok, detail = "") => checks.push([name, ok, detail]);
const DAY = "2026-09-18";
const now = new Date("2026-09-18T19:30:00-05:00");
const day = (n) => `2026-09-${String(18 + n).padStart(2, "0")}`;

function mapFor(track, knows) {
  let p = startDiagnostic(track, now);
  let guard = 0;
  while (p.cursor && guard++ < 500) {
    const probe = currentProbe(p);
    p = answerProbe(p, probe, knows(probe.band, probe.bit), 900, now);
  }
  return p;
}

/** A house where one kid has a finished map and the path it built. */
function housed(kidId, track, knows) {
  const house = emptyHouse();
  const progress = mapFor(track, knows);
  const { report, built } = finishDiagnostic(kidId, progress, "t");
  house.modules.push(...built.modules);
  for (const id of built.passed) house.verdicts[`${kidId}:${id}`] = { verdict: "pass", by: "map", at: now.toISOString() };
  house.kids = house.kids.map((k) => (k.id === kidId ? withPath({ ...k, diagnostic: progress, diagnosticReport: report, placementGrade: report.shelf }, built.path) : k));
  return house;
}

const kidOf = (house, id) => house.kids.find((k) => k.id === id);
let n = 0;
const attempt = (kidId, moduleId, item, over = {}) => ({
  id: `a${n++}`,
  kidId,
  moduleId,
  itemId: item.id,
  version: 0,
  kind: item.kind,
  dimension: item.dimension,
  correct: true,
  ms: 900,
  at: now.toISOString(),
  kidSaw: "star",
  source: "daily",
  ...over,
});

/** Play one built session for real: every card hit (or missed per `missOn`), then log it and run afterSession. */
function play(house, kidId, dayStamp, missOn = () => false, width = 390) {
  const kid = kidOf(house, kidId);
  const session = buildSession(kid, house, dayStamp, width);
  const attempts = [...house.attempts];
  const results = [];
  for (const e of session.entries) {
    const ok = !missOn(e);
    const source = e.source === "stretch" ? "daily" : "review";
    attempts.push(attempt(kidId, e.moduleId, e.item, { correct: ok, kidSaw: ok ? "star" : "not that one", source }));
    results.push({ itemId: e.item.id, moduleId: e.moduleId, source: e.source, first: ok ? "hit" : "miss" });
  }
  const log = {
    id: `s${n++}`,
    kidId,
    kind: session.kind,
    moduleId: session.moduleId,
    startedAt: now.toISOString(),
    endedAt: now.toISOString(),
    day: dayStamp,
    items: results.length,
    wins: results.filter((r) => r.first === "hit").length,
    misses: results.filter((r) => r.first === "miss").length,
    pending: 0,
    endedOn: results.at(-1)?.first === "hit" ? "win" : "miss",
    results,
  };
  const withAttempts = { ...house, attempts, sessions: [...house.sessions, log] };
  const out = afterSession(kid, withAttempts, log, now);
  return { house: { ...withAttempts, verdicts: out.verdicts, kids: withAttempts.kids.map((k) => (k.id === kidId ? out.kid : k)) }, session, log };
}

// --- Run 1: Hudson passes CVC smash, review card appears, next module goes active with no proposal --------
{
  let house = housed("hudson", "words", (band) => ["first-sounds", "letter-names", "letter-sounds", "short-vowels"].includes(band));
  const hudson0 = kidOf(house, "hudson");
  check("run1: Hudson starts learning", planState(hudson0, house) === "learning");
  const first = activeModule(hudson0, house);
  check("run1: the active module is the first unpassed path module", first && first.id === hudson0.path[0], first?.id);
  let s1 = play(house, "hudson", day(0));
  house = s1.house;
  check("run1: a session builds stretch items from the active module", s1.session.entries.every((e) => e.moduleId === first.id) && s1.session.entries.length >= 5);
  check("run1: every daily has a speak step", s1.session.entries.some((e) => e.item.kind === "speak"));
  check("run1: one clean session is not yet a pass", house.verdicts[`hudson:${first.id}`] === undefined);
  let s2 = play(house, "hudson", day(1));
  house = s2.house;
  const rec = house.verdicts[`hudson:${first.id}`];
  check("run1: two clean sessions auto-pass the module", rec && rec.verdict === "pass" && rec.by === "auto", JSON.stringify(rec));
  const hudson = kidOf(house, "hudson");
  check("run1: passing adds a review card due in two days", planOf(hudson).review.some((c) => c.moduleId === first.id && c.nextAt === day(3)));
  check("run1: dailySessions counted twice", hudson.dailySessions === 2 && hudson.lastDailyDate === day(1));
  const second = activeModule(hudson, house);
  check("run1: the next path module is active with no proposal (gate = path)", second && second.id !== first.id && pendingProposals(hudson).length === 0, second?.id);
  check("run1: the path itself did not change", hudson.path.join() === hudson0.path.join());
  // Two days later the warm-up opens with one review item from the passed module.
  const s3 = buildSession(hudson, house, day(3), 390);
  check("run1: the warm-up pulls one review item from the passed module", s3.entries[0].source === "review" && s3.entries[0].moduleId === first.id);
  check("run1: review items sit before the stretch", s3.entries.filter((e) => e.source === "review").length === 1 && s3.entries.slice(1).every((e) => e.source === "stretch"));
  const s3played = play(house, "hudson", day(3));
  const card = planOf(kidOf(s3played.house, "hudson")).review.find((c) => c.moduleId === first.id);
  check("run1: a clean review moves the card to stage 1, due in five days", card.stage === 1 && card.nextAt === day(8), JSON.stringify(card));
}

// --- Run 2: Riley finishes her path → reviewing + next-band proposal; Accept adds the band -----------------
{
  let house = housed("riley", "words", (band) => ["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(band) || band === "digraphs");
  const riley0 = kidOf(house, "riley");
  // Pass everything on the path by hand (parent Done), as if weeks went by.
  for (const id of riley0.path) house.verdicts[`riley:${id}`] = { verdict: "pass", by: "parent", at: now.toISOString() };
  const riley1 = kidOf(house, "riley");
  check("run2: with every module passed the kid is reviewing", planState(riley1, house) === "reviewing" && activeModule(riley1, house) === undefined);
  const s = buildSession(riley1, house, day(0), 390);
  check("run2: a review session still has real items", s.kind === "review" && s.entries.length >= 5 && s.entries.every((e) => e.source === "review"));
  check("run2: review items come from passed modules only", s.entries.every((e) => house.verdicts[`riley:${e.moduleId}`]?.verdict === "pass"));
  const played = play(house, "riley", day(0));
  house = played.house;
  const riley2 = kidOf(house, "riley");
  const proposal = pendingProposals(riley2).find((p) => p.kind === "next-band");
  check("run2: finishing the path writes a next-band proposal", Boolean(proposal), JSON.stringify(pendingProposals(riley2).map((p) => p.kind)));
  check("run2: the proposal names the next unpassed band", proposal?.evidence.band === "silent-e", proposal?.evidence.band);
  check("run2: the proposal has a primary Add option and a Later path", proposal?.options.some((o) => o.primary && /Add/.test(o.label)) && proposal?.options.length >= 3);
  check("run2: the path did not change on its own", riley2.path.join() === riley1.path.join());
  const before = riley2.path.length;
  const accepted = applyProposal(house, "riley", proposal.id, proposal.options.find((o) => o.primary).id, now, day(0));
  const riley3 = kidOf(accepted, "riley");
  check("run2: Accept appends the band's bank module", riley3.path.length === before + 1 && riley3.path.at(-1) === "rh-silent-e", riley3.path.join());
  check("run2: after Accept the kid is learning again", planState(riley3, accepted) === "learning" && activeModule(riley3, accepted).id === "rh-silent-e");
  check("run2: the proposal is marked accepted with the chosen option", planOf(riley3).proposals.find((p) => p.id === proposal.id).status === "accepted");
  // Later / dismiss keep the kind quiet.
  const snoozed = snoozeProposal(riley2, proposal.id, "later", now);
  const again = afterSession(snoozed, house, played.log, now);
  check("run2: Later keeps the kind out of the inbox for three sessions", !pendingProposals(again.kid).some((p) => p.kind === "next-band"));
}

// --- Run 3: Hudson stalls twice → ease proposal; Neighbor practice inserts before the module ----------------
{
  let house = housed("hudson", "words", (band) => ["first-sounds", "letter-names", "letter-sounds", "short-vowels"].includes(band));
  const active = activeModule(kidOf(house, "hudson"), house);
  const missAll = (e) => e.source === "stretch";
  house = play(house, "hudson", day(0), missAll).house;
  check("run3: one stalled session is not yet a proposal", pendingProposals(kidOf(house, "hudson")).every((p) => p.kind !== "ease"));
  house = play(house, "hudson", day(1), missAll).house;
  const hudson = kidOf(house, "hudson");
  const ease = pendingProposals(hudson).find((p) => p.kind === "ease");
  check("run3: two stalled sessions write an ease proposal", Boolean(ease), JSON.stringify(pendingProposals(hudson).map((p) => p.kind)));
  check("run3: the proposal carries real numbers", /misses/.test(ease?.why ?? "") && ease?.evidence.misses > 0);
  check("run3: the kid still has the same active module until a tap", activeModule(hudson, house)?.id === active.id);
  const primary = ease.options.find((o) => o.primary);
  const eased = applyProposal(house, "hudson", ease.id, primary.id, now, day(1));
  check("run3: Ease it sets a module-level stretch, not a fail", planOf(kidOf(eased, "hudson")).moduleStretch[active.id] === "easier" && eased.verdicts[`hudson:${active.id}`]?.verdict !== "pass");
  const easedSession = buildSession(kidOf(eased, "hudson"), eased, day(2), 390);
  check("run3: an eased module deals at most four stretch cards", easedSession.entries.filter((e) => e.source === "stretch").length <= 4);
  const neighbor = ease.options.find((o) => o.id === "neighbor");
  if (neighbor) {
    const practiced = applyProposal(house, "hudson", ease.id, neighbor.id, now, day(1));
    const h = kidOf(practiced, "hudson");
    const pr = h.path.find((id) => id.startsWith("pr-hudson-"));
    check("run3: Neighbor practice inserts a practice module before the stalled one", Boolean(pr) && h.path.indexOf(pr) < h.path.indexOf(active.id), h.path.join());
    check("run3: the practice module exists in the library", practiced.modules.some((m) => m.id === pr));
  } else {
    check("run3: Neighbor practice offered when bits were missed", false, JSON.stringify(ease.options.map((o) => o.id)));
  }
}

// --- Run 4: Myles → readiness flag → unlock proposal; nothing changes until the tap --------------------------
{
  let house = housed("myles", "letters", () => true);
  const myles0 = kidOf(house, "myles");
  house.kids = house.kids.map((k) => (k.id === "myles" ? { ...k, readyForPrintWords: true } : k));
  const played = play(house, "myles", day(0));
  house = played.house;
  const myles = kidOf(house, "myles");
  const unlock = pendingProposals(myles).find((p) => p.kind === "unlock-words");
  check("run4: the readiness flag writes an unlock proposal", Boolean(unlock));
  check("run4: Myles is still on letters until the tap", myles.track === "letters" && !myles.parentUnlockedWords);
  check("run4: nothing on his path is a word module", myles.path.every((id) => !id.startsWith("rh-")));
  const unlocked = applyProposal(house, "myles", unlock.id, "unlock", now, day(0));
  const m2 = kidOf(unlocked, "myles");
  check("run4: Unlock words flips the track and queues CVC smash last", m2.parentUnlockedWords && m2.track === "words" && m2.path.at(-1) === "rh-cvc-smash");
  check("run4: the proposal is a plain proposal for the standalone builder too", proposeUnlockWords(myles0, now).kind === "unlock-words");
  const later = snoozeProposal(myles, unlock.id, "later", now);
  check("run4: Not yet snoozes for three sessions", planOf(later).proposals.find((p) => p.id === unlock.id).snoozeUntilSessions === (myles.dailySessions ?? 0) + 3);
}

// --- Run 5: Cassidy is never planned -------------------------------------------------------------------------
{
  const house = emptyHouse();
  const cassidy = kidOf(house, "cassidy");
  check("run5: a waiting kid is placing, with nothing built", planState(cassidy, house) === "placing" && buildSession(cassidy, house, DAY).entries.length === 0);
  check("run5: no proposals for a waiting kid", pendingProposals(cassidy).length === 0);
}

// --- Run 6: re-map is a proposal, not a rewrite --------------------------------------------------------------
{
  const house = housed("riley", "words", (band) => ["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(band));
  const riley = kidOf(house, "riley");
  const custom = { id: "custom-1", title: "My module", track: "words", skill: "x", stretch: "stretch-hard", dimensions: ["words"], items: [], custom: true };
  const withCustom = withPath(riley, [...riley.path, custom.id]);
  const progress2 = mapFor("words", (band) => band !== "sentences");
  const rebuilt = finishDiagnostic("riley", progress2, "t2");
  const p = proposeMapPath(withCustom, rebuilt.built, now);
  check("run6: a re-map proposes; the current path is untouched", p.kind === "map-path" && withCustom.path.includes(custom.id));
  const merge = p.options.find((o) => o.id === "merge");
  const replace = merge.effects.find((e) => e.op === "replacePath");
  check("run6: Merge keeps the parent's custom module", replace.path.includes(custom.id) && replace.path[0] === rebuilt.built.path[0]);
  const use = p.options.find((o) => o.id === "use").effects.find((e) => e.op === "replacePath");
  check("run6: Use the new path drops it", !use.path.includes(custom.id));
  check("run6: map passes are recorded as map, not parent", p.options.find((o) => o.id === "use").effects.filter((e) => e.op === "setVerdict").every((e) => e.by === "map"));
}

// --- Cards and merging ----------------------------------------------------------------------------------------
{
  const c0 = newReviewCard("m", DAY);
  check("card: new card is stage 0 due in two days", c0.stage === 0 && c0.nextAt === day(2));
  const c1 = bumpCard(c0, 1, 0, day(2));
  check("card: a clean review goes to stage 1, due in five", c1.stage === 1 && c1.nextAt === day(7));
  const c2 = bumpCard(c1, 0, 1, day(7));
  check("card: a miss drops a stage and comes back tomorrow", c2.stage === 0 && c2.nextAt === day(8) && c2.slips === 1);
  check("card: nothing pulled, nothing moves", bumpCard(c1, 0, 0, day(9)) === c1);
  check("card: dueReview sorts by date", (() => {
    const kid = { ...kidOf(emptyHouse(), "riley"), plan: { gate: "path", moduleStretch: {}, proposals: [], review: [{ ...c0, nextAt: day(1) }, { ...c0, moduleId: "b", nextAt: day(0) }] } };
    const due = dueReview(kid, day(1));
    return due.length === 2 && due[0].moduleId === "b";
  })());
  const older = { id: "p1", kidId: "riley", kind: "ease", at: "", why: "", evidence: {}, options: [], status: "pending" };
  const newer = { ...older, id: "p2" };
  const merged = mergeProposals([older], [newer]);
  check("merge: a newer proposal of the same kind replaces the pending one", merged.length === 1 && merged[0].id === "p2");
  check("merge: decided proposals are kept", mergeProposals([{ ...older, status: "accepted" }], [newer]).length === 2);
}

// --- Harder deals one card from the next module -------------------------------------------------------------
{
  const house = housed("hudson", "words", (band) => ["first-sounds", "letter-names", "letter-sounds", "short-vowels"].includes(band));
  const hudson = kidOf(house, "hudson");
  const active = activeModule(hudson, house);
  const next = queuedModules(hudson, house)[0];
  const hard = { ...hudson, plan: { ...planOf(hudson), moduleStretch: { [active.id]: "harder" } } };
  const s = buildSession(hard, house, DAY, 390);
  check("harder: one stretch card comes from the next queued module", Boolean(next) && s.entries.some((e) => e.moduleId === next.id), s.entries.map((e) => e.moduleId).join());
  check("harder: nothing but the active and next module is dealt", s.entries.every((e) => e.moduleId === active.id || e.moduleId === next.id));
  const std = buildSession(hudson, house, DAY, 390);
  check("standard: a closer is held back from a passed module", std.closers.length === 1 && std.closers[0].source === "close" && house.verdicts[`hudson:${std.closers[0].moduleId}`]?.verdict === "pass");
  check("standard on a phone is the trip length: five cards", std.entries.length === 5, String(std.entries.length));
  check("standard on a desktop is seven cards", buildSession(hudson, house, DAY, 1024).entries.length === 7);
  const day2 = play(house, "hudson", DAY).house;
  const s2 = buildSession(kidOf(day2, "hudson"), day2, day(1), 390);
  check("rotation: the second session deals cards the first did not", s2.entries.filter((e) => e.source === "stretch").some((e) => !std.entries.some((x) => x.item.id === e.item.id)));
  check("shorter on a narrow phone still five", buildSession({ ...hudson, sessionLength: "shorter" }, house, DAY, 360).entries.length === 5);
}

// --- proposeNextBand at the top of the ladder ---------------------------------------------------------------
{
  const house = housed("hudson", "words", () => true);
  const hudson = kidOf(house, "hudson");
  house.verdicts["hudson:rh-sentences"] = { verdict: "pass", by: "parent", at: "" };
  const p = proposeNextBand(hudson, house, now, "t");
  check("top: with every band passed the proposal offers a scout, not a module", p && p.options[0].effects[0].op === "requestScout");
}

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, detail] of checks) if (!ok || process.argv.includes("-v")) console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
if (failed.length) {
  console.error(`\n${failed.length} plan checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} plan checks passed.`);
