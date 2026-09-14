"use client";

import { useEffect, useRef, useState } from "react";
import { isSpokenHit } from "./phonemes";
import { isRepeatAsk, looksLikeAttempt } from "./repeat-ask";
import { isVoiceSpeaking, speak, subscribeVoiceIdle, subscribeVoiceStart } from "./voice";

// The ear is a one-shot. It arms only for a speak step (repeat a word, repeat a
// sentence, read aloud), waits for the teacher to finish talking, opens once,
// and closes on a result, a timeout, or a tap. It never restarts itself: the
// only things that open it again are the teacher replaying the prompt (the
// child asked "again" or tapped Again) or the child tapping the ear.

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type RecEvent = {
  results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>;
};

type Turn = {
  prompt: string;
  target: string;
  onAnswer?: (heard: string, hit: boolean) => void;
  /** Prompt replays that re-armed the ear this turn; capped so it cannot loop. */
  rearms: number;
  answered: boolean;
};

/** Hard cap on one open ear. Chrome usually closes on silence well before this. */
const LISTEN_MS = 8000;
/** Gap after the teacher stops so the tail of her clip is not heard as the answer. */
const AFTER_VOICE_MS = 250;
/** Wait for the prompt clip to begin before deciding the teacher is silent. */
const NO_VOICE_MS = 400;
const MAX_REARMS = 3;

const listenFns = new Set<(on: boolean) => void>();
const heardFns = new Set<(text: string) => void>();
const blockFns = new Set<(on: boolean) => void>();
const talkFns = new Set<(on: boolean) => void>();
let rec: Rec | null = null;
let turn: Turn | null = null;
let pending = false;
let armTimer = 0;
let capTimer = 0;
let lastHeard = "";
let blocked = false;

function Ctor() {
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => Rec;
    SpeechRecognition?: new () => Rec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen() {
  return typeof window !== "undefined" && Boolean(Ctor());
}

function setListening(on: boolean) {
  listenFns.forEach((fn) => fn(on));
}

function setHeard(text: string) {
  lastHeard = text;
  heardFns.forEach((fn) => fn(text));
}

function setBlocked(on: boolean) {
  if (blocked === on) return;
  blocked = on;
  blockFns.forEach((fn) => fn(on));
}

function clearArm() {
  pending = false;
  if (armTimer) {
    window.clearTimeout(armTimer);
    armTimer = 0;
  }
}

function clearCap() {
  if (capTimer) {
    window.clearTimeout(capTimer);
    capTimer = 0;
  }
}

function stopRec() {
  clearCap();
  const r = rec;
  rec = null;
  if (r) {
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    try {
      if (r.abort) r.abort();
      else r.stop();
    } catch {
      /* already stopped */
    }
  }
  setListening(false);
}

/** Opens the ear once. Does nothing while the teacher talks or when nothing is asked. */
function startRec() {
  clearArm();
  if (!turn || turn.answered || rec || blocked || isVoiceSpeaking()) return;
  const Make = Ctor();
  if (!Make) return;
  const live = turn;
  const next = new Make();
  next.lang = "en-US";
  next.continuous = false;
  next.interimResults = true;
  next.maxAlternatives = 3;
  next.onresult = (e) => {
    if (rec !== next || turn !== live || live.answered) return;
    const rows = Array.from(e.results as ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>);
    const last = rows[rows.length - 1];
    if (!last) return;
    const text = last[0].transcript;
    const repeat = isRepeatAsk(text);
    const hit = isSpokenHit(text, live.target);
    if (!last.isFinal && !repeat && !hit) return;
    if (repeat) {
      // The child asked for the prompt again. Speaking it closes the ear
      // (voice start) and re-arms it once for after the replay (voice idle).
      stopRec();
      if (live.rearms < MAX_REARMS) {
        live.rearms += 1;
        speak(live.prompt);
      }
      return;
    }
    if (!looksLikeAttempt(text)) return;
    live.answered = true;
    setHeard(text);
    stopRec();
    live.onAnswer?.(text, hit);
  };
  next.onerror = (e) => {
    if (rec !== next) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") setBlocked(true);
    // Every other error ("no-speech", "aborted", "network") just ends this
    // one-shot; onend closes the ear and nothing reopens it on its own.
  };
  next.onend = () => {
    if (rec !== next) return;
    rec = null;
    clearCap();
    setListening(false);
  };
  rec = next;
  try {
    next.start();
    setListening(true);
    capTimer = window.setTimeout(() => {
      if (rec === next) {
        try {
          next.stop();
        } catch {
          /* already stopped */
        }
      }
    }, LISTEN_MS);
  } catch {
    rec = null;
    setListening(false);
  }
}

/** Arms one open of the ear for when the teacher is quiet. */
function arm(delay: number) {
  clearArm();
  if (!turn || turn.answered) return;
  pending = true;
  armTimer = window.setTimeout(() => {
    armTimer = 0;
    if (!pending) return;
    if (isVoiceSpeaking()) return; // voice idle will fire and open it
    pending = false;
    startRec();
  }, delay);
}

subscribeVoiceStart(() => {
  talkFns.forEach((fn) => fn(true));
  stopRec();
  if (!turn || turn.answered) return;
  if (pending) return;
  // The prompt is being replayed mid-turn (Again button, prompt tap). Listen
  // once more after it, a limited number of times; past that the child taps
  // the ear.
  if (turn.rearms >= MAX_REARMS) return;
  turn.rearms += 1;
  pending = true;
});
subscribeVoiceIdle(() => {
  talkFns.forEach((fn) => fn(false));
  if (pending && turn && !turn.answered) arm(AFTER_VOICE_MS);
});

/** The child (or parent) tapped the ear: stop if it is open, otherwise open it once. */
export function tapEar() {
  if (typeof window === "undefined") return;
  if (rec) {
    clearArm();
    stopRec();
    return;
  }
  if (!turn || turn.answered || isVoiceSpeaking()) return;
  setBlocked(false);
  startRec();
}

function beginTurn(next: Turn) {
  endTurn();
  turn = next;
  setHeard("");
  // The prompt clip usually starts in the same render; give it a beat so we
  // wait for voice idle instead of opening and closing right away. With voice
  // muted or unavailable this timer opens the ear on its own.
  arm(NO_VOICE_MS);
}

function endTurn() {
  clearArm();
  turn = null;
  stopRec();
}

/**
 * Arms the ear for a speak step. Pass a target only when the child must say
 * something; every other step leaves the mic off.
 */
export function useLessonListen(opts: {
  prompt?: string;
  target?: string;
  onAnswer?: (heard: string, hit: boolean) => void;
  enabled?: boolean;
}) {
  const { prompt, target, onAnswer, enabled = true } = opts;
  const answer = useRef(onAnswer);
  answer.current = onAnswer;

  useEffect(() => {
    if (!enabled || !prompt || !target) {
      endTurn();
      return;
    }
    beginTurn({
      prompt,
      target,
      onAnswer: (heard, hit) => answer.current?.(heard, hit),
      rearms: 0,
      answered: false,
    });
    return () => endTurn();
  }, [prompt, target, enabled]);
}

function useFlag(fns: Set<(on: boolean) => void>, initial: boolean) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    fns.add(setOn);
    return () => {
      fns.delete(setOn);
    };
  }, [fns]);
  return on;
}

export function useListening() {
  return useFlag(listenFns, false);
}

export function useMicBlocked() {
  return useFlag(blockFns, blocked);
}

export function useTeacherTalking() {
  return useFlag(talkFns, isVoiceSpeaking());
}

export function useHeard() {
  const [text, setText] = useState(lastHeard);
  useEffect(() => {
    heardFns.add(setText);
    return () => {
      heardFns.delete(setText);
    };
  }, []);
  return text;
}

export { isRepeatAsk, isSpokenHit };
