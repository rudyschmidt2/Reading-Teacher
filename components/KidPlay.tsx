"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstallHint } from "@/components/Pwa";
import { HoldToOpen, OfflinePill } from "@/components/ui";
import {
  phonemeHint,
  speak,
  stopSpeech,
  tapEar,
  useHeard,
  useLessonListen,
  useListening,
  useMicBlocked,
  useTeacherTalking,
} from "@/lib/audio";
import { SCOUT_MY1, SCOUT_RH1, THEMES, VOWEL_FACE, themeOf } from "@/lib/catalog";
import { elapsedMs, nowMs, todayStamp } from "@/lib/clock";
import {
  PAUSED_KID_LINE,
  SITTING_CAP,
  currentBand,
  currentProbe,
  emptyDiagnostic,
  progressSummary,
  scoutReportFrom,
  type ScoutRow,
} from "@/lib/diagnostic";
import { dealChoices, dealTiles } from "@/lib/deal";
import { planOf } from "@/lib/house";
import { activeModule, buildSession, leadOrder, usableFor, type Session, type SessionEntry } from "@/lib/plan";
import { paintChoices, paintCorrectId, sittingHost, skinMiss, skinWin, trayHint } from "@/lib/theme-skins";
import { nextSameSkill } from "@/lib/skip-stuck";
import { useHouse } from "@/lib/store";
import type {
  AttemptSource,
  Child,
  Choice,
  HouseState,
  LessonItem,
  ModuleDef,
  PlacementItem,
  PlayKind,
  SessionResult,
  ThemeId,
  Tile,
  Vowel,
  Widget,
} from "@/lib/types";
import {
  ArrowDownIcon,
  CheckIcon,
  HandIcon,
  LockIcon,
  MicIcon,
  SparklesIcon,
  HomeIcon,
  SpeakerIcon,
  StarIcon,
  TelescopeIcon,
} from "@/components/Icons";

/** Today's local date, read once per mount so render stays pure. Sessions are minutes long, not days. */
function useToday() {
  const [day] = useState(todayStamp);
  return day;
}

const CONFETTI_COLORS = ["#fde047", "#f472b6", "#22d3ee", "#a3e635", "#fb923c", "#c084fc", "#ffffff"];

function Confetti({ count = 12 }: { count?: number }) {
  return (
    <span className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, k) => {
        const angle = (k / count) * Math.PI * 2;
        const dist = 80 + (k % 3) * 36;
        const style = {
          "--x": `${Math.cos(angle) * dist}px`,
          "--y": `${Math.sin(angle) * dist - 24}px`,
          "--c": CONFETTI_COLORS[k % CONFETTI_COLORS.length],
          "--d": `${(k % 4) * 40}ms`,
        } as CSSProperties;
        return <span key={k} style={style} />;
      })}
    </span>
  );
}

type Tone = "win" | "quiet" | "miss" | "note";
type Banner = { text: string; tone: Tone };

/** Win is gold with confetti; a same-card retry is a quiet gold; a miss is white ("not that one"). Never red. */
function HonestBanner({ banner }: { banner: Banner }) {
  const cls = banner.tone === "win" ? "party banner--win text-card" : banner.tone === "quiet" ? "banner--quiet text-title" : banner.tone === "note" ? "banner--miss text-title" : "wobble banner--miss text-title";
  return (
    <div role="status" className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 mx-auto max-w-lg" data-banner={banner.tone}>
      <div className={`banner relative ${cls}`}>
        {banner.tone === "win" ? <Confetti /> : null}
        <span className="relative inline-flex items-center justify-center gap-3">
          {banner.tone === "win" ? <SparklesIcon size={26} className="shrink-0" /> : null}
          {banner.text}
        </span>
      </div>
    </div>
  );
}

function Dots({ total, current, label }: { total: number; current: number; label?: string }) {
  if (total <= 1 && !label) return null;
  return (
    <div className="mt-2 flex items-center justify-center gap-3" aria-label={`Step ${Math.min(current + 1, total)} of ${total}`}>
      {total > 1 ? (
        <span className="dots">
          {Array.from({ length: Math.min(total, 9) }, (_, k) => (
            <span key={k} className={`dot ${k < current ? "dot--done" : k === current ? "dot--now" : ""}`} />
          ))}
        </span>
      ) : null}
      {label ? <span className="text-label font-extrabold uppercase tracking-[0.08em] text-white/82">{label}</span> : null}
    </div>
  );
}

function coachLine(kind?: PlayKind, widget?: Widget, ear?: { listening: boolean; blocked: boolean; talking: boolean }) {
  if (kind === "speak") {
    if (ear?.blocked) return "Allow the microphone, then tap the ear.";
    if (ear?.listening) return "Listening. Just say it.";
    if (ear?.talking) return "Listen first…";
    return "Your turn. Tap the ear and say it.";
  }
  if (widget === "trace") return "Trace it with your finger.";
  if (kind === "drag") return "Park the pieces.";
  return "Tap one.";
}

/** The one line the kid reads, straight on the stage. Tapping it replays the teacher. */
function Prompt({ eyebrow, prompt, kind, widget }: { eyebrow?: string; prompt: string; kind?: PlayKind; widget?: Widget }) {
  const listening = useListening();
  const blocked = useMicBlocked();
  const talking = useTeacherTalking();
  return (
    <section className="rise-in mx-auto mt-3 w-full max-w-lg text-center">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <button type="button" onClick={() => speak(prompt)} className="prompt title-pop mt-2" aria-label={`Hear it again: ${prompt}`}>
        {prompt}
      </button>
      <p className="coach">{coachLine(kind, widget, { listening, blocked, talking })}</p>
    </section>
  );
}

function VowelFace({ vowel }: { vowel: Vowel }) {
  const face = VOWEL_FACE[vowel];
  return (
    <span className={`inline-flex h-14 min-w-14 items-center justify-center rounded-2xl text-3xl font-black shadow-[0_4px_0_rgb(0_0_0/0.25)] vowel-${vowel}`} title={`${face.name} ${face.sound}`}>
      {vowel}
      <sup className="ml-1 text-lg">{face.mark}</sup>
    </span>
  );
}

function TileChip({ tile, onPick }: { tile: Tile; onPick: () => void }) {
  const sub = tile.kind === "vowel" && tile.vowel ? (tile.label.length > 1 ? tile.label : VOWEL_FACE[tile.vowel].sound) : tile.kind === "sound" ? "sound" : undefined;
  return (
    <button type="button" onClick={onPick} className="fat-card tile bounce-in flex min-h-[5.5rem] min-w-[5.5rem] flex-col items-center justify-center p-2 text-3xl font-black" aria-label={`tile ${tile.label}`}>
      {tile.kind === "vowel" && tile.vowel ? <VowelFace vowel={tile.vowel} /> : tile.label}
      {tile.kind === "vowel" && tile.label.length > 1 ? <span className="text-2xl font-black">{tile.label.slice(1)}</span> : null}
      {sub ? <span className="mt-1 text-micro font-extrabold uppercase tracking-wider opacity-70">{sub}</span> : null}
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
  // Phones: three short answers sit in one row of three; long answers (a
  // sentence) stack as three wide rows; four answers are 2 × 2. Everything
  // stays above the dock either way.
  const longest = Math.max(...dealt.map((c) => c.label.length));
  const stacked = longest > 8;
  const cols = dealt.length > 3 ? "grid-cols-2" : stacked ? "grid-cols-1" : "grid-cols-3";
  const textSize = stacked ? "text-title" : longest > 5 ? "text-title" : "text-card";
  return (
    <div className={`grid gap-3 ${cols}`} data-choices={dealt.length}>
      {dealt.map((c, k) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id, correctSlot)}
          aria-label={c.label}
          className={`fat-card flex flex-col items-center justify-center gap-1 p-2 font-black ${stacked ? "min-h-[4.5rem] flex-row justify-start gap-3 px-4 text-left" : "min-h-[8rem]"} ${textSize} ${
            shaken === c.id ? "wobble" : `bounce-in stagger-${Math.min(k + 1, 4)}`
          }`}
        >
          {c.emoji ? <span className={`emoji-3d ${stacked ? "text-3xl" : "text-[2.75rem]"}`} aria-hidden>{c.emoji}</span> : null}
          <span className={c.emoji && !stacked ? "text-body font-black" : ""}>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Print the kid reads on a speak probe. The teacher never says it. */
function PrintCard({ text }: { text: string }) {
  const long = text.length > 8;
  return (
    <div className="glass-strong rise-in mx-auto mb-4 flex min-h-[6rem] w-full max-w-lg items-center justify-center rounded-[var(--r-lg)] px-5 py-4 text-center" data-print={text}>
      <span className={`display leading-none text-white ${long ? "text-hero" : "text-7xl"}`}>{text}</span>
    </div>
  );
}

/** Tracing cannot be graded; the button only opens once the pad was touched, and a trace is never a miss. */
function TracePad({ letter, onDone }: { letter: string; onDone: () => void }) {
  const [marks, setMarks] = useState(0);
  const traced = marks > 3;
  return (
    <div className="space-y-4">
      <button
        type="button"
        className="glass-strong relative mx-auto flex h-52 w-full max-w-sm select-none flex-col items-center justify-center overflow-hidden rounded-[var(--r-lg)] text-white"
        onPointerMove={(e) => {
          if (e.buttons) setMarks((n) => n + 1);
        }}
        onClick={() => setMarks((n) => n + 4)}
        aria-label={`Trace ${letter}`}
      >
        <span
          className="display pointer-events-none text-[8rem] leading-none text-transparent transition-all"
          style={{
            WebkitTextStroke: traced ? "0px" : "3px rgb(255 255 255 / 0.9)",
            color: traced ? "white" : "transparent",
            textShadow: traced ? "0 0 30px var(--glow)" : "none",
          }}
        >
          {letter}
        </span>
        <span className="absolute bottom-3 inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-label font-extrabold">
          <HandIcon size={16} />
          {traced ? "Nice tracing!" : `Trace ${letter} with your finger`}
        </span>
      </button>
      <button type="button" className="btn-glow mx-auto flex min-h-14 items-center gap-2 px-7 py-3 text-title font-black disabled:opacity-60" disabled={!traced} onClick={onDone}>
        <CheckIcon size={22} />
        I traced it
      </button>
    </div>
  );
}

function SpeakPanel({ onParent }: { onParent: () => void }) {
  const listening = useListening();
  const blocked = useMicBlocked();
  const talking = useTeacherTalking();
  const heard = useHeard();
  const label = blocked ? "Allow the mic" : listening ? "Listening…" : talking ? "Listen…" : "Say it";
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={tapEar}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Start listening"}
        className={`orb orb-ring h-[8.25rem] w-[8.25rem] flex-col gap-1 text-white ${listening ? "glow-pulse" : talking ? "opacity-60" : ""}`}
      >
        <MicIcon size={52} />
        <span className="text-body font-black" aria-live="polite">
          {label}
        </span>
      </button>
      {heard ? (
        <p className="glass rounded-full px-4 py-2 text-body">
          Heard: <span className="font-black">{heard}</span>
        </p>
      ) : null}
      <button type="button" onClick={onParent} className="btn-ghost min-h-12 px-5 py-3 text-body font-bold">
        Parent will listen
      </button>
    </div>
  );
}

function DragBoard({ item, onDone, themeId }: { item: LessonItem; onDone: (ok: boolean) => void; themeId?: ThemeId }) {
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
      window.setTimeout(() => setShake(false), 300);
      onDone(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`flex justify-center gap-2 ${shake ? "wobble" : ""}`}>
        {slots.map((slot, i) => {
          const tile = filled[slot.id];
          const state = tile ? "slot--filled" : i === focus ? "slot--focus" : "";
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setFocus(i)}
              aria-label={`slot ${i + 1} of ${slots.length}, ${tile ? tile.label : "empty"}`}
              className={`slot flex h-20 w-20 items-center justify-center text-3xl font-black ${slots.length > 3 ? "max-w-[22vw]" : ""} ${state}`}
              style={slot.glowVowel ? { boxShadow: `inset 0 0 0 5px ${VOWEL_FACE[slot.glowVowel].color}` } : undefined}
            >
              {tile ? tile.kind === "vowel" && tile.vowel ? <VowelFace vowel={tile.vowel} /> : tile.label : i === focus ? <ArrowDownIcon size={32} className="motion-safe:animate-bounce text-white/90" /> : ""}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tiles
          .filter((t) => !used.has(t.id))
          .map((tile) => (
            <TileChip key={tile.id} tile={tile} onPick={() => drop(tile)} />
          ))}
      </div>
      <p className="mx-auto max-w-sm text-center text-body font-bold text-white/82">{trayHint(themeId, slots.length)}</p>
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
        <span className="eyebrow">
          <SparklesIcon size={14} className="text-amber-300" />
          {eyebrow}
        </span>
      ) : null}
      <h1 className="display title-pop mt-3 text-hero font-bold">{title}</h1>
      {sub ? <p className="mt-2 text-body font-bold text-white/82">{sub}</p> : null}
    </header>
  );
}

export function ThemePicker({ kidId }: { kidId: string }) {
  const { kid, pickTheme, ready } = useHouse();
  const router = useRouter();
  const child = kid(kidId);
  const themePrompt = ready && child && child.status !== "waiting" ? "Pick today's game." : undefined;

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
    pickTheme(kidId, id);
    speak(THEMES.find((t) => t.id === id)?.label ?? "Let's play");
    // The first sitting is the skills map. A re-map runs after the daily, from the done page.
    if (!child.diagnosticReport) router.push(`/kids/${kidId}/place`);
    else router.push(`/kids/${kidId}/play`);
  };

  return (
    <main className="kid-stage theme-planets-space px-4 py-6">
      <OfflinePill />
      <StageHeading eyebrow={`${child.name}'s pick`} title="Pick today's game" sub="Tomorrow you can pick a different one." />
      <div className="mx-auto mt-5 grid max-w-lg grid-cols-2 gap-3 md:max-w-3xl md:grid-cols-4">
        {THEMES.map((t, k) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            className={`fat-card rise-in stagger-${Math.min(k + 1, 4)} relative flex min-h-[7.5rem] flex-col items-center justify-center gap-2 overflow-hidden p-3 theme-${t.id}`}
            data-theme={t.id}
            aria-label={t.label}
          >
            <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl" style={{ background: "var(--accent)" }} />
            <span className="emoji-3d relative text-[2.75rem]" aria-hidden>
              {t.emoji}
            </span>
            <span className="display relative block text-center text-body leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Placement sitting
// ---------------------------------------------------------------------------

export function DiagnosticSession({ kidId }: { kidId: string }) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);

  const progress = child ? child.diagnostic ?? emptyDiagnostic(child.track) : undefined;
  const probe = progress ? currentProbe(progress) : undefined;
  const band = progress ? currentBand(progress) : undefined;
  const summary = progress ? progressSummary(progress) : undefined;

  const [banner, setBanner] = useState<Banner | null>(null);
  const [shaken, setShaken] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [retry, setRetry] = useState(false);
  const [lastSlot, setLastSlot] = useState<number>();
  const [leaving, setLeaving] = useState(false);
  const [startedAt] = useState(() => new Date().toISOString());
  const sitting = useRef(0);
  const start = useRef(0);
  const results = useRef<SessionResult[]>([]);
  const day = useToday();

  useEffect(() => {
    if (probe) speak(probe.prompt);
    start.current = nowMs();
    return () => stopSpeech();
  }, [probe, retry]);

  // A record whose probes are all answered but never got a report: finish it instead of looping between /place and /play.
  const stuck = Boolean(house.ready && child && progress && !progress.cursor && !child.diagnosticReport);
  useEffect(() => {
    if (stuck) house.completeDiagnostic(kidId);
  }, [stuck, kidId, house]);

  const remap = Boolean(child && planOf(child).mapRequested && progress?.cursor);
  const ready = Boolean(house.ready && child && progress && !leaving && (!child.diagnosticReport || remap) && probe);
  const isSpeak = ready && probe?.kind === "speak";
  const seed = `${kidId}-${day}`;

  const leave = (line: string, finished: boolean, endedOn: "win" | "enough" | "cap") => {
    if (leaving || !child) return;
    setLeaving(true);
    const rows = results.current;
    house.endSession({
      kidId: child.id,
      kind: "place",
      startedAt,
      endedAt: new Date().toISOString(),
      items: rows.length,
      wins: rows.filter((r) => r.first === "hit").length,
      misses: rows.filter((r) => r.first === "miss").length,
      pending: rows.filter((r) => r.first === "pending").length,
      endedOn: rows.length ? endedOn : "empty",
      results: rows,
    });
    router.push(`/kids/${kidId}/done?kind=place${finished ? "&finished=1" : ""}&line=${encodeURIComponent(line)}`);
  };

  const settle = (ok: boolean, isRetry: boolean, spoken?: { heard: string; pending: boolean }) => {
    if (!probe || !child) return;
    setShaken(undefined);
    setBanner(null);
    setLocked(false);
    setRetry(false);
    sitting.current += 1;
    const firstAnswerOk = ok && !isRetry;
    const result = house.answerDiagnostic(child.id, probe, firstAnswerOk, elapsedMs(start.current), spoken ? { pending: spoken.pending, heard: spoken.heard } : undefined);
    if (result.finished && result.report) {
      leave(result.report.kidLine, true, "win");
      return;
    }
    if (sitting.current >= SITTING_CAP) leave(PAUSED_KID_LINE, false, "cap");
  };

  const answer = (ok: boolean, kind: PlayKind, spoken?: { heard: string; pending: boolean }) => {
    if (!probe || !child || locked) return;
    setLocked(true);
    const isRetry = retry;
    house.recordAttempt({
      kidId: child.id,
      moduleId: "placement",
      itemId: probe.id,
      version: isRetry ? 1 : 0,
      kind,
      dimension: probe.dimension,
      correct: ok && !spoken?.pending,
      ms: elapsedMs(start.current),
      spokenText: spoken?.heard,
      spokenGrade: spoken ? (spoken.pending ? "pending" : ok ? "hit" : "miss") : undefined,
      kidSaw: spoken?.pending ? "parent will listen" : ok ? (isRetry ? "there it is" : "star") : "not that one",
      source: "placement",
    });
    if (!isRetry) results.current.push({ itemId: probe.id, moduleId: "placement", source: "stretch", first: spoken?.pending ? "pending" : ok ? "hit" : "miss" });
    if (spoken?.pending) {
      setBanner({ text: "Parent will listen.", tone: "note" });
      window.setTimeout(() => settle(false, isRetry, spoken), 700);
      return;
    }
    if (ok && !isRetry) {
      setBanner({ text: skinWin(theme.id, theme.win, seed), tone: "win" });
      house.addStars(child.id, 1);
    } else if (ok) {
      // A second guess on the same card is morale, not a real win: no star, no confetti.
      setBanner({ text: "There it is!", tone: "quiet" });
    } else {
      setBanner({ text: skinMiss(theme.id, theme.miss, seed), tone: "miss" });
    }
    window.setTimeout(() => {
      // One honest retry; only the first answer counts on the map.
      if (!ok && !isRetry) {
        setShaken(undefined);
        setBanner(null);
        setRetry(true);
        setLocked(false);
        return;
      }
      settle(ok, isRetry, spoken);
    }, ok ? 1100 : 1600);
  };

  // The ear arms only on a speak probe, after the prompt, once. Same contract as a lesson.
  useLessonListen({
    prompt: probe?.prompt,
    target: isSpeak ? probe?.speakTarget : undefined,
    onAnswer: (heard, hit) => answer(hit, "speak", { heard, pending: false }),
    enabled: isSpeak && !banner && !locked,
  });

  if (!house.ready || !child || !progress) return <Loading />;
  if (child.status === "waiting") {
    router.replace(`/kids/${kidId}/waiting`);
    return null;
  }
  if (!child.themeToday || child.themeDate !== day) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }
  if (leaving) return null;
  if (child.diagnosticReport && !remap) {
    router.replace(`/kids/${kidId}/play`);
    return null;
  }
  if (!probe) return <Loading text="Finishing the map…" />;

  const host = sittingHost(theme.id, seed);

  const onPick = (choiceId: string, correctSlot: number) => {
    if (!probe || locked) return;
    const ok = choiceId === paintCorrectId(probe, theme.id);
    setLastSlot(correctSlot);
    if (!ok) setShaken(choiceId);
    answer(ok, "tap");
  };

  const lesson = asLesson(probe);
  lesson.choices = paintChoices(probe, theme.id);
  lesson.correctId = paintCorrectId(probe, theme.id);

  return (
    <main className={`kid-stage play-stage theme-${theme.id}`} data-probe={probe.id} data-probe-kind={probe.kind ?? "tap"}>
      <OfflinePill />
      <KidChrome stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} />
      <Dots total={band?.probes.length ?? 0} current={progress.cursor?.probe ?? 0} label={`Map ${summary ? summary.bandIndex + 1 : 1} of ${summary?.bandCount ?? 1}`} />
      <Prompt eyebrow={band?.kidEyebrow ?? "Warm-up"} prompt={lesson.prompt} kind={probe.kind ?? "tap"} widget={lesson.widget} />
      {banner ? <HonestBanner banner={banner} /> : null}
      <div className="play-stage__answers">
        {isSpeak ? (
          <>
            {probe.print ? <PrintCard text={probe.print} /> : null}
            <SpeakPanel onParent={() => answer(false, "speak", { heard: "parent-listen", pending: true })} />
          </>
        ) : (
          <ChoiceGrid
            key={`${probe.id}-${retry ? 1 : 0}`}
            choices={lesson.choices ?? []}
            correctId={lesson.correctId}
            seed={`${seed}-${probe.id}-${retry ? 1 : 0}`}
            avoidSlot={lastSlot}
            onPick={onPick}
            shaken={shaken}
          />
        )}
      </div>
      <PlayDock prompt={lesson.prompt} hint={lesson.parentHint} onEnough={() => leave(PAUSED_KID_LINE, false, "enough")} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Dock and HUD
// ---------------------------------------------------------------------------

function PlayDock({ prompt, hint, onEnough }: { prompt: string; hint?: string; onEnough?: () => void }) {
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
        <button type="button" className="play-dock__again" onClick={() => speak(prompt)} aria-label={`Hear it again: ${prompt}`}>
          <SpeakerIcon size={24} />
          Again
        </button>
        {onEnough ? (
          <button
            type="button"
            className="play-dock__enough"
            aria-label="That's enough. Press and hold to finish."
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className={`hold-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${holding ? "hold-ring--go" : ""}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1b1440] text-white">
                <HomeIcon size={20} />
              </span>
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block leading-none">{holding ? "Keep holding…" : "That's enough"}</span>
              <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/15">
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

/** 48px HUD: host orb · host label · stars. The kid's own name is not repeated on every card. */
function KidChrome({ stars, themeId, sitting, hostEmoji }: { stars: number; themeId: ThemeId; sitting?: string; hostEmoji?: string }) {
  const t = themeOf(themeId);
  return (
    <div className="hud glass mx-auto w-full max-w-lg">
      <span className="orb host-float h-11 w-11 shrink-0 text-2xl" aria-label={sitting ?? t.host}>
        <span className="emoji-3d">{hostEmoji ?? t.hostEmoji}</span>
      </span>
      <p className="display min-w-0 flex-1 truncate text-center text-body leading-none text-white/90">{sitting ?? t.host}</p>
      <span className="star-pill text-body" aria-live="polite" aria-label={`${stars} stars`}>
        <StarIcon size={18} className="text-amber-700 drop-shadow" />
        {stars}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily / review / scout / try sitting
// ---------------------------------------------------------------------------

type Mode = "daily" | "scout" | "try";
type Outcome = SessionResult["first"];

const SCOUT_MODULE = { letters: "scout:MY-1", words: "scout:RH-1" } as const;

/** What to play. Daily: the plan's session. Try: one module top to bottom. Scout: the whole pack, always. */
function dealFor(child: Child, state: HouseState, mode: Mode, picked: ModuleDef | undefined, day: string, width: number): Session {
  if (mode === "scout") {
    const scout = child.track === "letters" ? SCOUT_MY1 : SCOUT_RH1;
    const moduleId = SCOUT_MODULE[child.track];
    return { kind: "daily", moduleId, entries: scout.map((item) => ({ item, moduleId, source: "stretch" as const })), closers: [], reviewed: [] };
  }
  if (mode === "try") {
    const mod = picked ?? activeModule(child, state);
    if (!mod) return { kind: "daily", entries: [], closers: [], reviewed: [] };
    return { kind: "daily", moduleId: mod.id, entries: leadOrder(mod.items).map((item) => ({ item, moduleId: mod.id, source: "stretch" as const })), closers: [], reviewed: [] };
  }
  return buildSession(child, state, day, width);
}

export function DailySession({ kidId, mode, moduleId }: { kidId: string; mode: Mode; moduleId?: string }) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);
  const day = useToday();
  const picked = moduleId ? house.module(moduleId) : undefined;
  const safePicked = picked && child && usableFor(child, picked) ? picked : undefined;

  // Dealt once when the sitting opens; attempts landing in the store never re-deal it.
  const [session, setSession] = useState<Session | null>(() =>
    child ? dealFor(child, house.state, mode, safePicked, day, typeof window !== "undefined" ? window.innerWidth : 1024) : null,
  );
  const [startedAt] = useState(() => new Date().toISOString());
  const [i, setI] = useState(0);
  const [version, setVersion] = useState(0);
  const [slotMisses, setSlotMisses] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [shaken, setShaken] = useState<string>();
  const [lastSlot, setLastSlot] = useState<number>();
  const [locked, setLocked] = useState(false);
  const start = useRef(0);
  const results = useRef(new Map<number, SessionResult>());
  const scoutRows = useRef<ScoutRow[]>([]);
  const ended = useRef(false);
  const closerUsed = useRef(false);

  const entry: SessionEntry | undefined = session?.entries[i];
  const item = entry?.item;
  const speakTarget = item?.kind === "speak" ? item.speakTarget ?? item.word ?? item.letter : undefined;
  const seed = `${kidId}-${day}`;

  // Every card (and every retry) starts with the teacher and a fresh clock. On a
  // speak retry this is also what re-opens the ear: once, after the replay.
  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = nowMs();
    return () => stopSpeech();
  }, [item, version]);

  const finish = (endedOn: "win" | "miss" | "enough") => {
    if (ended.current || !child || !session) return;
    ended.current = true;
    if (mode === "scout" && scoutRows.current.length) house.saveScout(scoutReportFrom(child.id, child.track, scoutRows.current));
    const rows = [...results.current.values()];
    house.endSession({
      kidId: child.id,
      kind: mode === "scout" ? "scout" : mode === "try" ? "try" : session.kind === "review" ? "review" : "daily",
      moduleId: mode === "scout" ? undefined : session.moduleId,
      startedAt,
      endedAt: new Date().toISOString(),
      items: rows.length,
      wins: rows.filter((r) => r.first === "hit").length,
      misses: rows.filter((r) => r.first === "miss").length,
      pending: rows.filter((r) => r.first === "pending").length,
      endedOn: rows.length ? endedOn : "empty",
      results: rows,
    });
    router.push(`/kids/${kidId}/done?kind=${mode}`);
  };

  const advance = (last: Outcome) => {
    if (!session) return;
    setBanner(null);
    setShaken(undefined);
    setVersion(0);
    setSlotMisses(0);
    setLocked(false);
    if (i + 1 < session.entries.length) {
      setI(i + 1);
      return;
    }
    // End on a real win: when the last card missed, one known card closes the sitting.
    if (last === "miss" && session.closers.length && !closerUsed.current) {
      closerUsed.current = true;
      setSession((s) => (s ? { ...s, entries: [...s.entries, s.closers[0]] } : s));
      setI(i + 1);
      return;
    }
    finish(last === "miss" ? "miss" : "win");
  };

  const after = (ok: boolean, kind: PlayKind, spoken?: { text: string; pending: boolean }) => {
    if (!child || !session || !entry || locked || ended.current) return;
    setLocked(true);
    const first = version === 0;
    const outcome: Outcome = spoken?.pending ? "pending" : ok ? "hit" : "miss";
    const ms = elapsedMs(start.current);
    const source: AttemptSource = mode === "scout" ? "scout" : mode === "try" ? "try" : entry.source === "stretch" ? "daily" : "review";
    house.recordAttempt({
      kidId: child.id,
      moduleId: entry.moduleId,
      itemId: entry.item.id,
      version,
      kind,
      dimension: entry.item.dimension,
      correct: ok && !spoken?.pending,
      ms,
      spokenText: spoken?.text,
      spokenGrade: spoken ? (spoken.pending ? "pending" : ok ? "hit" : "miss") : undefined,
      kidSaw: spoken?.pending ? "parent will listen" : ok ? (first ? "star" : "there it is") : "not that one",
      source,
    });
    if (first && !results.current.has(i)) results.current.set(i, { itemId: entry.item.id, moduleId: entry.moduleId, source: entry.source, first: outcome });
    // Only the first answer on a card counts for the scout, like the map.
    if (mode === "scout" && first && !scoutRows.current.some((r) => r.item.id === entry.item.id)) {
      scoutRows.current.push({ item: entry.item, ok, ms, pending: spoken?.pending, heard: spoken?.text });
    }
    if (spoken?.pending) {
      setBanner({ text: "Parent will listen.", tone: "note" });
      window.setTimeout(() => advance("pending"), 700);
      return;
    }
    if (ok && first) {
      house.addStars(child.id, 1);
      setBanner({ text: skinWin(theme.id, theme.win, seed), tone: "win" });
    } else if (ok) {
      setBanner({ text: "There it is!", tone: "quiet" });
    } else {
      setBanner({ text: skinMiss(theme.id, theme.miss, seed), tone: "miss" });
    }
    window.setTimeout(() => {
      if (ok) {
        advance("hit");
        return;
      }
      // Honest miss. Same card once more, then another version of the same
      // skill, then move on: three misses on one slot never strand the kid.
      const missesHere = slotMisses + 1;
      if (missesHere >= 3) {
        advance("miss");
        return;
      }
      setSlotMisses(missesHere);
      if (missesHere >= 2) {
        const bank = mode === "scout" ? (child.track === "letters" ? SCOUT_MY1 : SCOUT_RH1) : house.module(entry.moduleId)?.items ?? [];
        const alt = nextSameSkill(bank, entry.item, new Set(session.entries.map((e) => e.item.id)));
        if (alt) {
          setSession((s) => (s ? { ...s, entries: s.entries.map((e, k) => (k === i ? { ...e, item: alt } : e)) } : s));
          setVersion(0);
        } else {
          setVersion((v) => v + 1);
        }
      } else {
        setVersion((v) => v + 1);
      }
      setShaken(undefined);
      setBanner(null);
      setLocked(false);
    }, ok ? 1100 : 1600);
  };

  // The ear only arms on a speak step; tap, drag, and trace steps keep it off.
  useLessonListen({
    prompt: item?.prompt,
    target: speakTarget,
    onAnswer: (heard, hit) => after(hit, "speak", { text: heard, pending: false }),
    enabled: Boolean(item) && !banner && !locked,
  });

  if (!house.ready || !child) return <Loading />;
  if (child.status === "waiting") {
    router.replace(`/kids/${kidId}/waiting`);
    return null;
  }
  if (!child.themeToday || child.themeDate !== day) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }
  if (!child.diagnosticReport && mode === "daily") {
    router.replace(`/kids/${kidId}/place`);
    return null;
  }
  if (!session || !entry || !item) {
    return (
      <main className={`kid-stage theme-${theme.id} flex min-h-dvh flex-col items-center justify-center p-6 text-center`}>
        <span className="orb h-24 w-24 text-white">
          <TelescopeIcon size={44} />
        </span>
        <p className="display title-pop mt-6 text-hero">Nothing to play yet.</p>
        <p className="mt-3 max-w-xs text-body font-bold text-white/82">A grown-up picks the next adventure.</p>
        <Link href="/kids" className="btn-solid mt-6 inline-flex min-h-14 items-center gap-2 px-6 py-3 text-title font-black">
          <HomeIcon size={22} />
          Home
        </Link>
      </main>
    );
  }

  const host = sittingHost(theme.id, seed);
  const playItem: LessonItem = {
    ...item,
    choices: paintChoices(item, theme.id),
    correctId: paintCorrectId(item, theme.id),
  };
  const eyebrow = mode === "scout" ? "Secret tunnel" : mode === "try" ? "Try run" : session.kind === "review" ? "Victory lap" : entry.source === "review" ? "Warm-up" : entry.source === "close" ? "One more" : "Today's adventure";

  return (
    <main className={`kid-stage play-stage theme-${theme.id}`} data-item={playItem.id} data-item-kind={playItem.kind} data-item-source={entry.source}>
      <OfflinePill />
      <KidChrome stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} />
      <Dots total={session.entries.length} current={i} />
      <Prompt eyebrow={eyebrow} prompt={playItem.prompt} kind={playItem.kind} widget={playItem.widget} />
      {banner ? <HonestBanner banner={banner} /> : null}
      <div className="play-stage__answers">
        {playItem.kind === "tap" && playItem.widget !== "trace" ? (
          <ChoiceGrid
            key={`${playItem.id}-${version}`}
            choices={playItem.choices ?? []}
            correctId={playItem.correctId}
            seed={`${seed}-${entry.moduleId}-${playItem.id}-${version}`}
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
        {playItem.kind === "drag" ? <DragBoard key={`${playItem.id}-${version}`} item={playItem} themeId={theme.id} onDone={(ok) => after(ok, "drag")} /> : null}
        {playItem.widget === "trace" ? <TracePad key={`${playItem.id}-${version}`} letter={playItem.letter ?? playItem.correctId ?? "s"} onDone={() => after(true, "tap")} /> : null}
        {playItem.kind === "speak" ? <SpeakPanel onParent={() => after(false, "speak", { text: "parent-listen", pending: true })} /> : null}
      </div>
      <PlayDock prompt={playItem.prompt} hint={playItem.parentHint} onEnough={() => finish("enough")} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

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

  if (!ready) return <Loading />;
  return (
    <main className="kid-stage theme-planets-space px-4 pb-[calc(var(--dock-h)+env(safe-area-inset-bottom,0px)+1rem)] pt-6">
      <OfflinePill />
      <StageHeading eyebrow="Player select" title="Who's reading?" sub="Tap your face." />
      <InstallHint />
      <div className="mx-auto mt-5 grid max-w-lg grid-cols-1 gap-3">
        {state.kids.map((k, idx) => {
          const waiting = k.status === "waiting";
          const [a, b] = KID_GRADIENTS[idx % KID_GRADIENTS.length];
          return (
            <Link
              key={k.id}
              href={waiting ? `/kids/${k.id}/waiting` : `/kids/${k.id}/theme`}
              className={`fat-card rise-in stagger-${Math.min(idx + 1, 4)} flex min-h-[6rem] items-center gap-4 p-4 ${waiting ? "opacity-70 saturate-50" : ""}`}
              style={waiting ? ({ "--card": "#ece9f4" } as CSSProperties) : undefined}
              data-kid={k.id}
            >
              <span className="orb display h-14 w-14 shrink-0 text-3xl text-white" style={{ ["--orb-a" as string]: waiting ? "#94a3b8" : a, ["--orb-b" as string]: waiting ? "#475569" : b }}>
                {waiting ? <LockIcon size={28} /> : k.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-title leading-none">{k.name}</span>
                <span className="mt-1 block text-body font-bold text-ink/70">{waiting ? "Coming later" : k.track === "letters" ? "Letters and sounds" : "Word adventure"}</span>
              </span>
              {waiting ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-900/80 px-3 py-1.5 text-label font-extrabold text-white">
                  <LockIcon size={14} />
                  Soon
                </span>
              ) : (
                <span className="star-pill text-body">
                  <StarIcon size={18} className="text-amber-700" />
                  {k.stars}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <nav className="grades-dock" aria-label="Parents">
        <HoldToOpen onOpen={() => router.push("/parent")} />
      </nav>
    </main>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <main className="kid-stage theme-planets-space flex min-h-dvh items-center justify-center p-8">
      <p className="glass inline-flex items-center gap-3 rounded-full px-5 py-3 text-body font-black text-white">
        <span className="h-3 w-3 animate-pulse rounded-full bg-amber-300" />
        {text}
      </p>
    </main>
  );
}

