"use client";

import { parseSpeakKind, prepareSpokenText, type SpeakKind } from "./phonemes";

const MUTE_KEY = "reading-teacher-voice-mute";
const CACHE_NAME = "reading-teacher-voice-v2";
const MAX_TEXT = 280;

let playToken = 0;
let current: HTMLAudioElement | null = null;
let inflight: AbortController | null = null;
let muted = false;
let speaking = false;
let configured: boolean | null = null;
let lastError: string | null = null;
const memory = new Map<string, string>();
const startFns = new Set<() => void>();
const idleFns = new Set<() => void>();

export function isVoiceSpeaking() {
  return speaking;
}

export function subscribeVoiceStart(fn: () => void) {
  startFns.add(fn);
  return () => {
    startFns.delete(fn);
  };
}

export function subscribeVoiceIdle(fn: () => void) {
  idleFns.add(fn);
  return () => {
    idleFns.delete(fn);
  };
}

function markStart() {
  speaking = true;
  startFns.forEach((fn) => fn());
}

function markIdle() {
  speaking = false;
  idleFns.forEach((fn) => fn());
}

function readMute() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

muted = typeof window !== "undefined" ? readMute() : false;

export function isVoiceMuted() {
  return muted;
}

export function voiceLastError() {
  return lastError;
}

export function setVoiceMuted(next: boolean) {
  muted = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  }
  if (next) stopSpeech();
}

export function stopSpeech() {
  playToken += 1;
  inflight?.abort();
  inflight = null;
  speaking = false;
  if (current) {
    current.pause();
    current.removeAttribute("src");
    current.load();
    current = null;
  }
}

function voiceUrl(spoken: string, kind: SpeakKind) {
  const q = new URLSearchParams({ text: spoken, kind });
  return `/api/voice?${q.toString()}`;
}

async function blobFromCache(url: string): Promise<Blob | null> {
  const cachedUrl = memory.get(url);
  if (cachedUrl) {
    const res = await fetch(cachedUrl);
    if (res.ok) return res.blob();
  }
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    return hit ? hit.blob() : null;
  } catch {
    return null;
  }
}

async function remember(url: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const old = memory.get(url);
  if (old) URL.revokeObjectURL(old);
  memory.set(url, objectUrl);
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "audio/wav" } }));
  } catch {
    /* private mode / quota — memory cache is enough */
  }
}

function playBlobUrl(src: string, token: number) {
  if (token !== playToken) return;
  const audio = new Audio(src);
  current = audio;
  markStart();
  const done = () => {
    if (current === audio) {
      current = null;
      markIdle();
    }
  };
  audio.onended = done;
  audio.onerror = done;
  audio.play().catch(() => {
    done();
  });
}

async function playVoice(text: string, kind: SpeakKind) {
  if (typeof window === "undefined" || muted) return;
  const spoken = prepareSpokenText(text, kind).slice(0, MAX_TEXT);
  if (!spoken) return;

  stopSpeech();
  const token = playToken;
  markStart();
  const url = voiceUrl(spoken, kind);

  const cached = await blobFromCache(url);
  if (token !== playToken) return;
  if (cached) {
    const src = memory.get(url) ?? URL.createObjectURL(cached);
    if (!memory.has(url)) memory.set(url, src);
    playBlobUrl(src, token);
    return;
  }

  if (configured === false) {
    lastError = "Natural voice is not set up. Add OPENAI_API_KEY.";
    markIdle();
    return;
  }

  const ac = new AbortController();
  inflight = ac;
  let res: Response;
  try {
    res = await fetch(url, { signal: ac.signal, headers: { Accept: "audio/wav, audio/mpeg" } });
  } catch {
    if (token === playToken) markIdle();
    return;
  }
  if (token !== playToken) return;
  if (res.status === 503) {
    configured = false;
    lastError = "Natural voice is not set up. Add OPENAI_API_KEY.";
    markIdle();
    return;
  }
  if (!res.ok) {
    let message = "Teacher voice failed.";
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* keep default */
    }
    lastError = message;
    markIdle();
    return;
  }
  configured = true;
  lastError = null;
  const blob = await res.blob();
  if (token !== playToken) return;
  await remember(url, blob);
  const src = memory.get(url);
  if (src) playBlobUrl(src, token);
}

export function speak(text: string, kind: SpeakKind = "prompt") {
  void playVoice(text, parseSpeakKind(kind));
}

export function speakPrompt(text: string) {
  speak(text, "prompt");
}

export function speakPhoneme(phoneme: string) {
  speak(phoneme, "phoneme");
}

export function speakLetter(letter: string) {
  speak(letter, "letter");
}

export async function voiceStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch("/api/voice", { headers: { Accept: "application/json" } });
    const data = (await res.json()) as { configured?: boolean };
    configured = Boolean(data.configured);
    return { configured: configured };
  } catch {
    return { configured: configured === true };
  }
}

export type { SpeakKind };
