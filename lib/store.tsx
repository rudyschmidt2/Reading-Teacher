"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  STARTER_KIDS,
  STARTER_MODULES,
  ageFromBirthday,
  buildCustomModule,
  pathForPlacement,
} from "./catalog";
import { verdictKey } from "./grades";
import type {
  Attempt,
  Child,
  ChildStatus,
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

const empty: HouseState = {
  version: 1,
  kids: STARTER_KIDS,
  modules: STARTER_MODULES,
  attempts: [],
  verdicts: {},
  scouts: [],
};

function load(): HouseState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(empty);
    const parsed = JSON.parse(raw) as HouseState;
    if (parsed.version !== 1 || !Array.isArray(parsed.kids)) return structuredClone(empty);
    const known = new Set(parsed.modules.map((m) => m.id));
    const extras = STARTER_MODULES.filter((m) => !known.has(m.id));
    return {
      ...parsed,
      modules: [...parsed.modules, ...extras],
      kids: parsed.kids.map((k) => {
        const starter = STARTER_KIDS.find((s) => s.id === k.id);
        const have = new Set(k.path ?? []);
        const extraPath = (starter?.path ?? []).filter((id) => !have.has(id));
        return {
          ...starter,
          ...k,
          name: k.id === "myles" ? "Myles" : k.name,
          path: [...(k.path ?? starter?.path ?? []), ...extraPath],
        };
      }),
      scouts: parsed.scouts ?? [],
    };
  } catch {
    return structuredClone(empty);
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
  setPath: (kidId: string, path: string[]) => void;
  moveModule: (kidId: string, from: number, to: number) => void;
  createAndAssign: (kidId: string, input: Parameters<typeof buildCustomModule>[0]) => ModuleDef;
  setStretch: (kidId: string, stretch: Stretch) => void;
  setSession: (kidId: string, sessionLength: SessionLength) => void;
  setStatus: (kidId: string, status: ChildStatus) => void;
  setVerdict: (kidId: string, moduleId: string, verdict: ModuleVerdict) => void;
  gradeSpoken: (attemptId: string, spokenGrade: "hit" | "miss") => void;
  setReadyForPrintWords: (kidId: string, ready: boolean) => void;
  unlockWords: (kidId: string, unlock: boolean) => void;
  addChild: (name: string, birthday: string, status: ChildStatus) => void;
  saveScout: (report: ScoutReport) => void;
  resolveScout: (kidId: string, status: "approved" | "ignored", ease?: boolean) => void;
  applyFromSheet: (kidId: string, moduleId: string, action: "done" | "ease" | "harden" | "hold") => void;
  resetHouse: () => void;
};

const HouseContext = createContext<HouseApi | null>(null);

export function HouseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HouseState>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

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
                ? { ...k, placementGrade: grade, placementNote: note, kidLine, ownedBits: owned, path }
                : k,
            ),
          };
          persistNow(next);
          return next;
        });
      },
      setPath: (kidId, path) => patchKid(kidId, (c) => ({ ...c, path })),
      moveModule: (kidId, from, to) =>
        patchKid(kidId, (c) => {
          const path = [...c.path];
          const [item] = path.splice(from, 1);
          if (!item) return c;
          path.splice(to, 0, item);
          return { ...c, path };
        }),
      createAndAssign: (kidId, input) => {
        const mod = buildCustomModule(input);
        setState((s) => ({
          ...s,
          modules: [...s.modules, mod],
          kids: s.kids.map((k) => (k.id === kidId ? { ...k, path: [...k.path, mod.id] } : k)),
        }));
        return mod;
      },
      setStretch: (kidId, stretch) => patchKid(kidId, (c) => ({ ...c, stretch })),
      setSession: (kidId, sessionLength) => patchKid(kidId, (c) => ({ ...c, sessionLength })),
      setStatus: (kidId, status) =>
        patchKid(kidId, (c) => {
          if (status === "active" && c.path.length === 0) {
            return { ...c, status, path: pathForPlacement(undefined, c.track) };
          }
          return { ...c, status };
        }),
      setVerdict: (kidId, moduleId, verdict) =>
        setState((s) => ({
          ...s,
          verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: verdict },
        })),
      gradeSpoken: (attemptId, spokenGrade) =>
        setState((s) => ({
          ...s,
          attempts: s.attempts.map((a) => (a.id === attemptId ? { ...a, spokenGrade } : a)),
        })),
      setReadyForPrintWords: (kidId, readyFlag) =>
        patchKid(kidId, (c) => ({ ...c, readyForPrintWords: readyFlag })),
      unlockWords: (kidId, unlock) =>
        patchKid(kidId, (c) => {
          if (unlock && !c.readyForPrintWords) return c;
          if (unlock) {
            return {
              ...c,
              parentUnlockedWords: true,
              track: "words",
              path: [...c.path.filter((id) => id !== "rh-cvc-smash"), "rh-cvc-smash"],
            };
          }
          return { ...c, parentUnlockedWords: false, track: "letters" };
        }),
      saveScout: (report) =>
        setState((s) => ({
          ...s,
          scouts: [...s.scouts.filter((r) => r.kidId !== report.kidId), report],
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
          const created = report.drafts.map((d) =>
            buildCustomModule({
              title: d.title,
              skill: d.skill,
              seeds: d.seeds,
              stretch: ease ? "easier" : d.stretch,
              track: s.kids.find((k) => k.id === kidId)?.track === "letters" ? "letters" : "words",
            }),
          );
          return {
            ...s,
            modules: [...s.modules, ...created],
            kids: s.kids.map((k) => (k.id === kidId ? { ...k, path: [...k.path, ...created.map((m) => m.id)] } : k)),
            scouts: s.scouts.map((r) => (r === report ? { ...r, status } : r)),
          };
        }),
      applyFromSheet: (kidId, moduleId, action) => {
        if (action === "done") {
          setState((s) => ({ ...s, verdicts: { ...s.verdicts, [verdictKey(kidId, moduleId)]: "pass" } }));
          return;
        }
        if (action === "hold") {
          patchKid(kidId, (c) => ({ ...c, path: c.path.filter((id) => id !== moduleId) }));
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
          stretch: "stretch-hard",
          sessionLength: "standard",
          readyForPrintWords: track === "words",
          parentUnlockedWords: track === "words",
        };
        setState((s) => ({ ...s, kids: [...s.kids, child] }));
      },
      resetHouse: () => {
        window.localStorage.removeItem(KEY);
        setState(structuredClone(empty));
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
