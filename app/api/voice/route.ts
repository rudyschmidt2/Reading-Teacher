import { NextResponse } from "next/server";
import { parseSpeakKind, prepareSpokenText, type SpeakKind } from "@/lib/phonemes";

const MAX_TEXT = 280;

const PROMPT_STYLE =
  "Warm, clear American English for children ages 3 to 7. Calm classroom teacher. Not cartoonish, not theatrical. Speak at a natural pace. Enunciate. When a short held sound such as sss or mmm appears, say that sound once, smoothly, inside the sentence. Do not spell letters. Do not pause as if reading a list.";

const PHONEME_STYLE =
  "One phonics sound for a young child to copy. Say only what is written. If it is a held consonant such as sss or mmm, produce that sound once — do not spell it. If it is a phrase like a as in apple, say the phrase naturally. Stop sounds such as tuh stay crisp. No extra words.";

const LETTER_STYLE =
  "Say the English letter name only, clearly and calmly, for a child ages 3 to 7. No extra words.";

const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  opus: "audio/opus",
  aac: "audio/aac",
  pcm: "audio/pcm",
};

function audioFormat() {
  const raw = process.env.READING_TEACHER_TTS_FORMAT?.trim().toLowerCase() || "wav";
  return AUDIO_TYPES[raw] ? raw : "wav";
}

function styleFor(kind: SpeakKind) {
  if (kind === "phoneme") return PHONEME_STYLE;
  if (kind === "letter") return LETTER_STYLE;
  return PROMPT_STYLE;
}

type TtsAuth = { url: string; key: string; model: string; label: "openai" | "gateway" };

function openaiAuth(): TtsAuth | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return {
    url: "https://api.openai.com/v1/audio/speech",
    key,
    model: process.env.READING_TEACHER_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
    label: "openai",
  };
}

function gatewayAuth(): TtsAuth | null {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) return null;
  return {
    url: "https://ai-gateway.vercel.sh/v1/audio/speech",
    key,
    model: process.env.READING_TEACHER_TTS_MODEL?.trim() || "openai/gpt-4o-mini-tts",
    label: "gateway",
  };
}

function ttsAuth() {
  return openaiAuth() ?? gatewayAuth();
}

function isQuota(status: number, detail: string) {
  return status === 429 || /insufficient_quota|no credits remaining/i.test(detail);
}

function parentMessage(status: number, detail: string) {
  if (isQuota(status, detail)) {
    return "The OpenAI key is set, but that account has no credits. Add billing on OpenAI, or set AI_GATEWAY_API_KEY.";
  }
  return "Teacher voice failed. Check OPENAI_API_KEY on Vercel.";
}

function missingKey() {
  return NextResponse.json(
    {
      configured: false,
      error: "missing_key",
      message: "Natural voice needs OPENAI_API_KEY (or AI_GATEWAY_API_KEY). See README.",
    },
    { status: 503 },
  );
}

async function callTts(auth: TtsAuth, spoken: string, kind: SpeakKind) {
  const voice = process.env.READING_TEACHER_VOICE?.trim() || "marin";
  const format = audioFormat();
  const payload: Record<string, unknown> = {
    model: auth.model,
    voice,
    input: spoken,
    response_format: format,
    speed: 1,
  };
  if (auth.model.includes("gpt-4o-mini-tts")) {
    payload.instructions = styleFor(kind);
  }
  const res = await fetch(auth.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const audio = await res.arrayBuffer();
    return { ok: true as const, audio, format };
  }
  const detail = await res.text().catch(() => "");
  return { ok: false as const, status: res.status, detail };
}

async function synthesize(raw: string, kind: SpeakKind) {
  const first = openaiAuth();
  const next = gatewayAuth();
  if (!first && !next) return missingKey();

  const spoken = prepareSpokenText(raw, kind).slice(0, MAX_TEXT);
  if (!spoken) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  const order = [first, next].filter((a): a is TtsAuth => Boolean(a));
  let last: { status: number; detail: string } | null = null;
  for (const [i, auth] of order.entries()) {
    const result = await callTts(auth, spoken, kind);
    if (result.ok) {
      return new NextResponse(result.audio, {
        headers: {
          "Content-Type": AUDIO_TYPES[result.format] ?? "audio/wav",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    last = { status: result.status, detail: result.detail };
    const more = order[i + 1];
    if (!more || !isQuota(result.status, result.detail)) break;
  }

  return NextResponse.json(
    {
      configured: true,
      error: "tts_failed",
      status: last?.status,
      message: parentMessage(last?.status ?? 502, last?.detail ?? ""),
      detail: (last?.detail ?? "").slice(0, 240),
    },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text");
  if (!text) {
    return NextResponse.json({ configured: Boolean(ttsAuth()) });
  }
  return synthesize(text, parseSpeakKind(searchParams.get("kind")));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; kind?: string } | null;
  return synthesize(String(body?.text ?? ""), parseSpeakKind(body?.kind));
}
