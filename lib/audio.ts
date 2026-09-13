"use client";

export { phonemeHint, prepareSpokenText, type SpeakKind } from "./phonemes";
export {
  speak,
  speakLetter,
  speakPhoneme,
  speakPrompt,
  stopSpeech,
  isVoiceMuted,
  setVoiceMuted,
  voiceStatus,
} from "./voice";
