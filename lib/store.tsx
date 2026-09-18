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
import { emptyHouse, migrateHouse, withPath } from "./house";
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
import type {
  Attempt,
  Child,
  ChildStatus,
  DiagnosticReport,
  HouseState,
  ModuleDef,
  ModuleVerdict,
  PlacementShelf,
  ScoutReport,
  SessionLength,
  Stretch,
  ThemeId,
} from "./types";

const KEY = "reading-teacher-v2";

const empty: HouseState = emptyHouse();

/**
 * Read the house once. The migration chain in `lib/house.ts` runs per saved
 * version, so seeding a kid's path happens exactly once (v1 → v2) and a
 * later load never adds a module back that the parent or the map took off.
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

type HouseApi = {
  ready: boolean;
  state: HouseState;
  kid: (id: string) => Child | undefined;
  module: (id: string) => ModuleDef | undefined;
  pickTheme: (kidId: string, theme: ThemeId) => void;
  addStars: (kidId: string, n?: number) => void;
  recordAttempt: (attempt: Omit<Attempt, "id" | "at">) => Attempt;
  finishPlacement: (kidId: string, grade: PlacementShelf, note: string, kidLine: string, owned: string[]) => void;
  /** Record one diagnostic answer. When the map is complete, builds the path and returns the report. */
  answerDiagnostic: (kidId: string, probe: Probe, ok: boolean, ms: number, spoken?: SpokenAnswer) => { finished: boolean; report?: DiagnosticReport };
  restartDiagnostic: (kidId: string) => void;
  /** Parent picked a band on the Skills map: earlier bank modules pass, the path restarts there. */
  startPathAt: (kidId: string, bandId: string) => void;
  setPath: (kidId: string, path: string[]) => void;
  moveModule: (kidId: string, from: number, to: number) => void;
  /** With `bandId`, the module is built from that band's own item makers on the seeds (Practice these). */
  createAndAssign: (kidId: string, input: Parameters<typeof buildCustomModule>[0] & { bandId?: string }) => ModuleDef | undefined;
  setStretch: (kidId: string, stretch: Stretch) => void;
  setSession: (kidId: string, sessionLength: SessionLength) => void;
  setStatus: (kidId: string, status: ChildStatus) => void;
  setVerdict: (kidId: string, moduleId: string, verdict: ModuleVerdict) => void;
  gradeSpoken: (attemptId: string, spokenGrade: "hit" | "miss") => void;
  unlockWords: (kidId: string, unlock: boolean) => void;
  addChild: (name: string, birthday: string, status: ChildStatus) => void;
  saveScout: (report: ScoutReport) => void;
  resolveScout: (kidId: string, status: "approved" | "ignored", ease?: boolean) => void;
  markDailyDone: (kidId: string) => void;
  markScoutDone: (kidId: string) => void;
  applyFromSheet: (kidId: string, moduleId: string, action: "done" | "ease" | "harden" | "hold") => void;
  resetHouse: () => void;
};

const HouseContext = createContext<HouseApi | null>(null);

const noopSubscribe = () => () => {};

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
          themeDate: new Date().toISOString().slice(0, 10),
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
      finishPlacement: (kidId, grade, note, kidLine, owned) => {
        setState((s) => {
          const kid = s.kids.find((k) => k.id === kidId);
          if (!kid) return s;
          const path = pathForPlacement(grade, kid.track);
          const next = {
            ...s,
            kids: s.kids.map((k) =>
              k.id === kidId
                ? withPath({ ...k, placementGrade: grade, placementNote: note, kidLine, ownedBits: owned }, path)
                : k,
            ),
          };
          persistNow(next);
          return next;
        });
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
        const stamp = Date.now().toString(36);
        const { report, built } = finishDiagnostic(kidId, progress, stamp);
        const owned = report.bands.flatMap((b) => b.known.map((bit) => `${b.id}:${bit}`));
        setState((s) => {
          const modules = [...s.modules.filter((m) => !m.id.startsWith(`dx-${kidId}-`)), ...built.modules];
          const verdicts = { ...s.verdicts };
          for (const id of built.path) {
            if (verdicts[verdictKey(kidId, id)] === "pass") delete verdicts[verdictKey(kidId, id)];
          }
          for (const id of built.passed) verdicts[verdictKey(kidId, id)] = "pass";
          const next: HouseState = {
            ...s,
            modules,
            verdicts,
            kids: s.kids.map((k) =>
              k.id === kidId
                ? withPath(
                    {
                      ...k,
                      diagnostic: progress,
                      diagnosticReport: report,
                      placementGrade: report.shelf,
                      placementNote: report.note,
                      kidLine: report.kidLine,
                      ownedBits: owned,
                      // Letters track: the map's readiness rule is the source of truth. Words never close again.
                      readyForPrintWords: k.track === "letters" ? Boolean(report.readyForPrintWords) || k.parentUnlockedWords : k.readyForPrintWords,
                    },
                    built.path,
                  )
                : k,
            ),
          };
          persistNow(next);
          return next;
        });
        return { finished: true, report };
      },
      restartDiagnostic: (kidId) =>
        patchKid(kidId, (c) => ({
          ...c,
          diagnostic: undefined,
          diagnosticReport: undefined,
          placementGrade: undefined,
          placementNote: undefined,
          kidLine: undefined,
        })),
      startPathAt: (kidId, bandId) => {
        setState((s) => {
          const kid = s.kids.find((k) => k.id === kidId);
          if (!kid) return s;
          const reports = kid.diagnosticReport?.bands ?? [];
          const stamp = Date.now().toString(36);
          const plan = startHere(kidId, kid.track, reports, bandId, kid.path, stamp);
          if (!plan) return s;
          const verdicts = { ...s.verdicts };
          for (const id of plan.unpassed) {
            if (verdicts[verdictKey(kidId, id)] === "pass") delete verdicts[verdictKey(kidId, id)];
          }
          for (const id of plan.passed) verdicts[verdictKey(kidId, id)] = "pass";
          const keep = new Set(plan.path);
          const modules = [...s.modules.filter((m) => !(m.id.startsWith(`dx-${kidId}-`) && !keep.has(m.id))), ...plan.modules];
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
          ? buildBandModule(kidId, kid?.track ?? input.track, input.bandId, seedsToBits(input.seeds), Date.now().toString(36), input.title)
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
      setSession: (kidId, sessionLength) => patchKid(kidId, (c) => ({ ...c, sessionLength })),
      setStatus: (kidId, status) =>
        patchKid(kidId, (c) => {
          if (status === "active" && c.path.length === 0) {
            return withPath({ ...c, status }, pathForPlacement(undefined, c.track));
          }
          return { ...c, status };
        }),
      setVerdict: (kidId, moduleId, verdict) =>
        setState((s) => ({
          ...s,
          verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: verdict },
        })),
      gradeSpoken: (attemptId, spokenGrade) =>
        setState((s) => {
          const attempt = s.attempts.find((a) => a.id === attemptId);
          const attempts = s.attempts.map((a) => (a.id === attemptId ? { ...a, spokenGrade, correct: spokenGrade === "hit" } : a));
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
        patchKid(kidId, (c) => {
          if (unlock && !c.readyForPrintWords) return c;
          if (unlock) {
            return withPath({ ...c, parentUnlockedWords: true, track: "words" }, [...c.path.filter((id) => id !== "rh-cvc-smash"), "rh-cvc-smash"]);
          }
          return { ...c, parentUnlockedWords: false, track: "letters" };
        }),
      markDailyDone: (kidId) =>
        patchKid(kidId, (c) => ({
          ...c,
          dailySessions: (c.dailySessions ?? 0) + 1,
          lastDailyDate: new Date().toISOString().slice(0, 10),
        })),
      markScoutDone: (kidId) =>
        patchKid(kidId, (c) => ({
          ...c,
          lastScoutDate: new Date().toISOString().slice(0, 10),
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
      resolveScout: (kidId, status, ease) =>
        setState((s) => {
          const report = s.scouts.find((r) => r.kidId === kidId && r.status === "pending");
          if (!report) return s;
          if (status === "ignored") {
            return {
              ...s,
              scouts: s.scouts.map((r) => (r === report ? { ...r, status } : r)),
            };
          }
          const track = s.kids.find((k) => k.id === kidId)?.track === "letters" ? "letters" : "words";
          const created = report.drafts
            .map((d, i) => {
              const fromBand = d.bandId ? buildBandModule(kidId, track, d.bandId, d.bits ?? seedsToBits(d.seeds), `${Date.now().toString(36)}${i}`, d.title) : undefined;
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
          return {
            ...s,
            modules: [...s.modules, ...created],
            kids: s.kids.map((k) => (k.id === kidId ? withPath(k, [...k.path, ...created.map((m) => m.id)]) : k)),
            scouts: s.scouts.map((r) => (r === report ? { ...r, status } : r)),
          };
        }),
      applyFromSheet: (kidId, moduleId, action) => {
        if (action === "done") {
          setState((s) => ({ ...s, verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: "pass" } }));
          return;
        }
        if (action === "hold") {
          patchKid(kidId, (c) => withPath(c, c.path.filter((id) => id !== moduleId)));
          return;
        }
        if (action === "ease") {
          patchKid(kidId, (c) => ({ ...c, stretch: "easier" }));
          setState((s) => ({ ...s, verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: "fail" } }));
          return;
        }
        patchKid(kidId, (c) => ({ ...c, stretch: "harder" }));
      },
      addChild: (name, birthday, status) => {
        const id = name.toLowerCase().replace(/[^a-z]+/g, "") || `kid-${Date.now()}`;
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
        };
        setState((s) => ({ ...s, kids: [...s.kids, child] }));
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
