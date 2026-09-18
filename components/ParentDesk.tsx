"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isVoiceMuted, setVoiceMuted, speakPhoneme, speakPrompt, voiceLastError, voiceStatus } from "@/lib/audio";
import { ageFromBirthday, THEMES, wordsUnlocked } from "@/lib/catalog";
import { bandReports, bandsFor, practicePrefill, progressSummary, speedLine, type PracticePrefill } from "@/lib/diagnostic";
import { allDimensions, moduleProgress, MODULE_STATUS_LABEL, rollupDimension, verdictProvenance, verdictRecord, type DimensionStatus, type ModuleKidStatus } from "@/lib/grades";
import { planOf } from "@/lib/house";
import { activeModule, dueReview, moduleStretch, pendingProposals, planState } from "@/lib/plan";
import { scoutDueReason } from "@/lib/scout";
import { exportHouse, useHouse } from "@/lib/store";
import { BUILD_STAMP } from "@/components/RefreshBar";
import { Bar, Confirm, SegmentBar, Sheet } from "@/components/ui";
import type { BandReport, BandStatus, Child, ModuleDef, Proposal, ScoutReport, Stretch } from "@/lib/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CompassIcon,
  DownloadIcon,
  InboxIcon,
  ListIcon,
  LockIcon,
  MapIcon,
  MicIcon,
  MoreIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  SettingsIcon,
  SheetIcon,
  ShieldIcon,
  SpeakerIcon,
  SparklesIcon,
  StarIcon,
  TelescopeIcon,
  TrashIcon,
  XIcon,
} from "@/components/Icons";

const AVATAR: [string, string][] = [
  ["#f59e0b", "#ec4899"],
  ["#22d3ee", "#6366f1"],
  ["#a3e635", "#059669"],
  ["#c084fc", "#7c3aed"],
  ["#fb7185", "#f97316"],
];

type Seg = "today" | "map" | "path" | "sheet" | "settings";
type SheetId = "library" | "create" | "confirm-map" | "confirm-reset" | "import" | { row: string } | null;

function Card({ title, icon, sub, children, className = "", id }: { title?: string; icon?: ReactNode; sub?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`desk-card p-4 ${className}`}>
      {title ? (
        <header className="mb-3 flex items-start gap-3">
          {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">{icon}</span> : null}
          <div className="min-w-0">
            <h3 className="text-body font-black text-white">{title}</h3>
            {sub ? <p className="muted text-label">{sub}</p> : null}
          </div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

function when(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function statusBadge(status: DimensionStatus) {
  if (status === "live") return "badge badge--good";
  if (status === "shaky") return "badge badge--warn";
  return "badge badge--muted";
}

function moduleBadge(status: ModuleKidStatus) {
  if (status === "passed") return "badge badge--good";
  if (status === "review") return "badge badge--info";
  if (status === "failed") return "badge badge--bad";
  if (status === "struggle-stop") return "badge badge--warn";
  if (status === "in-progress") return "badge badge--info";
  return "badge badge--muted";
}

function KidSelect({ selected, onPick }: { selected?: string; onPick: (id: string) => void }) {
  const { state } = useHouse();
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Pick a child">
      {state.kids.map((k, idx) => {
        const [a, b] = AVATAR[idx % AVATAR.length];
        const on = selected === k.id;
        const waiting = pendingProposals(k).length > 0 || state.scouts.some((s) => s.kidId === k.id && s.status === "pending");
        return (
          <button key={k.id} type="button" role="tab" aria-selected={on} onClick={() => onPick(k.id)} className={`chip relative shrink-0 gap-2 pl-1.5 pr-4 ${on ? "chip--on" : ""}`} data-kid-tab={k.id}>
            <span className="grid h-8 w-8 place-items-center rounded-full text-label font-black text-white" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
              {k.name.slice(0, 1)}
            </span>
            {k.name}
            {k.status === "waiting" ? <LockIcon size={12} className="opacity-70" /> : null}
            {waiting ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fde68a]" aria-label="needs a decision" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function DeskLoading() {
  return (
    <main className="parent-desk flex min-h-dvh items-center justify-center p-6">
      <p className="chip">
        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
        Loading desk…
      </p>
    </main>
  );
}

export function ParentHome() {
  return (
    <Suspense fallback={<DeskLoading />}>
      <ParentHomeInner />
    </Suspense>
  );
}

const SEGS: Seg[] = ["today", "map", "path", "sheet", "settings"];

function ParentHomeInner() {
  const { state, ready } = useHouse();
  const params = useSearchParams();
  const wanted = params.get("kid");
  const segParam = params.get("seg");
  const [id, setId] = useState(wanted && state.kids.some((k) => k.id === wanted) ? wanted : state.kids[0]?.id ?? "riley");
  const [seg, setSeg] = useState<Seg>(() => {
    if (segParam && SEGS.includes(segParam as Seg)) return segParam as Seg;
    if (typeof window !== "undefined" && window.location.hash === "#skills-map") return "map";
    return "today";
  });
  const child = state.kids.find((k) => k.id === id) ?? state.kids[0];
  if (!ready) return <DeskLoading />;
  return (
    <main className="parent-desk px-4 pb-8 pt-4 sm:pt-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="orb h-11 w-11 text-white" style={{ ["--orb-a" as string]: "#818cf8", ["--orb-b" as string]: "#22d3ee" }}>
              <ShieldIcon size={22} />
            </span>
            <div>
              <p className="text-label font-extrabold uppercase tracking-[0.08em] text-indigo-300">Parent door</p>
              <h1 className="text-title font-black text-white">House desk</h1>
            </div>
          </div>
          <Link href="/" className="chip">
            <ArrowLeftIcon size={14} />
            Doors
          </Link>
        </header>
        <div className="mt-4">
          <KidSelect selected={child?.id} onPick={setId} />
        </div>
        {child ? <ChildDesk key={child.id} child={child} seg={seg} setSeg={setSeg} /> : null}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// One kid
// ---------------------------------------------------------------------------

function ChildDesk({ child, seg, setSeg }: { child: Child; seg: Seg; setSeg: (s: Seg) => void }) {
  const house = useHouse();
  const idx = Math.max(0, house.state.kids.findIndex((k) => k.id === child.id));
  const [a, b] = AVATAR[idx % AVATAR.length];
  const [sheet, setSheet] = useState<SheetId>(null);
  const [prefill, setPrefill] = useState<PracticePrefill | null>(null);
  const proposals = pendingProposals(child);
  const scout = house.state.scouts.find((s) => s.kidId === child.id && s.status === "pending");
  const inboxCount = proposals.length + (scout ? 1 : 0);
  const waiting = child.status === "waiting";

  const practice = (band: BandReport) => {
    const def = bandsFor(child.track).find((x) => x.id === band.id);
    if (!def) return;
    setPrefill(practicePrefill(def, band.missed));
    setSheet("create");
  };

  return (
    <section className="mt-4 space-y-4">
      <KidHeader child={child} a={a} b={b} />
      <SegmentBar<Seg>
        label={`${child.name}'s desk`}
        value={seg}
        onChange={setSeg}
        segments={[
          { id: "today", label: "Today", icon: <InboxIcon size={14} />, dot: inboxCount > 0 },
          { id: "map", label: "Map", icon: <MapIcon size={14} /> },
          { id: "path", label: "Path", icon: <ListIcon size={14} /> },
          { id: "sheet", label: "Sheet", icon: <SheetIcon size={14} /> },
          { id: "settings", label: "Set", icon: <SettingsIcon size={14} /> },
        ]}
      />

      {waiting && seg !== "settings" ? (
        <Card>
          <p className="flex items-center gap-3 text-body text-slate-300">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-500/20 text-slate-300">
              <LockIcon size={18} />
            </span>
            Waiting is first-class. No lessons, no map, no fake grade. Activate {child.name} under Set.
          </p>
        </Card>
      ) : null}

      {!waiting && seg === "today" ? (
        <>
          <TodayCard child={child} />
          <Inbox child={child} proposals={proposals} scout={scout} onLibrary={() => setSheet("library")} />
          <SpokenToGrade child={child} />
          <LastSession child={child} />
        </>
      ) : null}

      {!waiting && seg === "map" ? <SkillsMapCard child={child} onPractice={practice} onMapAgain={() => setSheet("confirm-map")} /> : null}

      {!waiting && seg === "path" ? <PathEditor child={child} openRow={(id) => setSheet({ row: id })} openLibrary={() => setSheet("library")} openCreate={() => setSheet("create")} /> : null}

      {!waiting && seg === "sheet" ? <GambitCard child={child} /> : null}

      {seg === "settings" ? <SettingsCards child={child} onReset={() => setSheet("confirm-reset")} onImport={() => setSheet("import")} /> : null}

      <LibrarySheet child={child} open={sheet === "library"} onClose={() => setSheet(null)} />
      <CreateSheet key={prefill ? `${prefill.bandId}-${prefill.seeds}` : "blank"} child={child} open={sheet === "create"} prefill={prefill ?? undefined} onClose={() => { setSheet(null); setPrefill(null); }} />
      <RowSheet child={child} moduleId={typeof sheet === "object" && sheet ? sheet.row : undefined} onClose={() => setSheet(null)} />
      <Confirm
        open={sheet === "confirm-map"}
        onClose={() => setSheet(null)}
        title={`Map ${child.name} again?`}
        body="Dailies keep going. The map runs after a daily, from the done page, one sitting at a time. When it finishes you get the new path as a proposal — the current path stays until you accept it."
        confirmLabel="Map again"
        onConfirm={() => house.requestMap(child.id)}
      />
      <Confirm
        open={sheet === "confirm-reset"}
        onClose={() => setSheet(null)}
        title="Reset the whole house?"
        body="Every kid, every attempt, every grade on this device goes back to the starter house. Copy the house first if you want it back."
        confirmLabel="Reset everything"
        danger
        onConfirm={() => house.resetHouse()}
      />
      <ImportSheet open={sheet === "import"} onClose={() => setSheet(null)} />
    </section>
  );
}

function KidHeader({ child, a, b }: { child: Child; a: string; b: string }) {
  const { state } = useHouse();
  const theme = THEMES.find((t) => t.id === child.themeToday);
  const scoutReady = child.track === "letters" && child.status === "active" ? child.readyForPrintWords : undefined;
  const st = planState(child, state);
  return (
    <div className="desk-card relative overflow-hidden p-4">
      <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
      <div className="relative flex items-start gap-3">
        <span className="orb display h-14 w-14 shrink-0 text-2xl text-white" style={{ ["--orb-a" as string]: a, ["--orb-b" as string]: b }}>
          {child.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-black text-white">{child.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="badge badge--info">Age {ageFromBirthday(child.birthday)}</span>
            <span className={`badge ${child.status === "active" ? "badge--good" : "badge--muted"}`}>{child.status}</span>
            <span className="badge badge--muted">{child.track === "letters" ? "letters / sounds" : "phonics words"}</span>
            <span className="badge badge--warn">
              <StarIcon size={10} />
              {child.stars}
            </span>
            {child.status === "active" ? <span className="badge badge--muted">shelf {child.placementGrade ?? (child.diagnostic ? "mapping" : "not mapped")}</span> : null}
            {scoutReady !== undefined ? (
              <span className={`badge ${scoutReady ? "badge--good" : "badge--muted"}`} data-scout-ready={scoutReady ? "1" : "0"}>
                {scoutReady ? "Map says ready for words" : "Letters and sounds"}
              </span>
            ) : null}
          </div>
          <p className="muted mt-2 text-label">
            {child.status === "waiting" ? "Waiting." : st === "placing" ? "Skills map first." : st === "learning" ? "Learning." : "Path finished — reviewing."}
            {theme ? ` Today: ${theme.emoji} ${theme.label} (kid-picked).` : " No theme picked today."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

function TodayCard({ child }: { child: Child }) {
  const house = useHouse();
  const st = planState(child, house.state);
  const active = activeModule(child, house.state);
  const last = [...house.state.sessions].reverse().find((s) => s.kidId === child.id && s.kind !== "place");
  const due = dueReview(child, new Date().toISOString().slice(0, 10)).length;
  const summary = child.diagnostic ? progressSummary(child.diagnostic) : undefined;
  const progress = active ? moduleProgress(child, active, house.state.attempts, verdictRecord(house.state, child.id, active.id)) : undefined;
  const dueLine = scoutDueReason(child);
  const line =
    st === "placing"
      ? child.diagnostic
        ? `Skills map in progress: ${summary?.answered ?? 0} probes in, on ${summary?.bandTitle ?? "the next band"}. It resumes at the next theme pick.`
        : "Skills map not started. The first sitting is the map."
      : st === "learning" && active
        ? `Learning ${active.title}${progress?.attempted ? ` · ${progress.itemsHit} of ${progress.items} items hit · ${progress.window.correct}/${progress.window.attempts} cold` : " · not started"}${planOf(child).moduleStretch[active.id] ? ` · ${moduleStretch(child, active.id)}` : ""}.`
        : "Path finished. Sessions are review until you add the next step.";

  const tryHref = active ? `/kids/${child.id}/play?mode=try&module=${active.id}` : undefined;
  const pick = () => {
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!child.themeToday || child.themeDate !== day) house.pickTheme(child.id, "planets-space");
  };

  return (
    <Card title="Today" icon={<SparklesIcon size={18} />} sub={line}>
      {due ? <p className="mb-2 text-label text-indigo-200">{due} review {due === 1 ? "card" : "cards"} due — the warm-up starts with them.</p> : null}
      {dueLine ? <p className="mb-2 text-label text-amber-200">{dueLine}</p> : null}
      {last ? (
        <p className="muted mb-3 text-label" data-last-session={last.id}>
          Last {last.kind === "review" ? "victory lap" : last.kind}: {last.items} cards · {last.wins} real {last.wins === 1 ? "win" : "wins"} · {last.misses} {last.misses === 1 ? "miss" : "misses"}
          {last.pending ? ` · ${last.pending} waiting for your ear` : ""} · ended on {last.endedOn === "enough" ? "that's enough" : last.endedOn} · {when(last.endedAt)}
        </p>
      ) : (
        <p className="muted mb-3 text-label">No sessions yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={`/kids/${child.id}/theme`} className="chip chip--go">
          <PlayIcon size={14} />
          Start today&apos;s session
        </Link>
        {tryHref ? (
          <Link href={tryHref} className="chip" onClick={pick}>
            <PlayIcon size={14} />
            Try {active!.title}
          </Link>
        ) : null}
        <Link href={`/kids/${child.id}/play?mode=scout`} className="chip chip--indigo" onClick={pick}>
          <TelescopeIcon size={14} />
          Send a scout
        </Link>
      </div>
    </Card>
  );
}

function Inbox({ child, proposals, scout, onLibrary }: { child: Child; proposals: Proposal[]; scout?: ScoutReport; onLibrary: () => void }) {
  const house = useHouse();
  const nextTitle = (id?: string) => (id ? house.module(id)?.title ?? id : undefined);
  if (!proposals.length && !scout) {
    const active = activeModule(child, house.state);
    return (
      <Card title="Inbox" icon={<InboxIcon size={18} />}>
        <p className="muted text-body" data-inbox="empty">
          Nothing to decide.{active ? ` The path is set through ${nextTitle(child.path.at(-1))}.` : ""}
        </p>
      </Card>
    );
  }
  return (
    <Card title="Inbox" icon={<InboxIcon size={18} />} sub="The engine proposes. You decide. The path never changes on its own.">
      <ul className="space-y-3">
        {scout ? (
          <li>
            <ScoutInboxCard child={child} report={scout} />
          </li>
        ) : null}
        {proposals.map((p) => (
          <li key={p.id} className="inbox-card p-4" data-proposal={p.kind}>
            <p className="text-label font-extrabold uppercase tracking-[0.08em] text-indigo-200">{PROPOSAL_LABEL[p.kind]}</p>
            <p className="mt-1 text-body text-white">{p.why}</p>
            {p.evidence.bits?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.evidence.bits.map((bit) => (
                  <span key={bit} className="badge badge--bad">
                    {bit}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2">
              {p.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`opt ${o.primary ? "opt--primary" : ""}`}
                  data-option={o.id}
                  onClick={() => {
                    house.decideProposal(child.id, p.id, { option: o.id });
                    if (o.id === "library") onLibrary();
                  }}
                >
                  {o.primary ? <CheckIcon size={16} /> : null}
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <button type="button" className="chip" onClick={() => house.decideProposal(child.id, p.id, "later")}>
                Later
              </button>
              <button type="button" className="chip" onClick={() => house.decideProposal(child.id, p.id, "dismiss")}>
                <XIcon size={12} />
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const PROPOSAL_LABEL: Record<Proposal["kind"], string> = {
  "next-band": "Path finished",
  "next-module": "Next module",
  ease: "Stalled",
  harden: "Coasting",
  refresh: "Slipping in review",
  "unlock-words": "Ready for words?",
  "map-path": "New map",
};

function ScoutInboxCard({ child, report }: { child: Child; report: ScoutReport }) {
  const house = useHouse();
  return (
    <div className="inbox-card p-4" data-proposal="scout">
      <p className="text-label font-extrabold uppercase tracking-[0.08em] text-indigo-200">Scout report · {report.at?.slice(0, 10)}</p>
      <p className="mt-1 text-body text-white">
        Ceiling {report.ceiling} · floor {report.floor} · {report.hits ?? 0}/{report.answered ?? 0} hits.
        {child.track === "letters" ? (report.readyForPrintWords ? " Scout says ready for print words." : " Scout says letters and sounds still.") : ""}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5 text-label">
        {report.bands.map((b) => (
          <li key={b.id ?? b.name} className="desk-tile px-2.5 py-1 text-slate-200" data-scout-band={b.id}>
            {b.name}: <span className={b.tag === "known" ? "text-emerald-300" : b.tag === "shaky" ? "text-amber-300" : "text-rose-300"}>{b.tag}</span>
            {b.answered !== undefined ? <span className="muted"> {b.hits ?? 0}/{b.answered}</span> : null}
          </li>
        ))}
      </ul>
      {report.drafts.map((d) => (
        <p key={d.title} className="mt-2 text-label text-slate-300">
          <span className="muted">Draft:</span> {d.title} <span className="muted">({d.stretch})</span>
        </p>
      ))}
      <div className="mt-3 grid gap-2">
        {report.drafts.length ? (
          <>
            <button type="button" className="opt opt--primary" onClick={() => house.resolveScout(child.id, "approved", { where: "next" })}>
              <CheckIcon size={16} />
              Approve — next up
            </button>
            <button type="button" className="opt" onClick={() => house.resolveScout(child.id, "approved", { where: "later" })}>
              Approve — later on the path
            </button>
            <button type="button" className="opt" onClick={() => house.resolveScout(child.id, "approved", { ease: true, where: "next" })}>
              Ease the drafts
            </button>
          </>
        ) : (
          <p className="muted text-label">Nothing to draft — every band touched was known.</p>
        )}
        <button type="button" className="opt" onClick={() => house.resolveScout(child.id, "ignored")}>
          <XIcon size={16} />
          Ignore
        </button>
      </div>
    </div>
  );
}

function SpokenToGrade({ child }: { child: Child }) {
  const house = useHouse();
  const pending = house.state.attempts.filter((a) => a.kidId === child.id && a.spokenGrade === "pending");
  if (!pending.length) return null;
  const promptOf = (moduleId: string, itemId: string) => {
    const mod = house.module(moduleId);
    const item = mod?.items.find((i) => i.id === itemId);
    if (item) return item.prompt;
    const probe = bandsFor(child.track).flatMap((b) => b.probes).find((p) => p.id === itemId);
    return probe ? `${probe.prompt}${probe.print ? ` (${probe.print})` : ""}` : itemId;
  };
  return (
    <Card title="Spoken tries for your ear" icon={<MicIcon size={18} />} sub="A Hit is a real win: the star lands on the next done page.">
      <ul className="space-y-2">
        {pending.map((a) => (
          <li key={a.id} className="desk-tile flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="min-w-0 text-body text-slate-200">
              <span className="font-bold">{promptOf(a.moduleId, a.itemId)}</span>
              {a.spokenText && a.spokenText !== "parent-listen" ? <span className="muted"> · heard “{a.spokenText}”</span> : null}
              <span className="muted"> · {when(a.at)}</span>
            </span>
            <span className="flex gap-2">
              <button type="button" className="chip chip--good" onClick={() => house.gradeSpoken(a.id, "hit")}>
                <CheckIcon size={12} />
                Hit
              </button>
              <button type="button" className="chip chip--bad" onClick={() => house.gradeSpoken(a.id, "miss")}>
                <XIcon size={12} />
                Miss
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LastSession({ child }: { child: Child }) {
  const house = useHouse();
  const recent = [...house.state.attempts].reverse().filter((a) => a.kidId === child.id).slice(0, 8);
  if (recent.length === 0) return null;
  const promptOf = (moduleId: string, itemId: string) => {
    const item = house.module(moduleId)?.items.find((i) => i.id === itemId);
    if (item) return item.prompt;
    const probe = bandsFor(child.track).flatMap((b) => b.probes).find((p) => p.id === itemId);
    return probe?.prompt ?? itemId;
  };
  return (
    <Card title="Last cards" icon={<ClockIcon size={18} />} sub="Misses stay after a later hit. The kid heard “not that one”, never fail.">
      <ul className="divide-y divide-white/5 text-label">
        {recent.map((a) => {
          const pending = a.spokenGrade === "pending";
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className={`badge ${pending ? "badge--warn" : a.correct ? "badge--good" : "badge--bad"}`}>{pending ? "waiting" : a.correct ? "hit" : "miss"}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-slate-200">{promptOf(a.moduleId, a.itemId)}</span>
              <span className="badge badge--muted">{a.source}</span>
              <span className="muted inline-flex items-center gap-1 tabular-nums">
                <ClockIcon size={12} />
                {secs(a.ms)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function bandBadge(status: BandStatus) {
  if (status === "known") return "badge badge--good";
  if (status === "shaky") return "badge badge--warn";
  if (status === "unknown") return "badge badge--bad";
  return "badge badge--muted";
}

function SkillsMapCard({ child, onPractice, onMapAgain }: { child: Child; onPractice: (band: BandReport) => void; onMapAgain: () => void }) {
  const house = useHouse();
  const report = child.diagnosticReport;
  const progress = child.diagnostic;
  const defs = bandsFor(child.track);
  const plan = planOf(child);
  const running = Boolean(progress?.cursor);
  const bands: BandReport[] = report
    ? report.bands
    : progress
      ? bandReports(progress)
      : defs.map((b) => ({ id: b.id, title: b.title, status: "not-reached" as BandStatus, hits: 0, answered: 0, total: b.probes.length, known: [], missed: [] }));
  const summary = progress ? progressSummary(progress) : undefined;
  const state = report ? "done" : progress ? "running" : "fresh";
  const scoutingId = running && progress?.cursor ? bandsFor(progress.track)[progress.cursor.band]?.id : undefined;
  const speed = speedLine(report?.speedMs);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState<BandReport | null>(null);
  const sub =
    state === "done"
      ? plan.mapRequested && running
        ? `New map in progress (${summary?.answered ?? 0} probes). The kid can scout more of it from the done page. Path stays until you accept the new one.`
        : `Finished ${report?.at.slice(0, 10)}. Start here moves the path; Practice these builds a module from a band.`
      : state === "running"
        ? `In progress: ${summary?.answered} probes answered, on ${summary?.bandTitle ?? "the next band"}. Resumes at the next theme pick.`
        : "Not started. The kid gets it before the first daily. Tap and say, in their skin, stops at the frontier.";

  useEffect(() => {
    if (window.location.hash === "#skills-map") document.getElementById("skills-map")?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div id="skills-map" className="scroll-mt-20">
      <Card title="Skills map" icon={<CompassIcon size={18} />} sub={sub}>
        {report ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="badge badge--info">shelf {report.shelf}</span>
            {report.frontier ? <span className="badge badge--warn">frontier: {bands.find((b) => b.id === report.frontier)?.title ?? report.frontier}</span> : <span className="badge badge--good">no frontier</span>}
            {speed ? (
              <span className="badge badge--muted" data-speed={report.speedMs}>
                <ClockIcon size={10} />
                speed {speed}
              </span>
            ) : (
              <span className="badge badge--muted">speed: no timed hits</span>
            )}
          </div>
        ) : null}
        {report ? <p className="mb-3 text-label text-slate-300">{report.note}</p> : null}
        <ul className="grid gap-2 md:grid-cols-2">
          {bands.map((b) => {
            const def = defs.find((d) => d.id === b.id);
            const expanded = open === b.id;
            const bits = b.missed.length + b.known.length;
            return (
              <li key={b.id} className="desk-tile p-3" data-band={b.id} data-status={b.status}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(expanded ? null : b.id)} aria-expanded={expanded}>
                  <span className="min-w-0">
                    <span className="block text-body font-bold text-white">{b.title}</span>
                    <span className="muted block text-label">
                      {b.answered > 0 ? `${b.hits}/${b.answered}${b.answered < b.total ? ` of ${b.total}` : ""}` : `${b.total} probes`}
                      {b.avgMs !== undefined ? ` · ${speedLine(b.avgMs)}` : ""}
                      {b.speak ? (b.speak.pending ? " · speak waits for your ear" : b.speak.hits ? " · said it" : " · could not say it") : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {b.id === scoutingId ? <span className="badge badge--info">scouting</span> : <span className={bandBadge(b.status)}>{b.status.replace("-", " ")}</span>}
                    {bits || def?.bankModule ? expanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} /> : null}
                  </span>
                </button>
                {b.answered > 0 ? <Bar pct={Math.round((b.hits / Math.max(1, b.total)) * 100)} label={`${b.hits} of ${b.total}`} className="mt-2" /> : null}
                {expanded ? (
                  <div className="mt-2">
                    {bits ? (
                      <div className="flex flex-wrap gap-1">
                        {b.missed.map((bit, i) => (
                          <span key={`m-${bit}-${i}`} className="badge badge--bad">
                            {bit}
                          </span>
                        ))}
                        {b.known.map((bit, i) => (
                          <span key={`k-${bit}-${i}`} className="badge badge--good">
                            {bit}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {def?.bankModule && child.status === "active" ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
                        <button type="button" className="chip" onClick={() => setConfirmStart(b)} data-start-here={b.id}>
                          <PlayIcon size={12} />
                          Start here
                        </button>
                        {b.missed.length ? (
                          <button type="button" className="chip chip--indigo" onClick={() => onPractice(b)} data-practice={b.id}>
                            <PlusIcon size={12} />
                            Practice these ({b.missed.length})
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {report?.built.length ? (
          <details className="mt-3">
            <summary className="muted min-h-11 cursor-pointer text-label">Built for {child.name} by the map ({report.built.length})</summary>
            <ul className="mt-1 space-y-1 text-label text-slate-300">
              {report.built.map((b) => (
                <li key={b.moduleId}>
                  <span className="font-bold">{b.title}</span> <span className="muted">— {b.why}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {state !== "done" ? (
            <Link href={`/kids/${child.id}/theme`} className="chip chip--go">
              <PlayIcon size={14} />
              {state === "running" ? "Continue the map" : "Start the map"}
            </Link>
          ) : null}
          {state !== "fresh" && !(plan.mapRequested && running) ? (
            <button type="button" className="chip" onClick={onMapAgain}>
              <RefreshIcon size={14} />
              Map again
            </button>
          ) : null}
        </div>
      </Card>
      <Confirm
        open={Boolean(confirmStart)}
        onClose={() => setConfirmStart(null)}
        title={`Start at ${confirmStart?.title ?? ""}?`}
        body={`Earlier bank modules are marked passed (by Start here, not by play) and the path rebuilds from ${confirmStart?.title ?? "here"}. Modules you made by hand stay.`}
        confirmLabel="Start here"
        onConfirm={() => confirmStart && house.startPathAt(child.id, confirmStart.id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

function PathEditor({ child, openRow, openLibrary, openCreate }: { child: Child; openRow: (id: string) => void; openLibrary: () => void; openCreate: () => void }) {
  const house = useHouse();
  const plan = planOf(child);
  const active = activeModule(child, house.state);
  const held = (child.held ?? []).filter((id) => house.module(id));
  return (
    <>
      <Card title="Path" icon={<ListIcon size={18} />} sub="Stretch-hard by default. Every change here is yours; the engine only proposes.">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-black/30 p-1" role="group" aria-label="Stretch">
            {(["easier", "stretch-hard", "harder"] as Stretch[]).map((s) => (
              <button key={s} type="button" className={`chip border-transparent ${child.stretch === s ? "chip--on" : "bg-transparent"}`} onClick={() => house.setStretch(child.id, s)} aria-pressed={child.stretch === s}>
                {s}
              </button>
            ))}
          </div>
          <select className="desk-input w-auto rounded-full" value={child.sessionLength} onChange={(e) => house.setSession(child.id, e.target.value as Child["sessionLength"])} aria-label="Session length">
            <option value="shorter">Shorter session</option>
            <option value="standard">Standard</option>
            <option value="longer">Longer</option>
          </select>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-body text-slate-300">
          <input type="checkbox" className="h-5 w-5 accent-indigo-400" checked={plan.gate === "each"} onChange={(e) => house.setGate(child.id, e.target.checked ? "each" : "path")} />
          Ask me before each new module
        </label>
        <ol className="mt-4 space-y-2">
          {child.path.map((id, index) => {
            const mod = house.module(id);
            if (!mod) return null;
            const p = moduleProgress(child, mod, house.state.attempts, verdictRecord(house.state, child.id, id));
            const card = plan.review.find((c) => c.moduleId === id);
            const stretch = plan.moduleStretch[id];
            const isActive = active?.id === id;
            return (
              <li key={id} className={`desk-tile p-3 ${isActive ? "ring-2 ring-indigo-400/60" : ""}`} data-path-row={id}>
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-label font-black text-indigo-200">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-bold text-white">{mod.title}</p>
                    <p className="muted text-label">{mod.skill}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={moduleBadge(isActive && p.status === "not-started" ? "in-progress" : p.status)}>{isActive ? "active" : MODULE_STATUS_LABEL[p.status]}</span>
                      {p.attempted ? <span className="badge badge--muted">{p.hits} hits · {p.misses} misses</span> : null}
                      {card ? <span className="badge badge--info">review · stage {card.stage} · next {card.nextAt.slice(5)}</span> : null}
                      {stretch ? <span className="badge badge--warn">{stretch}</span> : null}
                    </div>
                  </div>
                  <button type="button" className="chip chip--icon" aria-label={`More for ${mod.title}`} onClick={() => openRow(id)}>
                    <MoreIcon size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        {child.path.length === 0 ? <p className="muted mt-3 text-body">Nothing on the path. Add from the library or accept a proposal.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="chip chip--on" onClick={openLibrary}>
            <PlusIcon size={14} />
            Add from library
          </button>
          <button type="button" className="chip" onClick={openCreate}>
            <SparklesIcon size={14} />
            Create a module
          </button>
        </div>
      </Card>
      {held.length ? (
        <Card title={`Held (${held.length})`} icon={<LockIcon size={18} />} sub="Off the path. Nothing automatic puts them back.">
          <ul className="space-y-1.5">
            {held.map((id) => {
              const mod = house.module(id)!;
              return (
                <li key={id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5">
                  <span className="min-w-0 text-body text-slate-200">{mod.title}</span>
                  <button type="button" className="chip" onClick={() => house.setPath(child.id, [...child.path, id])}>
                    <PlusIcon size={12} />
                    Put back
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function RowSheet({ child, moduleId, onClose }: { child: Child; moduleId?: string; onClose: () => void }) {
  const house = useHouse();
  const mod = moduleId ? house.module(moduleId) : undefined;
  if (!mod || !moduleId) return null;
  const index = child.path.indexOf(moduleId);
  const p = moduleProgress(child, mod, house.state.attempts, verdictRecord(house.state, child.id, moduleId));
  const stretch = planOf(child).moduleStretch[moduleId];
  const pick = () => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!child.themeToday || child.themeDate !== day) house.pickTheme(child.id, "planets-space");
  };
  const act = (label: string, fn: () => void, cls = "opt", icon?: ReactNode) => (
    <button
      type="button"
      className={cls}
      onClick={() => {
        fn();
        onClose();
      }}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <Sheet open onClose={onClose} title={mod.title}>
      <p className="muted text-label">{mod.skill}</p>
      <p className="mt-1 text-label text-slate-300">
        {MODULE_STATUS_LABEL[p.status]} · {verdictProvenance(p)}
      </p>
      <div className="mt-4 grid gap-2">
        <Link href={`/kids/${child.id}/play?mode=try&module=${moduleId}`} className="opt opt--primary" onClick={pick}>
          <PlayIcon size={16} />
          Try it now
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="opt" disabled={index <= 0} onClick={() => house.moveModule(child.id, index, index - 1)}>
            <ChevronUpIcon size={16} />
            Move up
          </button>
          <button type="button" className="opt" disabled={index === -1 || index >= child.path.length - 1} onClick={() => house.moveModule(child.id, index, index + 1)}>
            <ChevronDownIcon size={16} />
            Move down
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {act(stretch === "easier" ? "Eased ✓" : "Ease", () => house.setModuleStretch(child.id, moduleId, stretch === "easier" ? undefined : "easier"))}
          {act(stretch === "harder" ? "Hardened ✓" : "Harden", () => house.setModuleStretch(child.id, moduleId, stretch === "harder" ? undefined : "harder"))}
        </div>
        {p.verdict === "pass"
          ? act("Reopen — play it again", () => house.setVerdict(child.id, moduleId, "open"), "opt", <RefreshIcon size={16} />)
          : act("Mark done", () => house.applyFromSheet(child.id, moduleId, "done"), "opt", <CheckIcon size={16} />)}
        {p.verdict !== "fail" ? act("Mark fail (parent-door word)", () => house.setVerdict(child.id, moduleId, "fail")) : act("Clear fail", () => house.setVerdict(child.id, moduleId, "open"))}
        {act("Hold — take it off the path", () => house.applyFromSheet(child.id, moduleId, "hold"), "opt", <TrashIcon size={16} />)}
      </div>
    </Sheet>
  );
}

function LibrarySheet({ child, open, onClose }: { child: Child; open: boolean; onClose: () => void }) {
  const house = useHouse();
  const [q, setQ] = useState("");
  const locked = !wordsUnlocked(child);
  const groups = useMemo(() => {
    const list = house.state.modules.filter((m) => (locked ? m.track === "letters" : true)).filter((m) => !q || `${m.title} ${m.skill}`.toLowerCase().includes(q.toLowerCase()));
    return [
      { title: "Letters and sounds", modules: list.filter((m) => m.track === "letters") },
      { title: "Phonics words", modules: list.filter((m) => m.track === "words") },
    ].filter((g) => g.modules.length);
  }, [house.state.modules, locked, q]);
  return (
    <Sheet open={open} onClose={onClose} title="House library" wide>
      <input className="desk-input" placeholder="Search modules" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search modules" />
      {groups.map((g) => (
        <section key={g.title} className="mt-4">
          <h3 className="text-label font-extrabold uppercase tracking-[0.08em] text-indigo-200">{g.title}</h3>
          <ul className="mt-2 space-y-1.5">
            {g.modules.map((m: ModuleDef) => {
              const on = child.path.includes(m.id);
              const heldHere = child.held?.includes(m.id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-1.5">
                  <span className="min-w-0 text-body text-slate-200">
                    {m.title} <span className="muted text-label">({m.skill})</span>
                  </span>
                  {on ? (
                    <span className="badge badge--info">on path</span>
                  ) : (
                    <button type="button" className="chip" onClick={() => house.setPath(child.id, [...child.path, m.id])} data-library-add={m.id}>
                      <PlusIcon size={12} />
                      {heldHere ? "Put back" : "Add"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}

function CreateSheet({ child, open, prefill, onClose }: { child: Child; open: boolean; prefill?: PracticePrefill; onClose: () => void }) {
  const house = useHouse();
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [skill, setSkill] = useState(prefill?.skill ?? "");
  const [seeds, setSeeds] = useState(prefill?.seeds ?? (child.track === "letters" ? "s, a, t" : "sat, pin"));
  const [bandId, setBandId] = useState(prefill?.bandId);
  const [made, setMade] = useState<string | null>(null);
  const lockedWords = !wordsUnlocked(child);
  const bandTitle = bandId ? bandsFor(child.track).find((b) => b.id === bandId)?.title : undefined;
  return (
    <Sheet open={open} onClose={onClose} title="Create a module">
      <form
        id="create-module"
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const mod = house.createAndAssign(child.id, { title, skill, track: lockedWords ? "letters" : child.track, seeds, bandId });
          setMade(mod ? `${mod.title} is on ${child.name}'s path (${mod.items.length} items).` : "Nothing to build from those seeds.");
          if (mod) window.setTimeout(onClose, 900);
        }}
      >
        <p className="muted text-label">
          {bandTitle ? `Practice set from the map: ${bandTitle}. Built with that band's own tap, drag, and speak items.` : lockedWords ? `${child.name} stays in letters and sounds until unlock.` : "Seeds become tap, drag, and speak items."}
        </p>
        {bandTitle ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge--info" data-prefill-band={bandId}>
              from map · {bandTitle}
            </span>
            <button type="button" className="chip" onClick={() => setBandId(undefined)}>
              <XIcon size={12} />
              Plain seeds instead
            </button>
          </div>
        ) : null}
        <input className="desk-input" placeholder="Module name" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Module name" />
        <input className="desk-input" placeholder="Skill target" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill target" />
        <textarea className="desk-input min-h-20" value={seeds} onChange={(e) => setSeeds(e.target.value)} aria-label="Seeds" />
        <button className="opt opt--primary" type="submit">
          <SparklesIcon size={16} />
          Create and put on path
        </button>
        {made ? <p className="text-label text-emerald-200">{made}</p> : null}
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Sheet (full gambit)
// ---------------------------------------------------------------------------

function GambitCard({ child }: { child: Child }) {
  const house = useHouse();
  const dims = useMemo(() => allDimensions().map((d) => rollupDimension(child, house.state.attempts, d)), [child, house.state.attempts]);
  const withPlay = dims.filter((d) => d.hits + d.misses + d.pendingSpeak > 0 || d.avgMs);
  const quiet = dims.filter((d) => !withPlay.includes(d));
  return (
    <>
      <Link href={`/parent/grades?kid=${child.id}`} className="desk-card flex min-h-16 items-center gap-4 p-4">
        <span className="orb h-11 w-11 shrink-0 text-white" style={{ ["--orb-a" as string]: "#34d399", ["--orb-b" as string]: "#059669" }}>
          <CompassIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-black text-white">Grading page</span>
          <span className="muted block text-label">Every module, every function. Tap a module for the green sheet.</span>
        </span>
        <ArrowRightIcon size={18} className="shrink-0 text-emerald-200" />
      </Link>
      <Card title="Full gambit" icon={<SheetIcon size={18} />} sub="Lessons only — the map and the scout have their own cards. Real numbers or nothing.">
        {withPlay.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {withPlay.map((d) => {
              const total = d.hits + d.misses;
              const pct = total ? Math.round((d.hits / total) * 100) : undefined;
              return (
                <div key={d.key} className="desk-tile p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body font-bold text-white">{d.label}</p>
                    <span className={statusBadge(d.status)}>{d.status.replace("-", " ")}</span>
                  </div>
                  {total > 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Bar pct={pct} label={`${d.hits} of ${total}`} className="flex-1" />
                      <span className="muted text-label tabular-nums">
                        {d.hits}/{total}
                      </span>
                    </div>
                  ) : null}
                  <p className="muted mt-2 text-label">{d.note}</p>
                </div>
              );
            })}
          </div>
        ) : null}
        {quiet.length ? (
          <p className="muted mt-3 text-label">
            {withPlay.length ? "No attempts yet: " : "No attempts yet in any function: "}
            {quiet.map((d) => d.label.toLowerCase()).join(", ")}.
          </p>
        ) : null}
        <p className="muted mt-3 text-label">Pass / fail per module is parent-door language. The kid never hears fail.</p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsCards({ child, onReset, onImport }: { child: Child; onReset: () => void; onImport: () => void }) {
  const house = useHouse();
  return (
    <>
      <Card title="This kid" icon={<BoltIcon size={18} />}>
        <div className="flex flex-wrap gap-2">
          {child.status === "waiting" ? (
            <button type="button" className="chip chip--on" onClick={() => house.setStatus(child.id, "active")}>
              <BoltIcon size={14} />
              Activate {child.name}
            </button>
          ) : (
            <button type="button" className="chip" onClick={() => house.setStatus(child.id, "waiting")}>
              <ClockIcon size={14} />
              Pause to waiting
            </button>
          )}
        </div>
        <dl className="muted mt-3 grid gap-1 text-label">
          <div className="flex gap-2">
            <dt>Birthday</dt>
            <dd className="text-slate-200">{child.birthday}</dd>
          </div>
        </dl>
      </Card>
      {child.track === "letters" || child.parentUnlockedWords ? <UnlockCard child={child} /> : null}
      <VoiceCard />
      <AddChild />
      <Card title="House data" icon={<DownloadIcon size={18} />} sub="Saved on this device only. Copy the house to move it to the tablet.">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="chip"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(exportHouse(house.state));
              } catch {
                window.prompt("Copy the house:", exportHouse(house.state));
              }
            }}
          >
            <DownloadIcon size={14} />
            Copy house
          </button>
          <button type="button" className="chip" onClick={onImport}>
            Paste a house
          </button>
          <button type="button" className="chip chip--bad" onClick={onReset}>
            <RefreshIcon size={14} />
            Reset house
          </button>
        </div>
        <p className="muted mt-3 text-label tabular-nums">Build {BUILD_STAMP}. Hard refresh is in the strip at the bottom.</p>
      </Card>
    </>
  );
}

function UnlockCard({ child }: { child: Child }) {
  const house = useHouse();
  return (
    <Card title={`${child.name}: words`} icon={<LockIcon size={18} />} sub="Words open only when the map says ready AND you confirm.">
      <p className="text-label text-slate-300">
        <span className={`badge ${child.readyForPrintWords ? "badge--good" : "badge--muted"}`}>{child.readyForPrintWords ? "Map says ready" : "Map says not yet"}</span>{" "}
        {child.readyForPrintWords ? "Letter sounds and first sounds are both known." : "Letter sounds and first sounds must both be known on the map or a scout."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="chip chip--on" disabled={!child.readyForPrintWords} onClick={() => house.unlockWords(child.id, !child.parentUnlockedWords)}>
          {child.parentUnlockedWords ? "Park back on letters" : "Confirm first word module"}
        </button>
        <span className={`badge ${wordsUnlocked(child) ? "badge--good" : "badge--muted"}`}>{wordsUnlocked(child) ? "Words unlocked" : "Letters and sounds only"}</span>
      </div>
    </Card>
  );
}

function VoiceCard() {
  const [muted, setMuted] = useState(isVoiceMuted);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hearNote, setHearNote] = useState<string | null>(null);

  useEffect(() => {
    void voiceStatus().then((status) => setConfigured(status.configured));
  }, []);

  const hear = (play: () => void) => {
    setHearNote(null);
    play();
    window.setTimeout(() => {
      const err = voiceLastError();
      if (err) setHearNote(err);
    }, 1200);
  };

  return (
    <Card title="Voiceover" icon={<SpeakerIcon size={18} />} sub="The teacher reads every prompt. On a speak step the ear opens once after she finishes; Again replays her.">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`chip ${muted ? "" : "chip--on"}`}
          onClick={() => {
            const next = !muted;
            setVoiceMuted(next);
            setMuted(next);
          }}
        >
          {muted ? "Voice off" : "Voice on"}
        </button>
        <button type="button" className="chip" onClick={() => hear(() => speakPrompt("Stamp the one that says /s/."))}>
          Hear a prompt
        </button>
        <button type="button" className="chip" onClick={() => hear(() => speakPhoneme("/s/"))}>
          Hear /s/
        </button>
      </div>
      {configured === false ? (
        <p className="mt-3 text-label text-amber-200">
          Natural voice is not set up. Add <span className="font-mono">OPENAI_API_KEY</span> on Vercel so the kids hear a clear teacher. They still see the words.
        </p>
      ) : null}
      {hearNote ? <p className="mt-3 text-label text-amber-200">{hearNote}</p> : null}
    </Card>
  );
}

function AddChild() {
  const { addChild } = useHouse();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [waiting, setWaiting] = useState(true);
  return (
    <form
      className="desk-card grid gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name || !birthday) return;
        addChild(name, birthday, waiting ? "waiting" : "active");
        setName("");
      }}
    >
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
          <PlusIcon size={18} />
        </span>
        <h3 className="text-body font-black text-white">Add a child</h3>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="desk-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <input className="desk-input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} aria-label="Birthday" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-body text-slate-300">
          <input type="checkbox" className="h-5 w-5 accent-indigo-400" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} />
          Start as waiting
        </label>
        <button className="chip chip--on" type="submit">
          <CheckIcon size={14} />
          Save
        </button>
      </div>
    </form>
  );
}

function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const house = useHouse();
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Paste a house">
      <p className="muted text-label">Paste what “Copy house” produced on the other device. This replaces the house on this device.</p>
      <textarea className="desk-input mt-3 min-h-32 font-mono text-micro" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="House JSON" />
      {err ? <p className="mt-2 text-label text-rose-300">{err}</p> : null}
      <button
        type="button"
        className="opt opt--primary mt-3"
        onClick={() => {
          if (house.importHouse(raw)) {
            onClose();
            router.refresh();
          } else setErr("That is not a house this build understands.");
        }}
      >
        Replace this device&apos;s house
      </button>
    </Sheet>
  );
}

