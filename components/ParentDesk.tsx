"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { isVoiceMuted, setVoiceMuted, speakPhoneme, speakPrompt, voiceStatus } from "@/lib/audio";
import { ageFromBirthday, THEMES, wordsUnlocked } from "@/lib/catalog";
import { allDimensions, kidNextModule, moduleStats, rollupDimension, verdictKey, type DimensionStatus } from "@/lib/grades";
import { scoutDueReason } from "@/lib/scout";
import { useHouse } from "@/lib/store";
import type { Child, ModuleVerdict, Stretch } from "@/lib/types";
import {
  ArrowLeftIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CompassIcon,
  LockIcon,
  MicIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
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

function Card({ title, icon, sub, children, className = "" }: { title?: string; icon?: ReactNode; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`desk-card p-5 ${className}`}>
      {title ? (
        <header className="mb-3 flex items-start gap-3">
          {icon ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">{icon}</span> : null}
          <div>
            <h3 className="text-lg font-black text-white">{title}</h3>
            {sub ? <p className="text-sm text-slate-400">{sub}</p> : null}
          </div>
        </header>
      ) : null}
      {children}
    </section>
  );
}

function statusBadge(status: DimensionStatus) {
  if (status === "live") return "badge badge--good";
  if (status === "shaky") return "badge badge--warn";
  return "badge badge--muted";
}

function KidSelect({ selected, onPick }: { selected?: string; onPick: (id: string) => void }) {
  const { state } = useHouse();
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {state.kids.map((k, idx) => {
        const [a, b] = AVATAR[idx % AVATAR.length];
        const on = selected === k.id;
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => onPick(k.id)}
            className={`chip shrink-0 py-1.5 pl-1.5 pr-4 text-sm ${on ? "chip--on" : ""}`}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white"
              style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            >
              {k.name.slice(0, 1)}
            </span>
            {k.name}
            {k.status === "waiting" ? <LockIcon size={12} className="opacity-70" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function VoiceCard() {
  const [muted, setMuted] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setMuted(isVoiceMuted());
    void voiceStatus().then((status) => setConfigured(status.configured));
  }, []);

  return (
    <div className="desk-card mt-5 p-5">
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
          <SpeakerIcon size={18} />
        </span>
        <h3 className="text-lg font-black text-white">Voiceover</h3>
      </header>
      <p className="mt-2 text-sm text-slate-400">
        After the teacher talks, the app listens by itself. Kids just speak or tap — no start or stop. Say what or again
        to hear the prompt again. Install on the tablet so the microphone stays on.
      </p>
      <button
        type="button"
        className={`chip mt-3 px-4 py-2 text-sm ${muted ? "" : "chip--on"}`}
        onClick={() => {
          const next = !muted;
          setVoiceMuted(next);
          setMuted(next);
        }}
      >
        {muted ? "Voice off" : "Voice on"}
      </button>
      {configured === false ? (
        <p className="mt-3 text-sm text-amber-200">
          Natural voice is not set up. Add <span className="font-mono">OPENAI_API_KEY</span> in{" "}
          <span className="font-mono">.env.local</span> (or the same name on Vercel) so Riley, Hudson, and Myles hear a
          clear teacher. Kids still see the words. See the README.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="chip px-3 py-1.5 text-sm" onClick={() => speakPrompt("Stamp the one that says /s/.")}>
          Hear a prompt
        </button>
        <button type="button" className="chip px-3 py-1.5 text-sm" onClick={() => speakPhoneme("/s/")}>
          Hear /s/
        </button>
      </div>
    </div>
  );
}

function AddChild() {
  const { addChild } = useHouse();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [waiting, setWaiting] = useState(true);
  return (
    <form
      className="desk-card mt-4 grid gap-3 p-5"
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
        <h3 className="text-lg font-black text-white">Add a child</h3>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="desk-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="desk-input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="h-4 w-4 accent-indigo-400" checked={waiting} onChange={(e) => setWaiting(e.target.checked)} />
          Start as waiting
        </label>
        <button className="chip chip--on px-4 py-2 text-sm" type="submit">
          <CheckIcon size={14} />
          Save
        </button>
      </div>
    </form>
  );
}

export function ParentHome() {
  const { state, ready } = useHouse();
  const [id, setId] = useState(state.kids[0]?.id ?? "riley");
  const child = state.kids.find((k) => k.id === id) ?? state.kids[0];
  if (!ready) {
    return (
      <main className="parent-desk flex min-h-dvh items-center justify-center p-6">
        <p className="chip px-4 py-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
          Loading desk…
        </p>
      </main>
    );
  }
  return (
    <main className="parent-desk px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="orb h-14 w-14 text-white" style={{ ["--orb-a" as string]: "#818cf8", ["--orb-b" as string]: "#22d3ee" }}>
              <ShieldIcon size={28} />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-300">Parent door</p>
              <h1 className="text-3xl font-black text-white">House desk</h1>
            </div>
          </div>
          <Link href="/" className="chip px-3 py-2 text-sm">
            <ArrowLeftIcon size={14} />
            Back to doors
          </Link>
        </header>
        <p className="mt-3 text-slate-400">Grades, speed, pass/fail. Kids never see this language.</p>
        <VoiceCard />
        <div className="mt-5">
          <KidSelect selected={child?.id} onPick={setId} />
        </div>
        {child ? <ChildDesk child={child} /> : null}
        <AddChild />
      </div>
    </main>
  );
}

export function ChildDesk({ child }: { child: Child }) {
  const house = useHouse();
  const dims = useMemo(
    () => allDimensions().map((d) => rollupDimension(child, house.state.attempts, d)),
    [child, house.state.attempts],
  );
  const next = kidNextModule(child, house.state);
  const pendingSpeak = house.state.attempts.filter((a) => a.kidId === child.id && a.spokenGrade === "pending");
  const theme = THEMES.find((t) => t.id === child.themeToday);
  const idx = Math.max(0, house.state.kids.findIndex((k) => k.id === child.id));
  const [a, b] = AVATAR[idx % AVATAR.length];

  return (
    <section className="mt-4 space-y-4">
      <div className="desk-card relative overflow-hidden p-5">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="orb display h-16 w-16 shrink-0 text-3xl text-white" style={{ ["--orb-a" as string]: a, ["--orb-b" as string]: b }}>
              {child.name.slice(0, 1)}
            </span>
            <div>
              <h2 className="text-2xl font-black text-white">{child.name}</h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="badge badge--info">Age {ageFromBirthday(child.birthday)}</span>
                <span className={`badge ${child.status === "active" ? "badge--good" : "badge--muted"}`}>{child.status}</span>
                <span className="badge badge--muted">{child.track === "letters" ? "letters / sounds" : "phonics words"}</span>
                <span className="badge badge--warn">
                  <StarIcon size={10} />
                  {child.stars}
                </span>
              </div>
              <dl className="mt-3 grid gap-1 text-sm text-slate-300">
                <div className="flex gap-2">
                  <dt className="text-slate-500">Birthday</dt>
                  <dd>{child.birthday}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Today&apos;s theme</dt>
                  <dd>
                    {theme ? `${theme.emoji} ${theme.label}` : "not picked yet"} <span className="text-slate-500">(kid-picked)</span>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Placement shelf</dt>
                  <dd className="font-bold text-white">{child.status === "waiting" ? "none — waiting" : child.placementGrade ?? "not taken"}</dd>
                </div>
              </dl>
              {child.placementNote ? <p className="mt-2 text-sm text-slate-400">{child.placementNote}</p> : null}
              {child.kidLine ? (
                <p className="mt-1 text-sm text-slate-300">
                  <span className="text-slate-500">What they saw:</span> {child.kidLine}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {child.status === "waiting" ? (
              <button type="button" className="chip chip--on px-4 py-2 text-sm" onClick={() => house.setStatus(child.id, "active")}>
                <BoltIcon size={14} />
                Activate
              </button>
            ) : (
              <button type="button" className="chip px-4 py-2 text-sm" onClick={() => house.setStatus(child.id, "waiting")}>
                <ClockIcon size={14} />
                Pause to waiting
              </button>
            )}
            {child.status === "active" ? (
              <Link href={`/kids/${child.id}/theme`} className="chip chip--go justify-center px-4 py-2 text-sm">
                <PlayIcon size={14} />
                Start today&apos;s session
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {child.status === "waiting" ? (
        <Card>
          <p className="flex items-center gap-3 text-slate-300">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-500/20 text-slate-300">
              <LockIcon size={18} />
            </span>
            Waiting is first-class. No lessons. No fake grade.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Full gambit" icon={<CompassIcon size={18} />} sub="Every dimension, honest and separate.">
            <div className="grid gap-2 md:grid-cols-2">
              {dims.map((d) => {
                const total = d.hits + d.misses;
                const pct = total ? Math.round((d.hits / total) * 100) : 0;
                return (
                  <div key={d.key} className="desk-tile p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-white">{d.label}</p>
                      <span className={statusBadge(d.status)}>{d.status.replace("-", " ")}</span>
                    </div>
                    {total > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="stat-bar flex-1">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {d.hits}/{total}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-400">{d.note}</p>
                    {d.key === "speed" && d.avgMs ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-cyan-300">
                        <ClockIcon size={12} />
                        {d.avgMs} ms average
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="desk-tile border-dashed p-3">
                <p className="font-bold text-white">Pass / fail per module</p>
                <p className="mt-1 text-sm text-slate-400">Parent-door words only. Kid never hears fail.</p>
              </div>
            </div>
          </Card>

          <LastSession childId={child.id} />
          <ScoutCard kidId={child.id} />
          <PathEditor child={child} />

          <Card title="Spoken attempts to grade" icon={<MicIcon size={18} />}>
            {pendingSpeak.length === 0 ? <p className="text-sm text-slate-400">None waiting.</p> : null}
            <ul className="space-y-2">
              {pendingSpeak.map((a) => (
                <li key={a.id} className="desk-tile flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-sm text-slate-200">
                    <span className="font-bold">{a.spokenText || "parent-listen"}</span>
                    <span className="text-slate-500"> · {a.itemId}</span>
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

          <CreateModule child={child} />

          {child.id === "myles" ? (
            <Card title="Myles word unlock" icon={<LockIcon size={18} />} sub="Needs probe ready_for_print_words AND your confirm.">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-400"
                  checked={child.readyForPrintWords}
                  onChange={(e) => house.setReadyForPrintWords(child.id, e.target.checked)}
                />
                Probe flag ready_for_print_words
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="chip chip--on px-4 py-2 text-sm"
                  disabled={!child.readyForPrintWords}
                  onClick={() => house.unlockWords(child.id, !child.parentUnlockedWords)}
                >
                  {child.parentUnlockedWords ? "Park back on letters" : "Confirm first word module"}
                </button>
                <span className={`badge ${wordsUnlocked(child) ? "badge--good" : "badge--muted"}`}>
                  {wordsUnlocked(child) ? "Words unlocked" : "Letters and sounds only"}
                </span>
              </div>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link href={`/kids/${child.id}/play?mode=scout`} className="chip chip--indigo px-4 py-2 text-sm">
              <TelescopeIcon size={14} />
              Send a scout
            </Link>
            {next ? (
              <Link href={`/kids/${child.id}/play?mode=try`} className="chip px-4 py-2 text-sm">
                <PlayIcon size={14} />
                Try {next.title}
              </Link>
            ) : null}
            <button type="button" className="chip chip--bad px-4 py-2 text-sm" onClick={() => house.resetHouse()}>
              <RefreshIcon size={14} />
              Reset house data
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PathEditor({ child }: { child: Child }) {
  const house = useHouse();
  const [stretch, setStretch] = useState<Stretch>(child.stretch);
  return (
    <Card title="Path — not locked" icon={<SparklesIcon size={18} />} sub="Reorder, skip, hold, pass/fail. Default stretch is stretch-hard.">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-black/30 p-1">
          {(["easier", "stretch-hard", "harder"] as Stretch[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip border-transparent ${stretch === s ? "chip--on" : "bg-transparent"}`}
              onClick={() => {
                setStretch(s);
                house.setStretch(child.id, s === "easier" || s === "harder" ? s : "stretch-hard");
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          className="desk-input w-auto rounded-full py-1.5 text-sm"
          value={child.sessionLength}
          onChange={(e) => house.setSession(child.id, e.target.value as Child["sessionLength"])}
        >
          <option value="shorter">Shorter session</option>
          <option value="standard">Standard</option>
          <option value="longer">Longer</option>
        </select>
      </div>
      <ol className="mt-4 space-y-2">
        {child.path.map((id, index) => {
          const mod = house.module(id);
          if (!mod) return null;
          const stats = moduleStats(child.id, mod, house.state.attempts, house.state.verdicts[verdictKey(child.id, id)]);
          return (
            <li key={id} className="desk-tile p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-sm font-black text-indigo-200">{index + 1}</span>
                  <div>
                    <p className="font-bold text-white">{mod.title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{mod.skill}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="badge badge--good">{stats.hits} hits</span>
                      <span className="badge badge--bad">{stats.misses} misses</span>
                      <span className={`badge ${stats.verdict === "pass" ? "badge--good" : stats.verdict === "fail" ? "badge--bad" : "badge--muted"}`}>
                        verdict: {stats.verdict}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/kids/${child.id}/play?mode=try&module=${id}`}
                    className="chip chip--go"
                    onClick={() => {
                      if (!child.themeToday) house.pickTheme(child.id, "planets-space");
                    }}
                  >
                    <PlayIcon size={12} />
                    Try
                  </Link>
                  <button type="button" className="chip px-2" aria-label="Move up" disabled={index === 0} onClick={() => house.moveModule(child.id, index, index - 1)}>
                    <ChevronUpIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="chip px-2"
                    aria-label="Move down"
                    disabled={index === child.path.length - 1}
                    onClick={() => house.moveModule(child.id, index, index + 1)}
                  >
                    <ChevronDownIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="chip px-2"
                    aria-label="Drop from path"
                    onClick={() => house.setPath(child.id, child.path.filter((x) => x !== id))}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
                <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">From sheet</span>
                <button type="button" className="chip" onClick={() => house.applyFromSheet(child.id, id, "done")}>
                  Done
                </button>
                <button type="button" className="chip" onClick={() => house.applyFromSheet(child.id, id, "ease")}>
                  Ease
                </button>
                <button type="button" className="chip" onClick={() => house.applyFromSheet(child.id, id, "harden")}>
                  Harden
                </button>
                <button type="button" className="chip" onClick={() => house.applyFromSheet(child.id, id, "hold")}>
                  Hold
                </button>
                <span className="mx-1 h-4 w-px bg-white/10" />
                <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Verdict</span>
                {(["open", "pass", "fail"] as ModuleVerdict[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${stats.verdict === v ? (v === "pass" ? "chip--good" : v === "fail" ? "chip--bad" : "chip--on") : ""}`}
                    onClick={() => house.setVerdict(child.id, id, v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-5">
        <p className="font-bold text-white">House library</p>
        <p className="text-sm text-slate-400">Every shipped module. Add to this child’s path or try it.</p>
        <ul className="mt-2 space-y-1.5">
          {house.state.modules
            .filter((m) => (child.track === "letters" && !wordsUnlocked(child) ? m.track === "letters" : true))
            .map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                <span className="text-sm text-slate-200">
                  {m.title} <span className="text-slate-500">({m.skill})</span>
                </span>
                <span className="flex gap-1">
                  {!child.path.includes(m.id) ? (
                    <button type="button" className="chip" onClick={() => house.setPath(child.id, [...child.path, m.id])}>
                      <PlusIcon size={12} />
                      Add
                    </button>
                  ) : (
                    <span className="badge badge--info">on path</span>
                  )}
                  <Link
                    href={`/kids/${child.id}/play?mode=try&module=${m.id}`}
                    className="chip chip--go"
                    onClick={() => {
                      if (!child.themeToday) house.pickTheme(child.id, "planets-space");
                    }}
                  >
                    <PlayIcon size={12} />
                    Try
                  </Link>
                </span>
              </li>
            ))}
        </ul>
      </div>
    </Card>
  );
}

function CreateModule({ child }: { child: Child }) {
  const house = useHouse();
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState("");
  const [seeds, setSeeds] = useState(child.track === "letters" ? "s, a, t" : "sat, pin");
  const lockedWords = !wordsUnlocked(child);
  return (
    <form
      className="desk-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        house.createAndAssign(child.id, {
          title,
          skill,
          track: lockedWords ? "letters" : child.track,
          seeds,
        });
        setTitle("");
      }}
    >
      <header className="mb-3 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
          <PlusIcon size={18} />
        </span>
        <div>
          <h3 className="text-lg font-black text-white">Create a module from results</h3>
          <p className="text-sm text-slate-400">
            {lockedWords ? "Myles stays in letters/sounds until unlock." : "Seeds become tap, drag, and speak items."}
          </p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="desk-input" placeholder="Module name" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="desk-input" placeholder="Skill target" value={skill} onChange={(e) => setSkill(e.target.value)} />
      </div>
      <textarea className="desk-input mt-3 min-h-20" value={seeds} onChange={(e) => setSeeds(e.target.value)} />
      <button className="chip chip--on mt-3 px-4 py-2 text-sm" type="submit">
        <SparklesIcon size={14} />
        Create and put on path
      </button>
    </form>
  );
}

function LastSession({ childId }: { childId: string }) {
  const { state } = useHouse();
  const recent = [...state.attempts].reverse().filter((a) => a.kidId === childId).slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <Card title="Last session" icon={<ClockIcon size={18} />} sub="Misses stay after a later hit. Kid heard “not that one,” never fail.">
      <ul className="divide-y divide-white/5 text-sm">
        {recent.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className={`badge ${a.correct ? "badge--good" : "badge--bad"}`}>{a.correct ? "hit" : "miss"}</span>
            <span className="font-bold text-slate-200">{a.itemId}</span>
            <span className="badge badge--muted">{a.kind}</span>
            <span className="text-slate-500">saw “{a.kidSaw}”</span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400">
              <ClockIcon size={12} />
              {a.ms}ms
            </span>
            {a.spokenGrade ? <span className="badge badge--info">speak {a.spokenGrade}</span> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ScoutCard({ kidId }: { kidId: string }) {
  const house = useHouse();
  const child = house.kid(kidId);
  const report = [...house.state.scouts].reverse().find((s) => s.kidId === kidId);
  const dueLine = child ? scoutDueReason(child) : null;
  if (!report && !dueLine) return null;
  return (
    <Card title="Scout map" icon={<TelescopeIcon size={18} />} sub="Daily does not auto-change.">
      {dueLine ? <p className="mb-3 text-sm text-amber-200">{dueLine}</p> : null}
      {report ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <span className="badge badge--info">Pack {report.pack}</span>
            <span className="badge badge--muted">ceiling {report.ceiling}</span>
            <span className="badge badge--muted">floor {report.floor}</span>
            <span className={`badge ${report.status === "approved" ? "badge--good" : report.status === "pending" ? "badge--warn" : "badge--muted"}`}>{report.status}</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5 text-sm">
            {report.bands.map((b) => (
              <li key={b.name} className="desk-tile px-3 py-1.5 text-slate-200">
                {b.name}: <span className={b.tag === "known" ? "text-emerald-300" : b.tag === "shaky" ? "text-amber-300" : "text-slate-400"}>{b.tag}</span>
              </li>
            ))}
          </ul>
          {report.drafts.map((d) => (
            <p key={d.title} className="mt-2 text-sm text-slate-300">
              <span className="text-slate-500">Draft:</span> {d.title} — {d.skill} <span className="text-slate-500">({d.stretch})</span>
            </p>
          ))}
          {report.status === "pending" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="chip chip--on" onClick={() => house.resolveScout(kidId, "approved")}>
                <CheckIcon size={12} />
                Approve drafts
              </button>
              <button type="button" className="chip" onClick={() => house.resolveScout(kidId, "approved", true)}>
                Ease drafts
              </button>
              <button type="button" className="chip" onClick={() => house.resolveScout(kidId, "ignored")}>
                <XIcon size={12} />
                Ignore
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
