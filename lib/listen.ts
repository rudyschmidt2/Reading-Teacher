"use client";

import { useEffect, useState } from "react";
import { isRepeatAsk } from "./repeat-ask";
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
  abort: () => void;
};

type RecEvent = {
  results: ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>;
};

const listenFns = new Set<(on: boolean) => void>();
let rec: Rec | null = null;
let wanted = false;
let paused = false;
let promptOf = (): string => "";
let armed = false;

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

function stopRec() {
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
    r.abort();
  } catch {
    try {
      r.stop();
    } catch {
      /* already stopped */
    }
  }
  setListening(false);
}

function startRec() {
  if (!wanted || paused || isVoiceMuted() || isVoiceSpeaking()) return;
  const Make = Ctor();
  if (!Make) return;
  stopRec();
  const next = new Make();
  next.lang = "en-US";
  next.continuous = true;
  next.interimResults = true;
  next.maxAlternatives = 3;
  next.onresult = (e) => {
    const rows = Array.from(e.results as ArrayLike<{ isFinal?: boolean; 0: { transcript: string } }>);
    const last = rows[rows.length - 1];
    if (!last) return;
    const text = last[0].transcript;
    if (!last.isFinal && !isRepeatAsk(text)) return;
    if (!isRepeatAsk(text)) return;
    const prompt = promptOf();
    if (prompt) speak(prompt);
  };
  next.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      wanted = false;
    }
    setListening(false);
  };
  next.onend = () => {
    rec = null;
    setListening(false);
    if (wanted && !paused && !isVoiceSpeaking()) window.setTimeout(startRec, 180);
  };
  rec = next;
  try {
    next.start();
    setListening(true);
  } catch {
    rec = null;
    setListening(false);
  }
}

subscribeVoiceStart(() => stopRec());
subscribeVoiceIdle(() => {
  if (wanted && !paused) startRec();
});

export function unlockKidMic() {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const Make = Ctor();
  if (!Make) return;
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

export function startRepeatListen(getPrompt: () => string) {
  promptOf = getPrompt;
  wanted = true;
  paused = false;
  if (!isVoiceSpeaking()) startRec();
  return () => {
    wanted = false;
    stopRec();
  };
}

export function pauseRepeatListen() {
  paused = true;
  stopRec();
}

export function resumeRepeatListen() {
  paused = false;
  if (wanted && !isVoiceSpeaking()) startRec();
}

export function usePromptRepeat(prompt?: string) {
  useEffect(() => {
    if (!prompt) return;
    return startRepeatListen(() => prompt);
  }, [prompt]);
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

export { isRepeatAsk };
