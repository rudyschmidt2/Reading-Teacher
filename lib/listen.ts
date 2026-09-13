"use client";

import { useEffect, useRef, useState } from "react";
import { isSpokenHit } from "./phonemes";
import { isRepeatAsk, looksLikeAttempt } from "./repeat-ask";
import { isVoiceMuted, isVoiceSpeaking, speak, subscribeVoiceIdle, subscribeVoiceStart } from "./voice";

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
};

type RecEvent = {
  results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>;
};

type Turn = {
  prompt: string;
  target?: string;
  onAnswer?: (heard: string, hit: boolean) => void;
};

const listenFns = new Set<(on: boolean) => void>();
const heardFns = new Set<(text: string) => void>();
const blockFns = new Set<(on: boolean) => void>();
let rec: Rec | null = null;
let turn: Turn | null = null;
let wanted = false;
let halt = false;
let armed = false;
let restartTimer = 0;
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
  blocked = on;
  blockFns.forEach((fn) => fn(on));
}

function stopRec() {
  if (restartTimer) {
    window.clearTimeout(restartTimer);
    restartTimer = 0;
  }
  if (!rec) {
    setListening(false);
    return;
  }
  const r = rec;
  rec = null;
  r.onresult = null;
  r.onerror = null;
  r.onend = null;
  try {
    r.stop();
  } catch {
    /* already stopped */
  }
  setListening(false);
}

function startRec() {
  if (!wanted || halt || !turn || isVoiceMuted() || isVoiceSpeaking()) return;
  const Make = Ctor();
  if (!Make) return;
  stopRec();
  const next = new Make();
  next.lang = "en-US";
  next.continuous = false;
  next.interimResults = true;
  next.maxAlternatives = 3;
  next.onresult = (e) => {
    const rows = Array.from(e.results as ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>);
    const last = rows[rows.length - 1];
    if (!last) return;
    const text = last[0].transcript;
    const live = turn;
    if (!live) return;
    const repeat = isRepeatAsk(text);
    const hit = live.target ? isSpokenHit(text, live.target) : false;
    if (!last.isFinal && !repeat && !hit) return;
    if (repeat) {
      speak(live.prompt);
      return;
    }
    if (live.target && looksLikeAttempt(text)) {
      setHeard(text);
      if (hit) wanted = false;
      live.onAnswer?.(text, hit);
      if (hit) stopRec();
    }
  };
  next.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      wanted = false;
      setBlocked(true);
      setListening(false);
      return;
    }
    setListening(false);
  };
  next.onend = () => {
    rec = null;
    setListening(false);
    if (wanted && !halt && turn && !isVoiceSpeaking()) {
      restartTimer = window.setTimeout(startRec, 280);
    }
  };
  rec = next;
  try {
    next.start();
    setListening(true);
  } catch {
    rec = null;
    setListening(false);
    if (wanted && !halt) restartTimer = window.setTimeout(startRec, 400);
  }
}

subscribeVoiceStart(() => {
  halt = true;
  stopRec();
});
subscribeVoiceIdle(() => {
  halt = false;
  if (wanted) window.setTimeout(startRec, 220);
});

export function unlockKidMic() {
  if (typeof window === "undefined") return;
  const Make = Ctor();
  if (!Make) return;
  if (armed) {
    if (wanted && !halt && !rec && !isVoiceSpeaking()) startRec();
    return;
  }
  armed = true;
  setBlocked(false);
  const probe = new Make();
  probe.onerror = () => {};
  probe.onend = () => {};
  try {
    probe.start();
    probe.stop();
  } catch {
    armed = false;
  }
}

function beginTurn(next: Turn) {
  turn = next;
  wanted = true;
  halt = isVoiceSpeaking();
  setHeard("");
  if (!halt) startRec();
}

function endTurn() {
  wanted = false;
  turn = null;
  stopRec();
}

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
    if (!enabled || !prompt) {
      endTurn();
      return;
    }
    beginTurn({
      prompt,
      target,
      onAnswer: (heard, hit) => answer.current?.(heard, hit),
    });
    return () => endTurn();
  }, [prompt, target, enabled]);
}

export function useListening() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    listenFns.add(setOn);
    return () => {
      listenFns.delete(setOn);
    };
  }, []);
  return on;
}

export function useMicBlocked() {
  const [on, setOn] = useState(blocked);
  useEffect(() => {
    blockFns.add(setOn);
    return () => {
      blockFns.delete(setOn);
    };
  }, []);
  return on;
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
