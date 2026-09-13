"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { phonemeHint, speak } from "@/lib/audio";
import {
  SCOUT_MY1,
  SCOUT_RH1,
  THEMES,
  TRACK_A_CVC,
  TRACK_A_LETTERS,
  TRACK_A_SOUNDS,
  TRACK_B_NAMES,
  TRACK_B_SOUNDS,
  VOWEL_FACE,
  themeOf,
  wordsUnlocked,
} from "@/lib/catalog";
import { scorePlacement, struggleStop, type PlacementRow } from "@/lib/placement";
import { paintChoices, paintCorrectId, sittingHost, skinMiss, skinWin, trayHint } from "@/lib/theme-skins";
import { kidNextModule } from "@/lib/grades";
import { useHouse } from "@/lib/store";
import type {
  Choice,
  LessonItem,
  PlacementItem,
  PlayKind,
  ThemeId,
  Tile,
  Vowel,
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
  SpeakerIcon,
  StarIcon,
  TelescopeIcon,
} from "@/components/Icons";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle<T>(list: T[]) {
  return [...list].sort(() => Math.random() - 0.5);
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
    <div role="status" className="fixed left-3 right-3 top-3 z-50 mx-auto max-w-lg">
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

function PromptCard({ eyebrow, prompt, hint }: { eyebrow?: string; prompt: string; hint?: string }) {
  return (
    <section className="glass rise-in mx-auto mt-4 max-w-lg rounded-[28px] px-5 py-5 text-center">
      {eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p> : null}
      <p className="display title-pop mt-1 text-4xl leading-tight">{prompt}</p>
      <Replay prompt={prompt} hint={hint} />
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
  onPick,
  shaken,
}: {
  choices: Choice[];
  onPick: (id: string) => void;
  shaken?: string;
}) {
  return (
    <div className={`grid gap-4 ${choices.length > 3 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
      {choices.map((c, k) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
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

function SpeakPanel({
  target,
  onResult,
}: {
  target: string;
  onResult: (ok: boolean, spoken: string, needsReview: boolean) => void;
}) {
  const [hearing, setHearing] = useState(false);
  const [heard, setHeard] = useState("");

  const listen = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
      ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition;
    if (!SR) {
      onResult(true, "", true);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    setHearing(true);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results[0] ? [e.results[0][0].transcript] : []).join(" ").toLowerCase();
      setHeard(text);
      setHearing(false);
      const goal = target.toLowerCase().replace(/[./]/g, "");
      const hit = text.replace(/[./]/g, "").includes(goal.replace(/\s+/g, "")) || goal.includes(text.replace(/\s+/g, ""));
      onResult(hit, text, false);
    };
    rec.onerror = () => {
      setHearing(false);
      onResult(false, "", true);
    };
    rec.start();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={listen}
        className={`orb orb-ring h-40 w-40 flex-col gap-1 text-white ${hearing ? "glow-pulse" : ""}`}
        style={{ ["--orb-a" as string]: "#fb7185", ["--orb-b" as string]: "#e11d48" }}
      >
        <MicIcon size={56} />
        <span className="text-lg font-black">{hearing ? "Listening…" : "Say it"}</span>
      </button>
      {heard ? (
        <p className="glass rounded-full px-4 py-2 text-lg">
          Heard: <span className="font-black">{heard}</span>
        </p>
      ) : null}
      <button type="button" onClick={() => onResult(false, "parent-listen", true)} className="btn-ghost px-5 py-3 text-lg font-bold">
        Parent will listen
      </button>
    </div>
  );
}

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionEvent = {
  results: { 0?: { 0: { transcript: string } } };
};

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
        {(item.tiles ?? []).filter((t) => !used.has(t.id)).map((tile) => (
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

  useEffect(() => {
    if (ready && child && child.status !== "waiting") speak("Pick today's game.");
  }, [ready, child]);

  useEffect(() => {
    if (ready && child?.status === "waiting") router.replace(`/kids/${kidId}/waiting`);
  }, [ready, child, kidId, router]);

  if (!ready) return <Loading />;
  if (!child) return <Loading text="Missing kid." />;
  if (child.status === "waiting") return null;

  const choose = (id: ThemeId) => {
    pickTheme(kidId, id);
    speak(THEMES.find((t) => t.id === id)?.label ?? "Let's play");
    if (!child.placementGrade) router.push(`/kids/${kidId}/place`);
    else router.push(`/kids/${kidId}/play`);
  };

  return (
    <main className="kid-stage theme-planets-space px-4 py-8">
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

export function PlacementSession({ kidId }: { kidId: string }) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);
  const isMyles = child?.id === "myles" || child?.track === "letters";

  const plan = useMemo(() => {
    if (isMyles) return [...TRACK_B_NAMES, ...TRACK_B_SOUNDS];
    return [...TRACK_A_SOUNDS, ...TRACK_A_LETTERS, ...TRACK_A_CVC];
  }, [isMyles]);

  const [i, setI] = useState(0);
  const [results, setResults] = useState<PlacementRow[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [shaken, setShaken] = useState<string>();
  const [locked, setLocked] = useState(false);
  const retries = useRef(0);
  const start = useRef(Date.now());
  const history = useRef<PlacementRow[]>([]);
  const item = plan[i];

  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = Date.now();
  }, [item]);

  if (!house.ready || !child) return <Loading />;
  if (child.status === "waiting") return null;
  if (!child.themeToday || child.themeDate !== today()) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }

  const finish = (extra: PlacementRow[]) => {
    const scored = scorePlacement(extra, isMyles ? "letters" : "words");
    house.finishPlacement(child.id, scored.grade, scored.note, scored.kidLine, scored.owned);
    router.push(
      `/kids/${kidId}/done?kind=place&shelf=${encodeURIComponent(scored.grade)}&line=${encodeURIComponent(scored.kidLine)}`,
    );
  };

  const host = sittingHost(theme.id, `${kidId}-${today()}`);
  const onPick = (choiceId: string) => {
    if (!item || locked) return;
    const ok = choiceId === paintCorrectId(item, theme.id);
    setLocked(true);
    const row: PlacementRow = { id: item.id, rung: item.rung, ok, dim: item.dimension };
    const next = [...history.current, row];
    history.current = next;
    setResults(next);
    house.recordAttempt({
      kidId: child.id,
      moduleId: "placement",
      itemId: item.id,
      version: retries.current,
      kind: "tap",
      dimension: item.dimension,
      correct: ok,
      ms: Date.now() - start.current,
      kidSaw: ok ? "star" : "not that one",
      source: "placement",
    });
    if (ok) {
      setParty(true);
      setBanner(skinWin(theme.id, theme.win, `${kidId}-${today()}`));
      house.addStars(child.id, 1);
    } else {
      setShaken(choiceId);
      setBanner(skinMiss(theme.id, theme.miss, `${kidId}-${today()}`));
    }
    window.setTimeout(() => {
      setParty(false);
      setShaken(undefined);
      if (!ok && retries.current === 0) {
        retries.current = 1;
        setLocked(false);
        return;
      }
      setBanner(null);
      retries.current = 0;
      setLocked(false);
      if (isMyles) {
        const hits = next.filter((r) => r.ok).length;
        const fussy = next.length >= 6 && (hits < 4 || struggleStop(next, item.rung));
        if (i + 1 >= plan.length || fussy) finish(next);
        else setI(i + 1);
        return;
      }
      if (struggleStop(next, item.rung)) {
        finish(next);
        return;
      }
      const lastOfRung =
        (item.rung === "sounds" && item.id === "S4") ||
        (item.rung === "letters" && item.id === "L6") ||
        (item.rung === "cvc" && item.id === "C4");
      if (lastOfRung && item.rung === "cvc") finish(next);
      else setI(i + 1);
    }, ok ? 1100 : 1600);
  };

  if (!item) return null;
  const lesson = asLesson(item);
  lesson.choices = paintChoices(item, theme.id);
  lesson.correctId = paintCorrectId(item, theme.id);

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-4`}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} onEnough={() => router.push(`/kids/${kidId}/done?kind=place`)} />
      <Dots total={plan.length} current={i} />
      <PromptCard eyebrow="Warm-up" prompt={lesson.prompt} hint={lesson.parentHint} />
      {banner ? <HonestBanner text={banner} party={party} /> : null}
      <div className="mx-auto mt-6 max-w-lg">
        <ChoiceGrid key={item.id} choices={lesson.choices ?? []} onPick={onPick} shaken={shaken} />
      </div>
    </main>
  );
}

function Replay({ prompt, hint }: { prompt: string; hint?: string }) {
  return (
    <div className="mt-4 flex justify-center gap-3">
      <button type="button" onClick={() => speak(prompt)} className="btn-ghost inline-flex items-center gap-2 px-5 py-2.5 text-lg font-black">
        <SpeakerIcon size={22} />
        Again
      </button>
      {hint ? <p className="sr-only">{phonemeHint(hint)}</p> : null}
    </div>
  );
}

function KidChrome({
  kidName,
  stars,
  themeId,
  sitting,
  hostEmoji,
  onEnough,
}: {
  kidName: string;
  stars: number;
  themeId: ThemeId;
  sitting?: string;
  hostEmoji?: string;
  onEnough?: () => void;
}) {
  const t = themeOf(themeId);
  const hold = useRef<number | null>(null);
  const clear = () => {
    if (hold.current) window.clearTimeout(hold.current);
  };
  return (
    <div className="hud glass mx-auto max-w-lg">
      <button
        type="button"
        className="orb host-float h-14 w-14 shrink-0 text-3xl"
        aria-label={sitting ?? t.host}
        onPointerDown={() => {
          if (!onEnough) return;
          hold.current = window.setTimeout(onEnough, 1600);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
      >
        <span className="emoji-3d">{hostEmoji ?? t.hostEmoji}</span>
      </button>
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
  const start = useRef(Date.now());
  const item = queue[i];

  useEffect(() => {
    if (!module) return;
    const base = module.items;
    if (mode === "scout") {
      setQueue(child?.track === "letters" ? SCOUT_MY1 : SCOUT_RH1);
    } else {
      const taps = base.filter((it) => it.kind === "tap");
      const drags = base.filter((it) => it.kind === "drag");
      const speaks = base.filter((it) => it.kind === "speak");
      const traces = base.filter((it) => it.widget === "trace");
      const used = new Set([taps[0]?.id, drags[0]?.id, speaks[0]?.id, traces[0]?.id].filter(Boolean));
      const rest = base.filter((it) => !used.has(it.id));
      const lead = [taps[0], drags[0], speaks[0], traces[0], ...rest].filter(Boolean);
      const n = mode === "try" ? lead.length : child?.sessionLength === "shorter" ? 5 : child?.sessionLength === "longer" ? 9 : 7;
      setQueue(lead.slice(0, n));
    }
  }, [module, mode, child?.sessionLength, child?.track]);

  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = Date.now();
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
  if (!child.placementGrade && mode === "daily") {
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
      } else {
        setVersion((v) => v + 1);
      }
    }, ok ? 1100 : 1600);
  };

  const eyebrow = mode === "scout" ? "Secret tunnel" : mode === "try" ? "Try run" : "Today's adventure";

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-4`}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} sitting={host?.label} hostEmoji={host?.emoji} onEnough={() => router.push(`/kids/${kidId}/done?kind=${mode}`)} />
      <Dots total={queue.length} current={i} />
      <PromptCard eyebrow={eyebrow} prompt={playItem.prompt} hint={playItem.parentHint} />
      {banner ? <HonestBanner text={banner} party={party} /> : null}
      <div className="mx-auto mt-6 max-w-lg">
        {playItem.kind === "tap" && playItem.widget !== "trace" ? (
          <ChoiceGrid
            key={`${playItem.id}-${version}`}
            choices={playItem.choices ?? []}
            shaken={shaken}
            onPick={(id) => {
              const ok = id === playItem.correctId;
              if (!ok) setShaken(id);
              after(ok, "tap");
            }}
          />
        ) : null}
        {playItem.kind === "drag" ? <DragBoard item={playItem} themeId={theme.id} onDone={(ok) => after(ok, "drag")} /> : null}
        {playItem.widget === "trace" ? <TracePad letter={playItem.letter ?? playItem.correctId ?? "s"} onDone={(ok) => after(ok, "tap")} /> : null}
        {playItem.kind === "speak" ? (
          <SpeakPanel
            target={playItem.speakTarget ?? playItem.word ?? playItem.letter ?? ""}
            onResult={(ok, spoken, needsReview) => after(ok, "speak", { text: spoken, pending: needsReview })}
          />
        ) : null}
      </div>
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
  if (!ready) return <Loading />;
  return (
    <main className="kid-stage theme-planets-space px-4 py-8">
      <StageHeading eyebrow="Player select" title="Who's reading?" sub="Tap a face. Stars, not grades." />
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
