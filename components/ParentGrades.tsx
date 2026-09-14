"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ageFromBirthday } from "@/lib/catalog";
import {
  MODULE_STATUS_LABEL,
  moduleFunctionGrades,
  moduleProgress,
  verdictKey,
  type FunctionGrade,
  type ModuleKidStatus,
  type ModuleProgress,
} from "@/lib/grades";
import { useHouse } from "@/lib/store";
import type { Child, ModuleDef, ModuleVerdict } from "@/lib/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  CompassIcon,
  LockIcon,
  MicIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "@/components/Icons";

const AVATAR: [string, string][] = [
  ["#f59e0b", "#ec4899"],
  ["#22d3ee", "#6366f1"],
  ["#a3e635", "#059669"],
  ["#c084fc", "#7c3aed"],
  ["#fb7185", "#f97316"],
];

function avatarFor(idx: number) {
  return AVATAR[idx % AVATAR.length];
}

function statusBadge(status: ModuleKidStatus) {
  if (status === "passed") return "badge badge--good";
  if (status === "failed") return "badge badge--bad";
  if (status === "struggle-stop") return "badge badge--warn";
  if (status === "in-progress") return "badge badge--info";
  return "badge badge--muted";
}

function sheetBadge(status: ModuleKidStatus) {
  if (status === "passed") return "grade-pill grade-pill--pass";
  if (status === "failed") return "grade-pill grade-pill--fail";
  if (status === "struggle-stop") return "grade-pill grade-pill--stop";
  if (status === "in-progress") return "grade-pill grade-pill--live";
  return "grade-pill";
}

function when(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Avatar({ child, idx, size = "h-7 w-7 text-xs" }: { child: Child; idx: number; size?: string }) {
  const [a, b] = avatarFor(idx);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-black text-white ${size}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {child.name.slice(0, 1)}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */

export function ParentGrades() {
  return (
    <Suspense fallback={<Loading />}>
      <GradesInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="parent-desk flex min-h-dvh items-center justify-center p-6">
      <p className="chip px-4 py-2 text-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
        Loading grades…
      </p>
    </main>
  );
}

function GradesInner() {
  const { state, ready } = useHouse();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("module");
  const kidParam = params.get("kid");
  const [filter, setFilter] = useState<string | null>(kidParam && state.kids.some((k) => k.id === kidParam) ? kidParam : null);
  const openedHere = useRef(false);

  const kids = state.kids;
  const shown = filter ? kids.filter((k) => k.id === filter) : kids;
  const openModule = openId ? state.modules.find((m) => m.id === openId) : undefined;

  const groups = useMemo(() => {
    const letters = state.modules.filter((m) => m.track === "letters");
    const words = state.modules.filter((m) => m.track === "words");
    return [
      { id: "words", title: "Phonics words", sub: "Riley and Hudson’s ladder. Myles after unlock.", modules: words },
      { id: "letters", title: "Letters and sounds", sub: "Myles’ ladder. Names, sounds, find it, trace.", modules: letters },
    ].filter((g) => g.modules.length);
  }, [state.modules]);

  const open = useCallback(
    (id: string) => {
      openedHere.current = true;
      const q = new URLSearchParams();
      q.set("module", id);
      if (filter) q.set("kid", filter);
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [filter, pathname, router],
  );

  const close = useCallback(() => {
    const restore = openId;
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      const q = new URLSearchParams();
      if (filter) q.set("kid", filter);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    if (restore) window.setTimeout(() => document.getElementById(`module-card-${restore}`)?.focus(), 50);
  }, [filter, openId, pathname, router]);

  if (!ready) return <Loading />;

  return (
    <main className="parent-desk px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="orb h-12 w-12 text-white" style={{ ["--orb-a" as string]: "#34d399", ["--orb-b" as string]: "#059669" }}>
              <CompassIcon size={24} />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">Parent door</p>
              <h1 className="text-2xl font-black text-white sm:text-3xl">Grading</h1>
            </div>
          </div>
          <Link href="/parent" className="chip min-h-11 px-3 py-2 text-sm">
            <ArrowLeftIcon size={14} />
            Desk
          </Link>
        </header>
        <p className="mt-2 text-sm text-slate-400">Every module, every function, every kid. Real numbers only. Tap a module for the full sheet.</p>

        <KidStrip kids={kids} filter={filter} onPick={setFilter} />

        {groups.map((g) => (
          <section key={g.id} className="mt-6" aria-labelledby={`group-${g.id}`}>
            <h2 id={`group-${g.id}`} className="text-lg font-black text-white">
              {g.title}
            </h2>
            <p className="text-xs text-slate-500">{g.sub}</p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {g.modules.map((m) => (
                <li key={m.id}>
                  <ModuleCard module={m} kids={shown} onOpen={open} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {openModule ? <GradeSheet module={openModule} kids={shown} onClose={close} /> : null}
    </main>
  );
}

/* ---------------------------------------------------------------------------
   Kid strip
--------------------------------------------------------------------------- */

function KidStrip({ kids, filter, onPick }: { kids: Child[]; filter: string | null; onPick: (id: string | null) => void }) {
  const { state } = useHouse();
  return (
    <div className="no-scrollbar -mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter by child">
      <button
        type="button"
        aria-pressed={filter === null}
        onClick={() => onPick(null)}
        className={`chip min-h-14 shrink-0 px-4 text-sm ${filter === null ? "chip--on" : ""}`}
      >
        All kids
      </button>
      {kids.map((k, idx) => {
        const on = filter === k.id;
        let sub: string;
        if (k.status === "waiting") sub = "waiting";
        else {
          const passed = k.path.filter((id) => state.verdicts[verdictKey(k.id, id)] === "pass").length;
          sub = k.path.length ? `${passed}/${k.path.length} passed` : "no path yet";
        }
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : k.id)}
            className={`chip min-h-14 shrink-0 gap-2.5 py-1.5 pl-1.5 pr-4 text-sm ${on ? "chip--on" : ""}`}
          >
            <Avatar child={k} idx={idx} size="h-9 w-9 text-sm" />
            <span className="text-left leading-tight">
              <span className="flex items-center gap-1 font-black">
                {k.name}
                {k.status === "waiting" ? <LockIcon size={11} className="opacity-70" /> : null}
                <span className="font-bold opacity-60">{ageFromBirthday(k.birthday)}</span>
              </span>
              <span className="block text-[11px] font-bold opacity-70">{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Module card
--------------------------------------------------------------------------- */

function ModuleCard({ module, kids, onOpen }: { module: ModuleDef; kids: Child[]; onOpen: (id: string) => void }) {
  const { state } = useHouse();
  return (
    <button
      type="button"
      id={`module-card-${module.id}`}
      onClick={() => onOpen(module.id)}
      aria-haspopup="dialog"
      className="desk-card group flex min-h-[88px] w-full items-stretch gap-3 p-4 text-left transition hover:bg-white/[0.08] active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-black text-white">{module.title}</span>
          {module.custom ? <span className="badge badge--info">custom</span> : null}
          {module.id.startsWith("dx-") ? <span className="badge badge--info">from map</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-slate-400">{module.skill}</span>
        <span className="mt-3 grid gap-1.5">
          {kids.map((k) => {
            const idx = Math.max(0, state.kids.findIndex((x) => x.id === k.id));
            const p = moduleProgress(k, module, state.attempts, state.verdicts[verdictKey(k.id, module.id)]);
            return (
              <span key={k.id} className="flex items-center gap-2">
                <Avatar child={k} idx={idx} size="h-6 w-6 text-[10px]" />
                <span className="w-16 shrink-0 truncate text-sm font-bold text-slate-200">{k.name}</span>
                <span className={`${statusBadge(p.status)} shrink-0`}>{MODULE_STATUS_LABEL[p.status]}</span>
                {p.status === "waiting" ? (
                  <span className="stat-bar flex-1 opacity-40" aria-hidden />
                ) : (
                  <span className="stat-bar flex-1" role="img" aria-label={`${p.itemsHit} of ${p.items} items hit`}>
                    <span style={{ width: `${p.pct}%` }} />
                  </span>
                )}
                <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-400">
                  {p.status === "waiting" ? "—" : `${p.pct}%`}
                </span>
              </span>
            );
          })}
        </span>
      </span>
      <span className="grid w-9 shrink-0 place-items-center self-center rounded-full bg-emerald-500/15 text-emerald-200 transition group-hover:bg-emerald-500/25">
        <ArrowRightIcon size={16} />
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Full-screen green sheet
--------------------------------------------------------------------------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function GradeSheet({ module, kids, onClose }: { module: ModuleDef; kids: Child[]; onClose: () => void }) {
  const { state } = useHouse();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `sheet-title-${module.id}`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const teaches = module.dimensions.map((d) => d.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ");

  // Portal out of .parent-desk: its isolated stacking context would let the
  // fixed refresh bar paint over the sheet.
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="grade-sheet fixed inset-0 z-[70] flex flex-col overflow-hidden"
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-lime-200">
            {module.track === "letters" ? "Letters and sounds" : "Phonics words"}
          </p>
          <h2 id={titleId} className="text-2xl font-black leading-tight text-white sm:text-3xl">
            {module.title}
          </h2>
          <p className="mt-1 text-sm font-bold text-emerald-50/90">{module.skill}</p>
          <p className="mt-0.5 text-xs text-emerald-100/80">
            Teaches {teaches}. {module.items.length} items, {module.stretch}.
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close grading sheet"
          className="grade-close grid h-14 w-14 shrink-0 place-items-center rounded-full"
        >
          <XIcon size={26} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto grid max-w-3xl gap-3">
          {kids.map((k) => (
            <KidSheet key={k.id} child={k} module={module} idx={Math.max(0, state.kids.findIndex((x) => x.id === k.id))} />
          ))}
        </div>
      </div>

      <footer className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2">
        <button type="button" onClick={onClose} className="grade-close mx-auto flex min-h-14 w-full max-w-3xl items-center justify-center gap-2 rounded-2xl text-lg font-black">
          <XIcon size={20} />
          Close
        </button>
      </footer>
    </div>,
    document.body,
  );
}

function KidSheet({ child, module, idx }: { child: Child; module: ModuleDef; idx: number }) {
  const house = useHouse();
  const verdict = house.state.verdicts[verdictKey(child.id, module.id)];
  const progress = moduleProgress(child, module, house.state.attempts, verdict);
  const grades = child.status === "waiting" ? [] : moduleFunctionGrades(child, module, house.state.attempts);

  return (
    <section className="grade-kid p-4" aria-labelledby={`kid-${child.id}-${module.id}`}>
      <header className="flex items-center gap-3">
        <Avatar child={child} idx={idx} size="h-11 w-11 text-base" />
        <div className="min-w-0 flex-1">
          <h3 id={`kid-${child.id}-${module.id}`} className="flex flex-wrap items-center gap-2 text-xl font-black text-white">
            {child.name}
            <span className="text-sm font-bold text-emerald-100/80">age {ageFromBirthday(child.birthday)}</span>
          </h3>
          <span className={sheetBadge(progress.status)}>
            {progress.status === "waiting" ? <LockIcon size={11} /> : null}
            {MODULE_STATUS_LABEL[progress.status]}
          </span>
        </div>
      </header>

      {child.status === "waiting" ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-50">
          <LockIcon size={16} />
          Waiting. No lessons, no grade, nothing made up.
        </p>
      ) : (
        <>
          <OverallRow progress={progress} />
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {grades.map((g) => (
              <li key={g.key}>
                <FunctionTile grade={g} />
              </li>
            ))}
            <li>
              <VerdictTile progress={progress} />
            </li>
          </ul>
          <QuickActions child={child} module={module} progress={progress} />
        </>
      )}
    </section>
  );
}

function OverallRow({ progress }: { progress: ModuleProgress }) {
  const total = progress.hits + progress.misses;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm font-bold text-white">
        <span>Module progress</span>
        <span className="tabular-nums">{progress.pct}%</span>
      </div>
      <span className="grade-bar mt-1.5" role="img" aria-label={`${progress.itemsHit} of ${progress.items} items hit`}>
        <span style={{ width: `${progress.pct}%` }} />
      </span>
      <p className="mt-1.5 text-xs font-bold text-emerald-50/85">
        {total === 0
          ? "No attempts yet."
          : `${progress.itemsHit} of ${progress.items} items hit · ${progress.hits} hits, ${progress.misses} misses${progress.lastAt ? ` · last ${when(progress.lastAt)}` : ""}`}
        {progress.pendingSpeak ? ` · ${progress.pendingSpeak} spoken pending` : ""}
      </p>
    </div>
  );
}

function FunctionTile({ grade }: { grade: FunctionGrade }) {
  const has = grade.attempts > 0;
  return (
    <div className="grade-tile p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-white">{grade.label}</p>
        {grade.key === "speed" ? (
          <span className="inline-flex items-center gap-1 text-sm font-black tabular-nums text-white">
            <ClockIcon size={13} />
            {grade.avgMs ? `${(grade.avgMs / 1000).toFixed(1)} s` : "—"}
          </span>
        ) : (
          <span className="text-sm font-black tabular-nums text-white">{grade.pct === undefined ? "—" : `${grade.pct}%`}</span>
        )}
      </div>
      {grade.key !== "speed" ? (
        <span className="grade-bar mt-2" role="img" aria-label={has ? `${grade.correct} of ${grade.attempts} correct` : "no attempts yet"}>
          <span style={{ width: `${grade.pct ?? 0}%` }} />
        </span>
      ) : null}
      <p className="mt-1.5 text-xs font-bold text-emerald-50/85">
        {has && grade.key !== "speed" ? `${grade.attempts} ${grade.attempts === 1 ? "try" : "tries"}, ${grade.correct} right. ` : ""}
        {grade.note}
      </p>
      {grade.lastAt ? <p className="mt-0.5 text-[11px] font-bold text-emerald-100/70">Last {when(grade.lastAt)}</p> : null}
      {grade.pendingSpeak ? (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-amber-200">
          <MicIcon size={11} />
          {grade.pendingSpeak} spoken pending
        </p>
      ) : null}
    </div>
  );
}

function VerdictTile({ progress }: { progress: ModuleProgress }) {
  const label = progress.verdict === "pass" ? "Pass" : progress.verdict === "fail" ? "Fail" : "Open";
  const total = progress.hits + progress.misses;
  return (
    <div className="grade-tile p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-white">Module pass / fail</p>
        <span className={sheetBadge(progress.verdict === "pass" ? "passed" : progress.verdict === "fail" ? "failed" : "in-progress")}>{label}</span>
      </div>
      <p className="mt-1.5 text-xs font-bold text-emerald-50/85">
        {total === 0 && progress.verdict === "open"
          ? "No attempts yet. Auto-pass needs 8 cold hits."
          : progress.verdict !== progress.auto
            ? `Set by you. Sheet alone says ${progress.auto}. ${progress.coldHits} cold hits.`
            : progress.verdict === "pass"
              ? `${progress.coldHits} first-try hits. Passed.`
              : progress.verdict === "fail"
                ? `${progress.hits} hits under ${progress.misses} misses after ${total} tries.`
                : `${progress.coldHits} of 8 cold hits toward auto-pass.`}
      </p>
    </div>
  );
}

function QuickActions({ child, module, progress }: { child: Child; module: ModuleDef; progress: ModuleProgress }) {
  const house = useHouse();
  const act = (label: string, onClick: () => void, extra?: ReactNode, key?: ModuleVerdict) => (
    <button
      type="button"
      onClick={onClick}
      className={`grade-action ${key && progress.verdict === key ? "grade-action--on" : ""}`}
    >
      {extra}
      {label}
    </button>
  );
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Quick actions for ${child.name}`}>
      <Link
        href={`/kids/${child.id}/play?mode=try&module=${module.id}`}
        className="grade-action grade-action--go"
        onClick={() => {
          if (!child.themeToday) house.pickTheme(child.id, "planets-space");
        }}
      >
        <PlayIcon size={14} />
        Try
      </Link>
      {act("Done", () => house.applyFromSheet(child.id, module.id, "done"), <CheckIcon size={14} />, "pass")}
      {act("Ease", () => house.applyFromSheet(child.id, module.id, "ease"))}
      {act("Harden", () => house.applyFromSheet(child.id, module.id, "harden"))}
      {progress.onPath
        ? act("Hold", () => house.applyFromSheet(child.id, module.id, "hold"))
        : act("Add to path", () => house.setPath(child.id, [...child.path, module.id]), <PlusIcon size={14} />)}
      {progress.verdict !== "open" ? act("Reopen", () => house.setVerdict(child.id, module.id, "open")) : null}
    </div>
  );
}
