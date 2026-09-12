"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { kidNextModule } from "@/lib/grades";
import { useHouse } from "@/lib/store";
import type {
  Choice,
  GradeDimension,
  LessonItem,
  PlacementItem,
  PlayKind,
  ThemeId,
  Tile,
  Vowel,
} from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle<T>(list: T[]) {
  return [...list].sort(() => Math.random() - 0.5);
}

function HonestBanner({ text, party }: { text: string; party?: boolean }) {
  return (
    <div className={`rounded-3xl px-4 py-3 text-center text-2xl font-black ${party ? "party bg-amber-300 text-stone-900" : "wobble bg-white/20"}`}>
      {text}
    </div>
  );
}

function VowelFace({ vowel }: { vowel: Vowel }) {
  const face = VOWEL_FACE[vowel];
  return (
    <span className={`inline-flex h-16 min-w-16 items-center justify-center rounded-2xl text-3xl font-black vowel-${vowel}`} title={`${face.name} ${face.sound}`}>
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
      <button type="button" onClick={onPick} className="fat-card flex min-h-28 min-w-28 flex-col items-center justify-center p-3">
        <VowelFace vowel={tile.vowel} />
        <span className="mt-1 text-sm font-bold opacity-70">{VOWEL_FACE[tile.vowel].sound}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onPick} className="fat-card flex min-h-28 min-w-28 flex-col items-center justify-center p-3 text-4xl font-black">
      {tile.kind === "sound" ? tile.label : tile.label}
      {tile.kind === "sound" ? <span className="mt-1 text-sm">sound</span> : null}
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
    <div className={`grid gap-3 ${choices.length > 3 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className={`fat-card flex flex-col items-center justify-center gap-1 p-4 text-4xl font-black ${shaken === c.id ? "wobble" : "bounce-in"}`}
        >
          <span className="text-5xl">{c.emoji ?? ""}</span>
          {c.label}
        </button>
      ))}
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
    <div className="space-y-3">
      <button type="button" onClick={listen} className="fat-card mx-auto flex h-36 w-36 flex-col items-center justify-center bg-rose-200 text-5xl">
        🎤
        <span className="text-lg">{hearing ? "Listening…" : "Say it"}</span>
      </button>
      {heard ? <p className="text-center text-lg">Heard: {heard}</p> : null}
      <button
        type="button"
        onClick={() => onResult(false, "parent-listen", true)}
        className="mx-auto block rounded-full bg-white/20 px-4 py-3 text-lg font-bold"
      >
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
}: {
  item: LessonItem;
  onDone: (ok: boolean) => void;
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
    <div className="space-y-5">
      <div className={`flex justify-center gap-3 ${shake ? "wobble" : ""}`}>
        {slots.map((slot, i) => {
          const tile = filled[slot.id];
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setFocus(i)}
              className="flex h-28 w-28 items-center justify-center rounded-[28px] border-4 border-dashed border-white/70 bg-white/15 text-4xl font-black"
              style={slot.glowVowel ? { boxShadow: `inset 0 0 0 6px ${VOWEL_FACE[slot.glowVowel].color}` } : undefined}
            >
              {tile ? tile.kind === "vowel" && tile.vowel ? <VowelFace vowel={tile.vowel} /> : tile.label : i === focus ? "↓" : ""}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {(item.tiles ?? []).filter((t) => !used.has(t.id)).map((tile) => (
          <TileChip key={tile.id} tile={tile} onPick={() => drop(tile)} />
        ))}
      </div>
      <p className="text-center text-sm opacity-80">Tap a fat tile to send it. Same as a drag.</p>
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

export function ThemePicker({ kidId }: { kidId: string }) {
  const { kid, pickTheme, ready } = useHouse();
  const router = useRouter();
  const child = kid(kidId);
  if (!ready) return <p className="p-8">Loading…</p>;
  if (!child) return <p className="p-8">Missing kid.</p>;
  if (child.status === "waiting") {
    router.replace(`/kids/${kidId}/waiting`);
    return null;
  }

  useEffect(() => {
    speak("Pick today's game.");
  }, []);

  const choose = (id: ThemeId) => {
    pickTheme(kidId, id);
    speak(THEMES.find((t) => t.id === id)?.label ?? "Let's play");
    if (!child.placementGrade) router.push(`/kids/${kidId}/place`);
    else router.push(`/kids/${kidId}/play`);
  };

  return (
    <main className="kid-stage theme-planets-space px-4 py-6">
      <p className="display text-center text-5xl font-bold">Today&apos;s skin</p>
      <p className="mt-2 text-center text-xl">Smash one. You can pick a different one tomorrow.</p>
      <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3">
        {THEMES.map((t) => (
          <button key={t.id} type="button" onClick={() => choose(t.id)} className={`fat-card flex items-center gap-4 p-5 text-left theme-${t.id}`}>
            <span className="text-5xl">{t.emoji}</span>
            <span>
              <span className="display block text-3xl">{t.label}</span>
              <span className="text-lg opacity-70">{t.host}</span>
            </span>
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
  const [results, setResults] = useState<{ id: string; rung: string; ok: boolean; dim: GradeDimension }[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [shaken, setShaken] = useState<string>();
  const [locked, setLocked] = useState(false);
  const retries = useRef(0);
  const start = useRef(Date.now());
  const item = plan[i];

  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = Date.now();
  }, [item]);

  if (!house.ready || !child) return <p className="p-8">Loading…</p>;
  if (child.status === "waiting") return null;
  if (!child.themeToday || child.themeDate !== today()) {
    router.replace(`/kids/${kidId}/theme`);
    return null;
  }

  const finish = (extra: typeof results) => {
    const all = extra;
    let grade: "S" | "L" | "C" | "C+" | "A0" | "A1" | "A2" | "A3" = "S";
    let note = "";
    let kidLine = `You found a star with ${theme.host}!`;
    let owned: string[] = [];
    if (isMyles) {
      const names = all.filter((r) => r.rung === "names");
      const sounds = all.filter((r) => r.rung === "letter-sounds");
      const nHit = names.filter((r) => r.ok).length;
      const sHit = sounds.filter((r) => r.ok).length;
      const total = all.filter((r) => r.ok).length;
      if (total <= 2) grade = "A0";
      else if (nHit >= 3 && sHit <= 2) grade = "A1";
      else if (sHit >= 3 && nHit <= 2) grade = "A2";
      else grade = "A3";
      owned = all.filter((r) => r.ok).map((r) => r.id);
      note = `Names ${nHit}/4, sounds ${sHit}/${Math.max(sounds.length, 1)}. Stay in letters and sounds.`;
      kidLine = `You beamed up a letter!`;
    } else {
      const rungOf = (rung: string) => all.filter((r) => r.rung === rung);
      const pass = (rung: string, need: number, burst: number) => {
        const rows = rungOf(rung);
        const hits = rows.filter((r) => r.ok).length;
        const last2 = rows.slice(-2);
        const twoMiss = last2.length === 2 && last2.every((r) => !r.ok);
        return hits >= need && !twoMiss && rows.length >= burst;
      };
      const soundsPass = pass("sounds", 3, 4);
      const lettersPass = pass("letters", 4, 6);
      const cvcPass = pass("cvc", 3, 4);
      if (!soundsPass) {
        grade = "S";
        note = "Stopped on sounds. First-sound play, no print.";
      } else if (!lettersPass) {
        grade = "L";
        note = "Passed sounds, stopped on letters.";
      } else if (!cvcPass) {
        grade = "C";
        note = "Passed letters, stopped on CVC.";
      } else {
        grade = "C+";
        note = "Passed CVC. Short CVC lessons next.";
      }
      owned = all.filter((r) => r.ok).map((r) => r.id).slice(0, 4);
      kidLine = grade === "S" ? "You found the snake!" : "You flew through a letter!";
    }
    house.finishPlacement(child.id, grade, note, kidLine, owned);
    router.push(`/kids/${kidId}/done?kind=place`);
  };

  const struggle = (next: typeof results, rung: string) => {
    const rows = next.filter((r) => r.rung === rung);
    const last2 = rows.slice(-2);
    if (last2.length === 2 && last2.every((r) => !r.ok)) return true;
    if (rung === "sounds" && rows.length >= 4 && rows.filter((r) => r.ok).length < 2) return true;
    if (rung === "letters" && rows.length >= 4 && rows.filter((r) => r.ok).length < 2) return true;
    if (rung === "cvc" && rows.length >= 4 && rows.filter((r) => r.ok).length < 2) return true;
    return false;
  };

  const onPick = (choiceId: string) => {
    if (!item || locked) return;
    const ok = choiceId === item.correctId;
    setLocked(true);
    const row = { id: item.id, rung: item.rung, ok, dim: item.dimension };
    const next = [...results, row];
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
      setBanner(theme.win);
      house.addStars(child.id, 1);
    } else {
      setShaken(choiceId);
      setBanner(theme.miss);
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
        if (i + 1 >= plan.length || (i + 1 >= 6 && next.length >= 6)) finish(next);
        else setI(i + 1);
        return;
      }
      if (struggle(next, item.rung)) {
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

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-5`}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} onEnough={() => router.push(`/kids/${kidId}/done?kind=place`)} />
      <p className="display mt-4 text-center text-4xl leading-tight">{lesson.prompt}</p>
      <Replay prompt={lesson.prompt} hint={lesson.parentHint} />
      {banner ? <div className="mt-4"><HonestBanner text={banner} party={party} /></div> : null}
      <div className="mx-auto mt-6 max-w-lg">
        <ChoiceGrid choices={lesson.choices ?? []} onPick={onPick} shaken={shaken} />
      </div>
    </main>
  );
}

function Replay({ prompt, hint }: { prompt: string; hint?: string }) {
  return (
    <div className="mt-3 flex justify-center gap-3">
      <button type="button" onClick={() => speak(prompt)} className="rounded-full bg-white/20 px-5 py-3 text-xl font-black">
        🔊 Again
      </button>
      {hint ? <p className="sr-only">{phonemeHint(hint)}</p> : null}
    </div>
  );
}

function KidChrome({
  kidName,
  stars,
  themeId,
  onEnough,
}: {
  kidName: string;
  stars: number;
  themeId: ThemeId;
  onEnough?: () => void;
}) {
  const t = themeOf(themeId);
  const hold = useRef<number | null>(null);
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="host-float text-5xl"
        aria-label={t.host}
        onPointerDown={() => {
          if (!onEnough) return;
          hold.current = window.setTimeout(onEnough, 1600);
        }}
        onPointerUp={() => {
          if (hold.current) window.clearTimeout(hold.current);
        }}
      >
        {t.hostEmoji}
      </button>
      <p className="display text-2xl">{kidName}</p>
      <p className="rounded-full bg-white/20 px-4 py-2 text-xl font-black">⭐ {stars}</p>
    </div>
  );
}

export function DailySession({ kidId, mode }: { kidId: string; mode: "daily" | "scout" | "try" }) {
  const house = useHouse();
  const router = useRouter();
  const child = house.kid(kidId);
  const theme = themeOf(child?.themeToday);
  const module = child ? kidNextModule(child, house.state) : undefined;
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
      const n = child?.sessionLength === "shorter" ? 5 : child?.sessionLength === "longer" ? 9 : 7;
      setQueue(base.slice(0, n));
    }
  }, [module, mode, child?.sessionLength, child?.track]);

  useEffect(() => {
    if (item) speak(item.prompt);
    start.current = Date.now();
  }, [item]);

  if (!house.ready || !child) return <p className="p-8">Loading…</p>;
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
      <main className={`kid-stage theme-${theme.id} p-6`}>
        <p className="display text-4xl">No module on the path yet.</p>
        <Link href="/parent" className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-stone-900">Parent path</Link>
      </main>
    );
  }

  const blockedWord = !wordsUnlocked(child) && (item.dimension === "words" || item.dimension === "sentences" || Boolean(item.word && item.slots && item.slots.length > 1));
  const playItem: LessonItem = blockedWord
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
      setBanner(theme.win);
      house.addStars(child.id, 1);
      setWins((w) => w + 1);
    } else {
      setBanner(theme.miss);
    }
    window.setTimeout(() => {
      setBanner(null);
      setParty(false);
      setShaken(undefined);
      if (ok) {
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

  return (
    <main className={`kid-stage theme-${theme.id} px-4 py-5`}>
      <KidChrome kidName={child.name} stars={child.stars} themeId={theme.id} onEnough={() => router.push(`/kids/${kidId}/done?kind=${mode}`)} />
      <p className="mt-2 text-center text-lg opacity-80">{mode === "scout" ? "Secret tunnel" : "Today's adventure"}</p>
      <p className="display mt-3 text-center text-4xl leading-tight">{playItem.prompt}</p>
      <Replay prompt={playItem.prompt} hint={playItem.parentHint} />
      {banner ? <div className="mt-4"><HonestBanner text={banner} party={party} /></div> : null}
      <div className="mx-auto mt-6 max-w-lg">
        {playItem.kind === "tap" ? (
          <ChoiceGrid
            choices={playItem.choices ?? []}
            shaken={shaken}
            onPick={(id) => {
              const ok = id === playItem.correctId;
              if (!ok) setShaken(id);
              after(ok, "tap");
            }}
          />
        ) : null}
        {playItem.kind === "drag" ? <DragBoard item={playItem} onDone={(ok) => after(ok, "drag")} /> : null}
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

export function KidPicker() {
  const { state, ready } = useHouse();
  if (!ready) return <p className="p-8 text-white">Loading…</p>;
  return (
    <main className="kid-stage theme-planets-space px-4 py-6">
      <p className="display text-center text-5xl">Who&apos;s reading?</p>
      <p className="mt-2 text-center text-xl">Tap a face. Stars, not grades.</p>
      <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3">
        {state.kids.map((k) => (
          <Link
            key={k.id}
            href={k.status === "waiting" ? `/kids/${k.id}/waiting` : `/kids/${k.id}/theme`}
            className="fat-card flex items-center justify-between p-5"
          >
            <span>
              <span className="display block text-4xl">{k.name}</span>
              <span className="text-lg opacity-70">
                {k.status === "waiting" ? "Coming later" : k.track === "letters" ? "Letters and sounds" : "Word adventure"}
              </span>
            </span>
            <span className="text-3xl">{k.status === "waiting" ? "🔒" : `⭐ ${k.stars}`}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
