"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ageFromBirthday, buildCustomModule, pathForPlacement } from "./catalog";
import { localDay } from "./clock";
import { emptyHouse, migrateHouse, planOf, withPath } from "./house";
import {
  answerProbe,
  buildBandModule,
  finishDiagnostic,
  refreshReport,
  regradeRow,
  seedsToBits,
  startDiagnostic,
  startHere,
  type Probe,
  type SpokenAnswer,
} from "./diagnostic";
import { verdictKey } from "./grades";
import { activeModule, afterSession, applyProposal, proposeMapPath, snoozeProposal, withReviewCard, withoutReviewCard } from "./plan";
import type {
  Attempt,
  Child,
  ChildStatus,
  DiagnosticReport,
  HouseState,
  ModuleDef,
  ModuleVerdict,
  ScoutReport,
  SessionLength,
  SessionLog,
  Stretch,
  ThemeId,
  VerdictRecord,
} from "./types";

const KEY = "reading-teacher-v2";

const empty: HouseState = emptyHouse();

/**
 * Read the house once. The migration chain in `lib/house.ts` runs per saved
 * version, so seeding a kid's path happens exactly once (v1 → v2), verdicts
 * gain their provenance once (v2 → v3), and a later load never adds a module
 * back that the parent or the map took off.
 */
function load(): HouseState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyHouse();
    return migrateHouse(JSON.parse(raw)) ?? emptyHouse();
  } catch {
    return emptyHouse();
  }
}

/** Serialize the whole house for a copy to another device. */
export function exportHouse(state: HouseState): string {
  return JSON.stringify(state);
}

type HouseApi = {
  ready: boolean;
  state: HouseState;
  kid: (id: string) => Child | undefined;
  module: (id: string) => ModuleDef | undefined;
  pickTheme: (kidId: string, theme: ThemeId) => void;
  addStars: (kidId: string, n?: number) => void;
  recordAttempt: (attempt: Omit<Attempt, "id" | "at">) => Attempt;
  /** Record one diagnostic answer. When the map is complete, builds the path (first map) or proposes it (re-map) and returns the report. */
  answerDiagnostic: (kidId: string, probe: Probe, ok: boolean, ms: number, spoken?: SpokenAnswer) => { finished: boolean; report?: DiagnosticReport };
  /** Finish a map whose probes are all answered but no report was written (a guard against a stuck record). */
  completeDiagnostic: (kidId: string) => void;
  /** Parent asked for a new map. The old report and path stay until it finishes; dailies keep going. */
  requestMap: (kidId: string) => void;
  /** Parent picked a band on the Skills map: earlier bank modules pass, the path restarts there. */
  startPathAt: (kidId: string, bandId: string) => void;
  setPath: (kidId: string, path: string[]) => void;
  moveModule: (kidId: string, from: number, to: number) => void;
  /** With `bandId`, the module is built from that band's own item makers on the seeds (Practice these). */
  createAndAssign: (kidId: string, input: Parameters<typeof buildCustomModule>[0] & { bandId?: string }) => ModuleDef | undefined;
  setStretch: (kidId: string, stretch: Stretch) => void;
  setModuleStretch: (kidId: string, moduleId: string, stretch: Stretch | undefined) => void;
  setSession: (kidId: string, sessionLength: SessionLength) => void;
  setGate: (kidId: string, gate: "path" | "each") => void;
  setStatus: (kidId: string, status: ChildStatus) => void;
  setVerdict: (kidId: string, moduleId: string, verdict: ModuleVerdict) => void;
  gradeSpoken: (attemptId: string, spokenGrade: "hit" | "miss") => void;
  unlockWords: (kidId: string, unlock: boolean) => void;
  addChild: (name: string, birthday: string, status: ChildStatus) => void;
  saveScout: (report: ScoutReport) => void;
  resolveScout: (kidId: string, status: "approved" | "ignored", opts?: { ease?: boolean; where?: "next" | "later" }) => void;
  /** The kid door finished a sitting. Cards move, counters tick, verdicts and proposals follow. */
  endSession: (log: Omit<SessionLog, "id" | "day" | "lateWins">) => void;
  /** The parent tapped one option on a proposal, or put it off. */
  decideProposal: (kidId: string, proposalId: string, choice: { option: string } | "later" | "dismiss") => void;
  applyFromSheet: (kidId: string, moduleId: string, action: "done" | "ease" | "harden" | "hold") => void;
  importHouse: (raw: string) => boolean;
  resetHouse: () => void;
};

const HouseContext = createContext<HouseApi | null>(null);

const noopSubscribe = () => () => {};

const stamp = () => Date.now().toString(36);

export function HouseProvider({ children }: { children: React.ReactNode }) {
  // The server (and the hydration pass) render the empty house behind a
  // loading screen; the first client render after hydration flips `ready` and
  // shows the house that the lazy initializer already read from localStorage.
  const [state, setState] = useState<HouseState>(load);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
  }, [ready, state]);

  const persistNow = (next: HouseState) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  const patchKid = useCallback((kidId: string, fn: (c: Child) => Child) => {
    setState((s) => ({
      ...s,
      kids: s.kids.map((k) => (k.id === kidId ? fn(k) : k)),
    }));
  }, []);

  const api = useMemo<HouseApi>(
    () => ({
      ready,
      state,
      kid: (id) => state.kids.find((k) => k.id === id),
      module: (id) => state.modules.find((m) => m.id === id),
      pickTheme: (kidId, theme) =>
        patchKid(kidId, (c) => ({
          ...c,
          themeToday: theme,
          themeDate: localDay(),
        })),
      addStars: (kidId, n = 1) => patchKid(kidId, (c) => ({ ...c, stars: c.stars + n })),
      recordAttempt: (attempt) => {
        const row: Attempt = {
          ...attempt,
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: new Date().toISOString(),
        };
        setState((s) => ({ ...s, attempts: [...s.attempts, row] }));
        return row;
      },
      answerDiagnostic: (kidId, probe, ok, ms, spoken) => {
        const kid = state.kids.find((k) => k.id === kidId);
        if (!kid) return { finished: false };
        const progress = answerProbe(kid.diagnostic ?? startDiagnostic(kid.track), probe, ok, ms, new Date(), spoken);
        if (progress.cursor) {
          setState((s) => {
            const next = { ...s, kids: s.kids.map((k) => (k.id === kidId ? { ...k, diagnostic: progress } : k)) };
            persistNow(next);
            return next;
          });
          return { finished: false };
        }
        const { report, built } = finishDiagnostic(kidId, progress, stamp());
        const owned = report.bands.flatMap((b) => b.known.map((bit) => `${b.id}:${bit}`));
        const now = new Date();
        setState((s) => {
          const current = s.kids.find((k) => k.id === kidId);
          if (!current) return s;
          const remap = Boolean(current.diagnosticReport);
          const modules = [...s.modules.filter((m) => !built.modules.some((b) => b.id === m.id)), ...built.modules];
          const verdicts = { ...s.verdicts };
          const patched: Child = {
            ...current,
            diagnostic: progress,
            diagnosticReport: report,
            placementGrade: report.shelf,
            placementNote: report.note,
            kidLine: report.kidLine,
            ownedBits: owned,
            // Letters track: the map's readiness rule is the source of truth. Words never close again.
            readyForPrintWords: current.track === "letters" ? Boolean(report.readyForPrintWords) || current.parentUnlockedWords : current.readyForPrintWords,
            plan: { ...planOf(current), mapRequested: false },
          };
          let kidNext: Child;
          if (remap) {
            // The path belongs to the parent: the rebuild is proposed, not applied.
            const plan = planOf(patched);
            kidNext = { ...patched, plan: { ...plan, proposals: [...plan.proposals.filter((p) => !(p.kind === "map-path" && p.status === "pending")), proposeMapPath(patched, built, now)] } };
          } else {
            for (const id of built.path) {
              if (verdicts[verdictKey(kidId, id)]?.verdict === "pass" && verdicts[verdictKey(kidId, id)].by !== "parent") delete verdicts[verdictKey(kidId, id)];
            }
            for (const id of built.passed) {
              if (verdicts[verdictKey(kidId, id)]?.by !== "parent") verdicts[verdictKey(kidId, id)] = { verdict: "pass", by: "map", at: now.toISOString() };
            }
            kidNext = withPath(patched, built.path);
          }
          const next: HouseState = {
            ...s,
            modules,
            verdicts,
            kids: s.kids.map((k) => (k.id === kidId ? kidNext : k)),
          };
          persistNow(next);
          return next;
        });
        return { finished: true, report };
      },
      completeDiagnostic: (kidId) => {
        const kid = state.kids.find((k) => k.id === kidId);
        if (!kid?.diagnostic || kid.diagnostic.cursor || kid.diagnosticReport) return;
        const { report, built } = finishDiagnostic(kidId, kid.diagnostic, stamp());
        setState((s) => {
          const verdicts = { ...s.verdicts };
          for (const id of built.passed) verdicts[verdictKey(kidId, id)] = { verdict: "pass", by: "map", at: new Date().toISOString() };
          return {
            ...s,
            modules: [...s.modules, ...built.modules.filter((m) => !s.modules.some((x) => x.id === m.id))],
            verdicts,
            kids: s.kids.map((k) =>
              k.id === kidId ? withPath({ ...k, diagnosticReport: report, placementGrade: report.shelf, placementNote: report.note, kidLine: report.kidLine }, built.path) : k,
            ),
          };
        });
      },
      requestMap: (kidId) =>
        patchKid(kidId, (c) => ({
          ...c,
          diagnostic: startDiagnostic(c.track),
          plan: { ...planOf(c), mapRequested: true },
        })),
      startPathAt: (kidId, bandId) => {
        setState((s) => {
          const kid = s.kids.find((k) => k.id === kidId);
          if (!kid) return s;
          const reports = kid.diagnosticReport?.bands ?? [];
          const plan = startHere(kidId, kid.track, reports, bandId, kid.path, stamp());
          if (!plan) return s;
          const verdicts = { ...s.verdicts };
          const at = new Date().toISOString();
          for (const id of plan.unpassed) {
            if (verdicts[verdictKey(kidId, id)]?.verdict === "pass" && verdicts[verdictKey(kidId, id)].by !== "parent") delete verdicts[verdictKey(kidId, id)];
          }
          for (const id of plan.passed) {
            if (verdicts[verdictKey(kidId, id)]?.by !== "parent") verdicts[verdictKey(kidId, id)] = { verdict: "pass", by: "start-here", at };
          }
          const keep = new Set(plan.path);
          const modules = [...s.modules.filter((m) => !(m.id.startsWith(`dx-${kidId}-`) && !keep.has(m.id) && !s.attempts.some((a) => a.moduleId === m.id))), ...plan.modules];
          const next: HouseState = {
            ...s,
            modules,
            verdicts,
            kids: s.kids.map((k) => (k.id === kidId ? withPath(k, plan.path) : k)),
          };
          persistNow(next);
          return next;
        });
      },
      setPath: (kidId, path) => patchKid(kidId, (c) => withPath(c, path)),
      moveModule: (kidId, from, to) =>
        patchKid(kidId, (c) => {
          const path = [...c.path];
          const [item] = path.splice(from, 1);
          if (!item) return c;
          path.splice(to, 0, item);
          return { ...c, path };
        }),
      createAndAssign: (kidId, input) => {
        const kid = state.kids.find((k) => k.id === kidId);
        const mod = input.bandId
          ? buildBandModule(kidId, kid?.track ?? input.track, input.bandId, seedsToBits(input.seeds), stamp(), input.title)
          : buildCustomModule(input);
        if (!mod) return undefined;
        setState((s) => ({
          ...s,
          modules: [...s.modules, mod],
          kids: s.kids.map((k) => (k.id === kidId ? withPath(k, [...k.path, mod.id]) : k)),
        }));
        return mod;
      },
      setStretch: (kidId, stretch) => patchKid(kidId, (c) => ({ ...c, stretch })),
      setModuleStretch: (kidId, moduleId, stretch) =>
        patchKid(kidId, (c) => {
          const plan = planOf(c);
          const moduleStretch = { ...plan.moduleStretch };
          if (stretch) moduleStretch[moduleId] = stretch;
          else delete moduleStretch[moduleId];
          return { ...c, plan: { ...plan, moduleStretch } };
        }),
      setSession: (kidId, sessionLength) => patchKid(kidId, (c) => ({ ...c, sessionLength })),
      setGate: (kidId, gate) => patchKid(kidId, (c) => ({ ...c, plan: { ...planOf(c), gate } })),
      setStatus: (kidId, status) =>
        patchKid(kidId, (c) => {
          if (status === "active" && c.path.length === 0) {
            return withPath({ ...c, status }, pathForPlacement(undefined, c.track));
          }
          return { ...c, status };
        }),
      setVerdict: (kidId, moduleId, verdict) =>
        setState((s) => {
          const verdicts = { ...s.verdicts };
          const key = verdictKey(kidId, moduleId);
          if (verdict === "open") delete verdicts[key];
          else verdicts[key] = { verdict, by: "parent", at: new Date().toISOString() };
          const today = localDay();
          return {
            ...s,
            verdicts,
            kids: s.kids.map((k) => (k.id === kidId ? (verdict === "pass" ? withReviewCard(k, moduleId, today) : withoutReviewCard(k, moduleId)) : k)),
          };
        }),
      gradeSpoken: (attemptId, spokenGrade) =>
        setState((s) => {
          const attempt = s.attempts.find((a) => a.id === attemptId);
          const gradedAt = new Date().toISOString();
          const attempts = s.attempts.map((a) => (a.id === attemptId ? { ...a, spokenGrade, correct: spokenGrade === "hit", gradedAt } : a));
          if (!attempt || attempt.source !== "placement") return { ...s, attempts };
          // A graded placement answer flows back into the map. The path stays as the parent left it.
          return {
            ...s,
            attempts,
            kids: s.kids.map((k) => {
              if (k.id !== attempt.kidId || !k.diagnostic) return k;
              const diagnostic = regradeRow(k.diagnostic, attempt.itemId, spokenGrade === "hit");
              if (diagnostic === k.diagnostic) return k;
              const diagnosticReport = k.diagnosticReport ? refreshReport(k.diagnosticReport, diagnostic) : undefined;
              return {
                ...k,
                diagnostic,
                diagnosticReport,
                placementGrade: diagnosticReport?.shelf ?? k.placementGrade,
                placementNote: diagnosticReport?.note ?? k.placementNote,
                readyForPrintWords: k.track === "letters" ? k.readyForPrintWords || Boolean(diagnosticReport?.readyForPrintWords) : k.readyForPrintWords,
              };
            }),
          };
        }),
      unlockWords: (kidId, unlock) =>
        setState((s) => ({
          ...s,
          kids: s.kids.map((c) => {
            if (c.id !== kidId) return c;
            if (unlock && !c.readyForPrintWords) return c;
            if (unlock) {
              return withPath({ ...c, parentUnlockedWords: true, track: "words" }, [...c.path.filter((id) => id !== "rh-cvc-smash"), "rh-cvc-smash"]);
            }
            // Back to letters: word modules leave the path (held), so the kid never meets one.
            const wordIds = new Set(s.modules.filter((m) => m.track === "words").map((m) => m.id));
            return withPath({ ...c, parentUnlockedWords: false, track: "letters" }, c.path.filter((id) => !wordIds.has(id)));
          }),
        })),
      saveScout: (report) =>
        setState((s) => ({
          ...s,
          scouts: [...s.scouts.filter((r) => r.kidId !== report.kidId), report],
          // A scout that says "ready" raises the flag; it never lowers it and never touches the path.
          kids: s.kids.map((k) =>
            k.id === report.kidId && k.track === "letters" && report.readyForPrintWords ? { ...k, readyForPrintWords: true } : k,
          ),
        })),
      resolveScout: (kidId, status, opts) =>
        setState((s) => {
          const report = s.scouts.find((r) => r.kidId === kidId && r.status === "pending");
          if (!report) return s;
          if (status === "ignored") {
            return {
              ...s,
              scouts: s.scouts.map((r) => (r === report ? { ...r, status } : r)),
            };
          }
          const kid = s.kids.find((k) => k.id === kidId);
          const track = kid?.track === "letters" ? "letters" : "words";
          const ease = opts?.ease;
          const created = report.drafts
            .map((d, i) => {
              const fromBand = d.bandId ? buildBandModule(kidId, track, d.bandId, d.bits ?? seedsToBits(d.seeds), `${stamp()}${i}`, d.title) : undefined;
              const mod =
                fromBand ??
                buildCustomModule({
                  title: d.title,
                  skill: d.skill,
                  seeds: d.seeds,
                  stretch: ease ? "easier" : d.stretch,
                  track,
                });
              return ease ? { ...mod, stretch: "easier" as const } : mod;
            })
            .filter(Boolean) as ModuleDef[];
          const ids = created.map((m) => m.id);
          return {
            ...s,
            modules: [...s.modules, ...created],
            kids: s.kids.map((k) => {
              if (k.id !== kidId) return k;
              if (opts?.where === "later") return withPath(k, [...k.path, ...ids]);
              // Approved drafts are the next daily: right after the module the kid is on.
              const active = activeModule(k, s);
              const idx = active ? k.path.indexOf(active.id) + 1 : 0;
              return withPath(k, [...k.path.slice(0, idx), ...ids, ...k.path.slice(idx)]);
            }),
            scouts: s.scouts.map((r) => (r === report ? { ...r, status } : r)),
          };
        }),
      endSession: (partial) =>
        setState((s) => {
          const kid = s.kids.find((k) => k.id === partial.kidId);
          if (!kid) return s;
          const now = new Date();
          const previous = s.sessions.filter((x) => x.kidId === kid.id).at(-1);
          // Spoken tries the parent graded as hits since the last sitting: real wins, celebrated late.
          const lateWins = s.attempts.filter(
            (a) => a.kidId === kid.id && a.spokenGrade === "hit" && a.gradedAt && a.gradedAt > (previous?.endedAt ?? "") && a.source !== "placement",
          ).length;
          const log: SessionLog = { ...partial, id: `ses-${Date.now().toString(36)}`, day: localDay(now), lateWins };
          const sessions = [...s.sessions, log];
          const result = afterSession(kid, { ...s, sessions }, log, now);
          const next: HouseState = {
            ...s,
            sessions,
            verdicts: result.verdicts,
            kids: s.kids.map((k) => (k.id === kid.id ? { ...result.kid, stars: result.kid.stars + lateWins } : k)),
          };
          persistNow(next);
          return next;
        }),
      decideProposal: (kidId, proposalId, choice) =>
        setState((s) => {
          const now = new Date();
          if (choice === "later" || choice === "dismiss") {
            return { ...s, kids: s.kids.map((k) => (k.id === kidId ? snoozeProposal(k, proposalId, choice === "later" ? "later" : "dismissed", now) : k)) };
          }
          const next = applyProposal(s, kidId, proposalId, choice.option, now, localDay(now));
          persistNow(next);
          return next;
        }),
      applyFromSheet: (kidId, moduleId, action) => {
        const now = new Date();
        const today = localDay(now);
        if (action === "done") {
          setState((s) => ({
            ...s,
            verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: { verdict: "pass", by: "parent", at: now.toISOString() } },
            kids: s.kids.map((k) => (k.id === kidId ? withReviewCard(k, moduleId, today) : k)),
          }));
          return;
        }
        if (action === "hold") {
          patchKid(kidId, (c) => withPath(c, c.path.filter((id) => id !== moduleId)));
          return;
        }
        // Ease and Harden change how this one module is dealt. Neither is a verdict.
        patchKid(kidId, (c) => {
          const plan = planOf(c);
          return { ...c, plan: { ...plan, moduleStretch: { ...plan.moduleStretch, [moduleId]: action === "ease" ? "easier" : "harder" } } };
        });
      },
      addChild: (name, birthday, status) => {
        const base = name.toLowerCase().replace(/[^a-z]+/g, "") || `kid-${Date.now()}`;
        const taken = new Set(state.kids.map((k) => k.id));
        let id = base;
        for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
        const age = ageFromBirthday(birthday);
        const track = age <= 3 ? "letters" : "words";
        const child: Child = {
          id,
          name: name.trim() || "New kid",
          birthday,
          status,
          track,
          stars: 0,
          path: status === "waiting" ? [] : pathForPlacement(undefined, track),
          held: [],
          stretch: "stretch-hard",
          sessionLength: "standard",
          readyForPrintWords: track === "words",
          parentUnlockedWords: track === "words",
          dailySessions: 0,
          plan: { gate: "path", moduleStretch: {}, review: [], proposals: [] },
        };
        setState((s) => ({ ...s, kids: [...s.kids, child] }));
      },
      importHouse: (raw) => {
        try {
          const next = migrateHouse(JSON.parse(raw));
          if (!next) return false;
          persistNow(next);
          setState(next);
          return true;
        } catch {
          return false;
        }
      },
      resetHouse: () => {
        window.localStorage.removeItem(KEY);
        setState(emptyHouse());
      },
    }),
    [patchKid, ready, state],
  );

  return <HouseContext.Provider value={api}>{children}</HouseContext.Provider>;
}

export function useHouse() {
  const ctx = useContext(HouseContext);
  if (!ctx) throw new Error("useHouse needs HouseProvider");
  return ctx;
}

export type { VerdictRecord };
