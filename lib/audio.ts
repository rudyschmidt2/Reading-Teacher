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
  voiceLastError,
  voiceStatus,
} from "./voice";
export {
  canListen,
  isRepeatAsk,
  tapEar,
  useHeard,
  useLessonListen,
  useListening,
  useMicBlocked,
  useTeacherTalking,
} from "./listen";
