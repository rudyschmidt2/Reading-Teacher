"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstallHint } from "@/components/Pwa";
import {
  phonemeHint,
  speak,
  stopSpeech,
  unlockKidMic,
  useHeard,
  useLessonListen,
  useListening,
} from "@/lib/audio";
import {
  SCOUT_MY1,
  SCOUT_RH1,
  THEMES,
  VOWEL_FACE,
  themeOf,
  wordsUnlocked,
} from "@/lib/catalog";
import {
  PAUSED_KID_LINE,
  SITTING_CAP,
  currentBand,
  currentProbe,
  emptyDiagnostic,
  progressSummary,
} from "@/lib/diagnostic";
import { dealChoices, dealTiles } from "@/lib/deal";
import { paintChoices, paintCorrectId, sittingHost, skinMiss, skinWin, trayHint } from "@/lib/theme-skins";
import { kidNextModule } from "@/lib/grades";
import { nextSameSkill } from "@/lib/skip-stuck";
import { useHouse } from "@/lib/store";
import { tripSessionLength } from "@/lib/trip";
import type {
  Choice,
  LessonItem,
  PlacementItem,
  PlayKind,
  ThemeId,
  Tile,
  Vowel,
  Widget,
} from "@/lib/types";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  HandIcon,
  LockIcon,
  MicIcon,
  SparklesIcon,
  HomeIcon,
  ShieldIcon,
  SpeakerIcon,
  StarIcon,
  TelescopeIcon,
} from "@/components/Icons";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const CONFETTI_COLORS = ["#fde047", "#f472b6", "#22d3ee", "#a3e635", "#fb923c", "#c084fc", "#ffffff"];

function Confetti({ count = 18 }: { count?: number }) {
  return (
    <span className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, k) => {
        const angle = (k / count) * Math.PI * 2;
        const dist = 90 + (k % 3) * 40;
        const style = {
          "--x": `${Math.cos(angle) * dist}px`,
          "--y": `${Math.sin(angle) * dist - 30}px`,
          "--c": CONFETTI_COLORS[k % CONFETTI_COLORS.length],
          "--d": `${(k % 4) * 40}ms`,
        } as CSSProperties;
        return <span key={k} style={style} />;
      })}
    </span>
  );
}

function HonestBanner({ text, party }: { text: string; party?: boolean }) {
  return (
    <div role="status" className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 mx-auto max-w-lg">
      <div className={`banner relative text-3xl ${party ? "party banner--win" : "wobble banner--miss"}`}>
        {party ? <Confetti /> : null}
        <span className="relative inline-flex items-center justify-center gap-3">
          {party ? <SparklesIcon size={28} className="shrink-0" /> : null}
          {text}
        </span>
      </div>
    </div>
  );
}

function Dots({ total, current }: { total: number; current: number }) {
  if (total <= 1) return null;
  return (
    <div className="dots mt-3" aria-label={`Step ${Math.min(current + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, k) => (
        <span key={k} className={`dot ${k < current ? "dot--done" : k === current ? "dot--now" : ""}`} />
      ))}
    </div>
  );
}

function coachLine(kind?: PlayKind, widget?: Widget, listening?: boolean) {
  if (kind === "speak") return listening ? "I'm listening. Just say it." : "Your turn. Say it out loud.";
  if (widget === "trace") return "Trace it with your finger.";
  if (kind === "drag") return listening ? "Park the pieces. Say again if you missed it." : "Park the pieces.";
  return listening ? "Tap one. Say again if you missed it." : "Tap one.";
}

function PromptCard({
  eyebrow,
  prompt,
  kind,
  widget,
}: {
  eyebrow?: string;
  prompt: string;
  kind?: PlayKind;
  widget?: Widget;
}) {
  const listening = useListening();
  return (
    <section className="glass rise-in mx-auto mt-4 max-w-lg rounded-[28px] px-5 py-5 text-center">
      {eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p> : null}
      <button type="button" onClick={() => speak(prompt)} className="display title-pop mt-1 w-full text-4xl leading-tight">
        {prompt}
      </button>
      <p className="mt-3 text-lg font-black text-white">{coachLine(kind, widget, listening)}</p>
    </section>
  );
}

function VowelFace({ vowel }: { vowel: Vowel }) {
  const face = VOWEL_FACE[vowel];
  return (
    <span
      className={`inline-flex h-16 min-w-16 items-center justify-center rounded-2xl text-3xl font-black shadow-[0_4px_0_rgb(0_0_0/0.25)] vowel-${vowel}`}
      title={`${face.name} ${face.sound}`}
    >
      {vowel}
      <sup className="ml-1 text-lg">{face.mark}</sup>
    </span>
  );
}

function TileChip({
  tile,
  onPick,
}: {
  tile: Tile;
  onPick: () => void;
}) {
  if (tile.kind === "vowel" && tile.vowel) {
    return (
      <button type="button" onClick={onPick} className="fat-card bounce-in flex min-h-28 min-w-28 flex-col items-center justify-center p-3">
        <VowelFace vowel={tile.vowel} />
        {tile.label.length > 1 ? <span className="text-3xl font-black">{tile.label.slice(1)}</span> : null}
        <span className="mt-1 text-xs font-extrabold uppercase tracking-wider opacity-60">
          {tile.label.length > 1 ? tile.label : VOWEL_FACE[tile.vowel].sound}
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onPick} className="fat-card bounce-in flex min-h-28 min-w-28 flex-col items-center justify-center p-3 text-4xl font-black">
      {tile.label}
      {tile.kind === "sound" ? <span className="mt-1 text-xs font-extrabold uppercase tracking-wider opacity-60">sound</span> : null}
    </button>
  );
}

function ChoiceGrid({
  choices,
  correctId,
  seed,
  avoidSlot,
  onPick,
  shaken,
}: {
  choices: Choice[];
  correctId?: string;
  /** Changes per question (and per retry) so the cards get re-dealt. */
  seed: string;
  /** Slot the right answer sat in last time; it will not land there again. */
  avoidSlot?: number;
  onPick: (id: string, correctSlot: number) => void;
  shaken?: string;
}) {
  const { dealt, correctSlot } = useMemo(() => dealChoices(choices, correctId, seed, avoidSlot), [choices, correctId, seed, avoidSlot]);
  return (
    <div className={`grid gap-4 ${dealt.length > 3 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
      {dealt.map((c, k) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id, correctSlot)}
          className={`fat-card flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-4xl font-black ${
            shaken === c.id ? "wobble" : `bounce-in stagger-${Math.min(k + 1, 7)}`
          }`}
        >
          {c.emoji ? <span className="emoji-3d text-6xl">{c.emoji}</span> : null}
          <span className={c.emoji ? "text-2xl" : ""}>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

function TracePad({ letter, onDone }: { letter: string; onDone: (ok: boolean) => void }) {
  const [marks, setMarks] = useState(0);
  const traced = marks > 3;
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="glass-strong relative mx-auto flex h-60 w-full max-w-sm select-none flex-col items-center justify-center overflow-hidden rounded-[32px] text-white"
        onPointerMove={(e) => {
          if (e.buttons) setMarks((n) => n + 1);
        }}
        onClick={() => setMarks((n) => n + 4)}
      >
        <span
          className="display pointer-events-none text-[9rem] leading-none text-transparent transition-all"
          style={{
            WebkitTextStroke: traced ? "0px" : "3px rgb(255 255 255 / 0.9)",
            color: traced ? "white" : "transparent",
            textShadow: traced ? "0 0 30px var(--glow)" : "none",
          }}
        >
          {letter}
        </span>
        <span className="absolute bottom-4 inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-sm font-extrabold">
          <HandIcon size={16} />
          {traced ? "Nice tracing!" : `Trace ${letter} with your finger`}
        </span>
      </button>
      <button
        type="button"
        className="btn-glow mx-auto flex items-center gap-2 px-7 py-3.5 text-xl font-black"
        onClick={() => onDone(marks > 3)}
      >
        <CheckIcon size={22} />
        I traced it
      </button>
    </div>
  );
}

function SpeakPanel({ onParent }: { onParent: () => void }) {
  const listening = useListening();
  const heard = useHeard();
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`orb orb-ring h-40 w-40 flex-col gap-1 text-white ${listening ? "glow-pulse" : ""}`}
        style={{ ["--orb-a" as string]: "#fb7185", ["--orb-b" as string]: "#e11d48" }}
        aria-live="polite"
      >
        <MicIcon size={56} />
        <span className="text-lg font-black">{listening ? "I'm listening" : "Your turn"}</span>
      </div>
      {heard ? (
        <p className="glass rounded-full px-4 py-2 text-lg">
          Heard: <span className="font-black">{heard}</span>
        </p>
      ) : null}
      <button type="button" onClick={onParent} className="btn-ghost px-5 py-3 text-lg font-bold">
        Parent will listen
      </button>
    </div>
  );
}

function DragBoard({
  item,
  onDone,
  themeId,
}: {
  item: LessonItem;
  onDone: (ok: boolean) => void;
  themeId?: ThemeId;
}) {
  const [filled, setFilled] = useState<Record<string, Tile | undefined>>({});
  const [focus, setFocus] = useState(0);
  const [shake, setShake] = useState(false);
  const slots = item.slots ?? [];
  const used = new Set(Object.values(filled).map((t) => t?.id));
  const tiles = useMemo(() => dealTiles(item.tiles ?? [], item.id), [item]);

  const drop = (tile: Tile) => {
    const slot = slots[focus];
    if (!slot) return;
    if (tile.id === slot.correctTileId) {
      const next = { ...filled, [slot.id]: tile };
      setFilled(next);
      const nextEmpty = slots.findIndex((s) => !next[s.id]);
      setFocus(nextEmpty === -1 ? slots.length : nextEmpty);
      if (slots.every((s) => next[s.id]?.id === s.correctTileId)) onDone(true);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      onDone(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`flex justify-center gap-3 ${shake ? "wobble" : ""}`}>
        {slots.map((slot, i) => {
          const tile = filled[slot.id];
          const state = tile ? "slot--filled" : i === focus ? "slot--focus" : "";
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setFocus(i)}
              className={`slot flex h-28 w-28 items-center justify-center text-4xl font-black ${state}`}
              style={slot.glowVowel ? { boxShadow: `inset 0 0 0 5px ${VOWEL_FACE[slot.glowVowel].color}` } : undefined}
            >
              {tile ? (
                tile.kind === "vowel" && tile.vowel ? <VowelFace vowel={tile.vowel} /> : tile.label
              ) : i === focus ? (
                <ArrowDownIcon size={36} className="animate-bounce text-white/90" />
              ) : (
                ""
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {tiles.filter((t) => !used.has(t.id)).map((tile) => (
          <TileChip key={tile.id} tile={tile} onPick={() => drop(tile)} />
        ))}
      </div>
      <p className="mx-auto max-w-sm text-center text-sm font-bold text-white/70">{trayHint(themeId, slots.length)}</p>
    </div>
  );
}

function asLesson(item: PlacementItem): LessonItem {
  return {
    id: item.id,
    kind: "tap",
    widget: item.widget,
    prompt: item.prompt,
    parentHint: item.parentHint,
    dimension: item.dimension,
    choices: item.choices,
    correctId: item.correctId,
  };
}

function StageHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <header className="rise-in text-center">
      {eyebrow ? (
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/85">
          <SparklesIcon size={14} className="text-amber-300" />
          {eyebrow}
        </span>
      ) : null}
      <h1 className="display title-pop mt-3 text-5xl font-bold leading-none">{title}</h1>
      {sub ? <p className="mt-3 text-lg font-bold text-white/80">{sub}</p> : null}
    </header>
  );
}

export function ThemePicker({ kidId }: { kidId: string }) {
  const { kid, pickTheme, ready } = useHouse();
  const router = useRouter();
  const child = kid(kidId);
  const themePrompt = ready && child && child.status !== "waiting" ? "Pick today's game." : undefined;
  useLessonListen({ prompt: themePrompt, enabled: Boolean(themePrompt) });

  useEffect(() => {
    if (themePrompt) speak(themePrompt);
    return () => stopSpeech();
  }, [themePrompt]);

  useEffect(() => {
    if (ready && child?.status === "waiting") router.replace(`/kids/${kidId}/waiting`);
  }, [ready, child, kidId, router]);

  if (!ready) return <Loading />;
  if (!child) return <Loading text="Missing kid." />;
  if (child.status === "waiting") return null;

  const choose = (id: ThemeId) => {
    unlockKidMic();
    pickTheme(kidId, id);
    speak(THEMES.find((t) => t.id === id)?.label ?? "Let's play");
    if (!child.diagnosticReport) router.push(`/kids/${kidId}/place`);
    else router.push(`/kids/${kidId}/play`);
  };

  return (
    <main className="kid-stage theme-planets-space px-4 py-8" onPointerDown={unlockKidMic}>
      <StageHeading eyebrow={`${child.name}'s pick`} title="Today's skin" sub="Smash one. You can pick a different one tomorrow." />
      <div className="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-4 md:max-w-3xl md:grid-cols-2">
        {THEMES.map((t, k) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            className={`fat-card rise-in stagger-${Math.min(k + 1, 7)} group relative flex items-center gap-4 overflow-hidden p-5 text-left theme-${t.id}`}
          >
            <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-40 blur-2xl" style={{ background: "var(--accent)" }} />
            <span className="orb h-20 w-20 shrink-0 text-5xl">
              <span className="emoji-3d">{t.emoji}</span>
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="display block text-2xl leading-none sm:text-3xl">{t.label}</span>
              <span className="mt-1.5 block truncate text-sm font-extrabold uppercase tracking-wide opacity-60">{t.host}</span>
              <span className="mt-1 block text-sm font-semibold leading-snug opacity-75">{t.flavor}</span>
            </span>
            <ArrowRightIcon size={26} className="shrink-0 opacity-40 transition-all group-hover:translate-x-1 group-hover:opacity-80" />
          </button>
        ))}
      </div>
    </main>
  );
}

export function DiagnosticSession({ kidId }: { kidId: string }) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);

  const progress = child ? child.diagnostic ?? emptyDiagnostic(child.track) : undefined;
  const probe = progress ? currentProbe(progress) : undefined;
  const band = progress ? currentBand(progress) : undefined;
  const summary = progress ? progressSummary(progress) : undefined;

  const [banner, setBanner] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [shaken, setShaken] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [retry, setRetry] = useState(false);
  const [lastSlot, setLastSlot] = useState<number>();
  const [leaving, setLeaving] = useState(false);
  const sitting = useRef(0);
  const start = useRef(0);
  useLessonListen({ prompt: probe?.prompt, enabled: Boolean(probe) && !banner });

  useEffect(() => {
    if (probe) speak(probe.prompt);
    start.current = Date.now();
    return () => stopSpeech();
  }, [probe]);

  if (!house.ready || !child || !progress) return <Loading />;
  if (child.status === "waiting") return null;
  if (!child.themeToday || child.themeDate !== today()) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }
  if (leaving) return null;
  if (child.diagnosticReport || !probe) {
    router.replace(`/kids/${kidId}/play`);
    return null;
  }

  const seed = `${kidId}-${today()}`;
  const host = sittingHost(theme.id, seed);
  const leave = (line: string, finished: boolean) => {
    setLeaving(true);
    router.push(`/kids/${kidId}/done?kind=place${finished ? "&finished=1" : ""}&line=${encodeURIComponent(line)}`);
  };

  const onPick = (choiceId: string, correctSlot: number) => {
    if (!probe || locked) return;
    const ok = choiceId === paintCorrectId(probe, theme.id);
    setLocked(true);
    setLastSlot(correctSlot);
    const isRetry = retry;
    house.recordAttempt({
      kidId: child.id,
      moduleId: "placement",
      itemId: probe.id,
      version: isRetry ? 1 : 0,
      kind: "tap",
      dimension: probe.dimension,
      correct: ok,
      ms: Date.now() - start.current,
      kidSaw: ok ? "star" : "not that one",
      source: "placement",
    });
    if (ok) {
      setParty(true);
      setBanner(skinWin(theme.id, theme.win, seed));
      house.addStars(child.id, 1);
    } else {
      setShaken(choiceId);
      setBanner(skinMiss(theme.id, theme.miss, seed));
    }
    window.setTimeout(() => {
      setParty(false);
      setShaken(undefined);
      // One honest retry for morale; only the first answer counts on the map.
      if (!ok && !isRetry) {
        setRetry(true);
        setLocked(false);
        return;
      }
      setBanner(null);
      setLocked(false);
      setRetry(false);
      sitting.current += 1;
      const firstAnswerOk = ok && !isRetry;
      const result = house.answerDiagnostic(child.id, probe, firstAnswerOk, Date.now() - start.current);
      if (result.finished && result.report) {
        leave(result.report.kidLine, true);
        return;
      }
      if (sitting.current >= SITTING_CAP) leave(PAUSED_KID_LINE, false);
    }, ok ? 1100 : 1600);
  };

  const lesson = asLesson(probe);
  lesson.choices = paintChoices(probe, theme.id);
  lesson.correctId = paintCorrectId(probe, theme.id);

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-4 pb-36`} onPointerDown={unlockKidMic}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} />
      <Dots total={band?.probes.length ?? 0} current={progress.cursor?.probe ?? 0} />
      <p className="mt-2 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-white/60">
        Map {summary ? summary.bandIndex + 1 : 1} of {summary?.bandCount ?? 1}
      </p>
      <PromptCard eyebrow={band?.kidEyebrow ?? "Warm-up"} prompt={lesson.prompt} kind="tap" widget={lesson.widget} />
      {banner ? <HonestBanner text={banner} party={party} /> : null}
      <div className="mx-auto mt-6 max-w-lg">
        <ChoiceGrid
          key={`${probe.id}-${retry ? 1 : 0}`}
          choices={lesson.choices ?? []}
          correctId={lesson.correctId}
          seed={`${seed}-${probe.id}-${retry ? 1 : 0}`}
          avoidSlot={lastSlot}
          onPick={onPick}
          shaken={shaken}
        />
      </div>
      <PlayDock prompt={lesson.prompt} hint={lesson.parentHint} onEnough={() => leave(PAUSED_KID_LINE, false)} />
    </main>
  );
}

function PlayDock({
  prompt,
  hint,
  onEnough,
}: {
  prompt: string;
  hint?: string;
  onEnough?: () => void;
}) {
  const hold = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  const startHold = () => {
    if (!onEnough) return;
    setHolding(true);
    hold.current = window.setTimeout(onEnough, 1600);
  };
  const endHold = () => {
    setHolding(false);
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  };

  return (
    <nav className="play-dock" aria-label="Play tools">
      <div className="play-dock__bar">
        <button type="button" className="play-dock__again" onClick={() => speak(prompt)}>
          <SpeakerIcon size={26} />
          Again
        </button>
        {onEnough ? (
          <button
            type="button"
            className="play-dock__enough"
            aria-label="Hold for that's enough."
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className={`hold-ring relative grid h-12 w-12 shrink-0 place-items-center rounded-full ${holding ? "hold-ring--go" : ""}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1b1440] text-white">
                <HomeIcon size={22} />
              </span>
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-lg font-black leading-none">{holding ? "Keep holding…" : "That's enough"}</span>
              <span className="mt-1 block text-xs font-extrabold uppercase tracking-wide text-white/70">
                {holding ? "Almost…" : "Hold to finish"}
              </span>
              <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <span className={`block h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 ${holding ? "hold-fill" : "w-0"}`} />
              </span>
            </span>
          </button>
        ) : null}
      </div>
      {hint ? <p className="sr-only">{phonemeHint(hint)}</p> : null}
    </nav>
  );
}

function KidChrome({
  kidName,
  stars,
  themeId,
  sitting,
  hostEmoji,
}: {
  kidName: string;
  stars: number;
  themeId: ThemeId;
  sitting?: string;
  hostEmoji?: string;
}) {
  const t = themeOf(themeId);
  return (
    <div className="hud glass mx-auto max-w-lg">
      <span className="orb host-float h-14 w-14 shrink-0 text-3xl" aria-label={sitting ?? t.host}>
        <span className="emoji-3d">{hostEmoji ?? t.hostEmoji}</span>
      </span>
      <p className="display min-w-0 flex-1 text-center text-2xl leading-none">
        {kidName}
        <span className="mt-1 block truncate text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-70">{sitting ?? t.host}</span>
      </p>
      <span className="star-pill text-xl">
        <StarIcon size={20} className="text-amber-700 drop-shadow" />
        {stars}
      </span>
    </div>
  );
}

export function DailySession({
  kidId,
  mode,
  moduleId,
}: {
  kidId: string;
  mode: "daily" | "scout" | "try";
  moduleId?: string;
}) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);
  const picked = moduleId ? house.module(moduleId) : undefined;
  const safePicked =
    picked && child && (child.track === "letters" && picked.track === "words" && !wordsUnlocked(child) ? undefined : picked);
  const module = safePicked ?? (child ? kidNextModule(child, house.state) : undefined);
  const [queue, setQueue] = useState<LessonItem[]>([]);
  const [i, setI] = useState(0);
  const [version, setVersion] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [shaken, setShaken] = useState<string>();
  const [wins, setWins] = useState(0);
  const [lastSlot, setLastSlot] = useState<number>();
  const start = useRef(Date.now());
  const usedIds = useRef<Set<string>>(new Set());
  const item = queue[i];
  const spokenRef = useRef<(heard: string, hit: boolean) => void>(() => {});
  useLessonListen({
    prompt: item?.prompt,
    target: item?.kind === "speak" ? item.speakTarget ?? item.word ?? item.letter : undefined,
    onAnswer: (heard, hit) => spokenRef.current(heard, hit),
    enabled: Boolean(item) && !banner,
  });

  useEffect(() => {
    if (!module) return;
    const base = module.items;
    if (mode === "scout") {
      const scout = child?.track === "letters" ? SCOUT_MY1 : SCOUT_RH1;
      usedIds.current = new Set(scout.map((it) => it.id));
      setQueue(scout);
    } else {
      const taps = base.filter((it) => it.kind === "tap");
      const drags = base.filter((it) => it.kind === "drag");
      const speaks = base.filter((it) => it.kind === "speak");
      const traces = base.filter((it) => it.widget === "trace");
      const used = new Set([taps[0]?.id, drags[0]?.id, speaks[0]?.id, traces[0]?.id].filter(Boolean));
      const rest = base.filter((it) => !used.has(it.id));
      const lead = [taps[0], drags[0], speaks[0], traces[0], ...rest].filter(Boolean);
      const width = typeof window !== "undefined" ? window.innerWidth : 1024;
      const session = tripSessionLength(child?.sessionLength ?? "standard", width);
      const n = mode === "try" ? lead.length : session === "shorter" ? 5 : session === "longer" ? 9 : 7;
      const next = lead.slice(0, n);
      usedIds.current = new Set(next.map((it) => it.id));
      setQueue(next);
    }
  }, [module, mode, child?.sessionLength, child?.track]);

  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = Date.now();
    return () => stopSpeech();
  }, [item]);

  if (!house.ready || !child) return <Loading />;
  if (child.status === "waiting") {
    router.replace(`/kids/${kidId}/waiting`);
    return null;
  }
  if (!child.themeToday || child.themeDate !== today()) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }
  if (!child.diagnosticReport && mode === "daily") {
    router.replace(`/kids/${kidId}/place`);
    return null;
  }
  if (!module || !item) {
    return (
      <main className={`kid-stage theme-${theme.id} flex min-h-dvh flex-col items-center justify-center p-6 text-center`}>
        <span className="orb h-24 w-24 text-white">
          <TelescopeIcon size={44} />
        </span>
        <p className="display title-pop mt-6 text-4xl">No module on the path yet.</p>
        <Link href="/parent" className="btn-solid mt-6 inline-flex items-center gap-2 px-6 py-3 text-lg font-black">
          Parent path
          <ArrowRightIcon size={20} />
        </Link>
      </main>
    );
  }

  const seed = `${kidId}-${today()}`;
  const host = sittingHost(theme.id, seed);
  const blockedWord = !wordsUnlocked(child) && (item.dimension === "words" || item.dimension === "sentences" || Boolean(item.word && item.slots && item.slots.length > 1));
  const rawPlay: LessonItem = blockedWord
    ? {
        id: "safe-letter-s",
        kind: "tap",
        widget: "stamp",
        prompt: "Stamp s.",
        dimension: "letterRecognition",
        choices: ["s", "t", "m"].map((l) => ({ id: l, label: l })),
        correctId: "s",
        letter: "s",
      }
    : item;
  const playItem: LessonItem = {
    ...rawPlay,
    choices: paintChoices(rawPlay, theme.id),
    correctId: paintCorrectId(rawPlay, theme.id),
  };

  const after = (ok: boolean, kind: PlayKind, spoken?: { text: string; pending: boolean }) => {
    house.recordAttempt({
      kidId: child.id,
      moduleId: module.id,
      itemId: playItem.id,
      version,
      kind,
      dimension: playItem.dimension,
      correct: ok,
      ms: Date.now() - start.current,
      spokenText: spoken?.text,
      spokenGrade: spoken ? (spoken.pending ? "pending" : ok ? "hit" : "miss") : undefined,
      kidSaw: ok && !spoken?.pending ? "star" : "not that one",
      source: mode === "scout" ? "scout" : mode === "try" ? "try" : "daily",
    });
    if (spoken?.pending) {
      setBanner("Parent will listen.");
      window.setTimeout(() => {
        setBanner(null);
        setVersion(0);
        if (i + 1 >= queue.length) router.push(`/kids/${kidId}/done?kind=${mode}&module=${module.id}`);
        else setI((n) => n + 1);
      }, 700);
      return;
    }
    if (ok) {
      setParty(true);
      setBanner(skinWin(theme.id, theme.win, seed));
      house.addStars(child.id, 1);
      setWins((w) => w + 1);
    } else {
      setBanner(skinMiss(theme.id, theme.miss, seed));
    }
    window.setTimeout(() => {
      setParty(false);
      setShaken(undefined);
      if (ok) {
        setBanner(null);
        const need = mode === "scout" ? 4 : 5;
        if (wins + 1 >= need && i + 1 >= queue.length - 1) {
          if (mode === "scout") {
            const letters = child.track === "letters";
            house.saveScout({
              kidId: child.id,
              pack: letters ? "MY-1" : "RH-1",
              ceiling: letters ? "crowded name" : "short-i CVC",
              floor: letters ? "lookalike" : "beginning blend",
              bands: letters
                ? [
                    { name: "crowded name", tag: "shaky" },
                    { name: "first-sound", tag: "unknown" },
                  ]
                : [
                    { name: "short-i CVC", tag: "shaky" },
                    { name: "beginning blend", tag: "unknown" },
                  ],
              drafts: letters
                ? [{ title: "Lookalike letters", skill: "b/d/p stamp", seeds: "b, d, p", stretch: "stretch-hard" }]
                : [{ title: "Short-i CVC", skill: "sit, pin, tin", seeds: "sit, pin, tin", stretch: "stretch-hard" }],
              readyForPrintWords: false,
              status: "pending",
            });
          }
          router.push(`/kids/${kidId}/done?kind=${mode}&module=${module.id}`);
          return;
        }
        setVersion(0);
        setI((n) => Math.min(n + 1, queue.length - 1));
        if (i + 1 >= queue.length) router.push(`/kids/${kidId}/done?kind=${mode}&module=${module.id}`);
      } else if (version + 1 >= 2) {
        const bank = mode === "scout" ? (child.track === "letters" ? SCOUT_MY1 : SCOUT_RH1) : module.items;
        const alt = nextSameSkill(bank, item, usedIds.current);
        if (alt) {
          usedIds.current.add(alt.id);
          setQueue((q) => {
            const copy = [...q];
            copy[i] = alt;
            return copy;
          });
          setVersion(0);
          setBanner(null);
        } else {
          setVersion((v) => v + 1);
        }
      } else {
        setVersion((v) => v + 1);
      }
    }, ok ? 1100 : 1600);
  };

  spokenRef.current = (heard, hit) => after(hit, "speak", { text: heard, pending: false });

  const eyebrow = mode === "scout" ? "Secret tunnel" : mode === "try" ? "Try run" : "Today's adventure";

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-4 pb-36`} onPointerDown={unlockKidMic}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} />
      <Dots total={queue.length} current={i} />
      <PromptCard eyebrow={eyebrow} prompt={playItem.prompt} kind={playItem.kind} widget={playItem.widget} />
      {banner ? <HonestBanner text={banner} party={party} /> : null}
      <div className="mx-auto mt-6 max-w-lg">
        {playItem.kind === "tap" && playItem.widget !== "trace" ? (
          <ChoiceGrid
            key={`${playItem.id}-${version}`}
            choices={playItem.choices ?? []}
            correctId={playItem.correctId}
            seed={`${kidId}-${today()}-${module.id}-${playItem.id}-${version}`}
            avoidSlot={lastSlot}
            shaken={shaken}
            onPick={(id, correctSlot) => {
              const ok = id === playItem.correctId;
              setLastSlot(correctSlot);
              if (!ok) setShaken(id);
              after(ok, "tap");
            }}
          />
        ) : null}
        {playItem.kind === "drag" ? <DragBoard item={playItem} themeId={theme.id} onDone={(ok) => after(ok, "drag")} /> : null}
        {playItem.widget === "trace" ? <TracePad letter={playItem.letter ?? playItem.correctId ?? "s"} onDone={(ok) => after(ok, "tap")} /> : null}
        {playItem.kind === "speak" ? (
          <SpeakPanel onParent={() => after(false, "speak", { text: "parent-listen", pending: true })} />
        ) : null}
      </div>
      <PlayDock prompt={playItem.prompt} hint={playItem.parentHint} onEnough={() => router.push(`/kids/${kidId}/done?kind=${mode}`)} />
    </main>
  );
}

const KID_GRADIENTS: [string, string][] = [
  ["#f59e0b", "#ec4899"],
  ["#22d3ee", "#6366f1"],
  ["#a3e635", "#059669"],
  ["#c084fc", "#7c3aed"],
  ["#fb7185", "#f97316"],
];

export function KidPicker() {
  const { state, ready } = useHouse();
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const startHold = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      router.push("/parent");
    }, 1600);
  };
  const endHold = () => {
    setHolding(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  if (!ready) return <Loading />;
  return (
    <main className="kid-stage theme-planets-space px-4 py-8 pb-40">
      <StageHeading eyebrow="Player select" title="Who's reading?" sub="Tap a face. Stars, not grades." />
      <InstallHint />
      <div className="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-4">
        {state.kids.map((k, idx) => {
          const waiting = k.status === "waiting";
          const [a, b] = KID_GRADIENTS[idx % KID_GRADIENTS.length];
          return (
            <Link
              key={k.id}
              href={waiting ? `/kids/${k.id}/waiting` : `/kids/${k.id}/theme`}
              className={`fat-card rise-in stagger-${Math.min(idx + 1, 7)} group flex items-center gap-4 p-5 ${waiting ? "saturate-50" : ""}`}
              style={waiting ? ({ "--card": "#ece9f4" } as CSSProperties) : undefined}
            >
              <span
                className="orb orb-ring display h-20 w-20 shrink-0 text-5xl text-white"
                style={{ ["--orb-a" as string]: waiting ? "#94a3b8" : a, ["--orb-b" as string]: waiting ? "#475569" : b }}
              >
                {waiting ? <LockIcon size={36} /> : k.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-4xl leading-none">{k.name}</span>
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide opacity-60">
                  {waiting ? null : <BoltIcon size={14} />}
                  {waiting ? "Coming later" : k.track === "letters" ? "Letters and sounds" : "Word adventure"}
                </span>
              </span>
              {waiting ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-900/80 px-3 py-1.5 text-sm font-extrabold text-white">
                  <LockIcon size={14} />
                  Soon
                </span>
              ) : (
                <span className="star-pill text-lg">
                  <StarIcon size={18} className="text-amber-700" />
                  {k.stars}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <nav className="grades-dock" aria-label="Parent grades">
        <button
          type="button"
          className="grades-dock__hold"
          aria-label="Hold to open the grades page."
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className={`hold-ring relative grid h-12 w-12 shrink-0 place-items-center rounded-full ${holding ? "hold-ring--go" : ""}`}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1b1440] text-white">
              <ShieldIcon size={22} />
            </span>
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-lg font-black leading-none">{holding ? "Keep holding…" : "Grades"}</span>
            <span className="mt-1 block text-xs font-extrabold uppercase tracking-wide text-white/70">
              {holding ? "Almost…" : "Hold to open the desk"}
            </span>
            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <span className={`block h-full rounded-full bg-gradient-to-r from-amber-300 to-fuchsia-400 ${holding ? "hold-fill" : "w-0"}`} />
            </span>
          </span>
        </button>
      </nav>
    </main>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <main className="kid-stage theme-planets-space flex min-h-dvh items-center justify-center p-8">
      <p className="glass inline-flex items-center gap-3 rounded-full px-5 py-3 text-lg font-black text-white">
        <span className="h-3 w-3 animate-pulse rounded-full bg-amber-300" />
        {text}
      </p>
    </main>
  );
}
