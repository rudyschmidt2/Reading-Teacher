"use client";

export { isSpokenHit, phonemeHint, prepareSpokenText, type SpeakKind } from "./phonemes";
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
export {
  canListen,
  isRepeatAsk,
  unlockKidMic,
  useHeard,
  useLessonListen,
  useListening,
} from "./listen";
