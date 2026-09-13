import { NextResponse } from "next/server";
import { parseSpeakKind, prepareSpokenText, type SpeakKind } from "@/lib/phonemes";

const MAX_TEXT = 280;

const PROMPT_STYLE =
  "Speak in a warm, clear American English voice for children ages 3 to 7. Stay calm and unhurried. Do not sound cartoonish, high-pitched, or theatrical. Enunciate every word. When the line includes a stretched sound such as ssss, mmm, or aaa, apple, hold that sound so the phoneme is easy to hear.";

const PHONEME_STYLE =
  "This is a single letter sound for a phonics lesson. Say only the sound, clearly and steadily, so a young child can copy it. Do not add extra words. Hold continuants. Keep stop sounds crisp.";

const LETTER_STYLE =
  "Say the English letter name only, clearly and calmly, for a child ages 3 to 7. No extra words.";

function styleFor(kind: SpeakKind) {
  if (kind === "phoneme") return PHONEME_STYLE;
  if (kind === "letter") return LETTER_STYLE;
  return PROMPT_STYLE;
}

function ttsAuth() {
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      url: "https://api.openai.com/v1/audio/speech",
      key: openai,
      model: process.env.READING_TEACHER_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
    };
  }
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gateway) {
    return {
      url: "https://ai-gateway.vercel.sh/v1/audio/speech",
      key: gateway,
      model: process.env.READING_TEACHER_TTS_MODEL?.trim() || "openai/gpt-4o-mini-tts",
    };
  }
  return null;
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

async function synthesize(raw: string, kind: SpeakKind) {
  const auth = ttsAuth();
  if (!auth) return missingKey();

  const spoken = prepareSpokenText(raw, kind).slice(0, MAX_TEXT);
  if (!spoken) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  const voice = process.env.READING_TEACHER_VOICE?.trim() || "coral";
  const payload: Record<string, unknown> = {
    model: auth.model,
    voice,
    input: spoken,
    response_format: "mp3",
    speed: 0.92,
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

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { configured: true, error: "tts_failed", status: res.status, detail: detail.slice(0, 240) },
      { status: 502 },
    );
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
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
