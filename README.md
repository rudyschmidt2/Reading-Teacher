# Reading Teacher

Phonics-first site for Riley (7), Hudson (6), Myles (3), and Cassidy (1, waiting).

Kids pick a face, smash today’s theme, take placement, then play tap / drag / speak adventures. Honest miss: “not that one.” Stars only on real hits. Parent desk holds grades, speed, pass/fail, and the create / reorder / ease / harden loop.

## Run

```bash
npm install
npm run dev
```

## Voiceover

Lesson prompts and letter sounds use a natural neural teacher voice (OpenAI `gpt-4o-mini-tts`, voice `coral`) — warm and clear for Riley (7), Hudson (6), and Myles (3). Browser `speechSynthesis` is not used; it muffled phonemes.

Add one of these to `.env.local` (local) or the Vercel project env (Production / Preview / Development):

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes (primary) | OpenAI key for `/v1/audio/speech`. Never commit it. |
| `AI_GATEWAY_API_KEY` | Alternative | Used only if `OPENAI_API_KEY` is unset. Calls Vercel AI Gateway TTS. |
| `READING_TEACHER_VOICE` | No | Voice id. Default `coral`. |
| `READING_TEACHER_TTS_MODEL` | No | Default `gpt-4o-mini-tts` (or `openai/gpt-4o-mini-tts` on the gateway). |

```bash
cp .env.example .env.local
# put the real key in .env.local
```

On Vercel: Project → Settings → Environment Variables → add `OPENAI_API_KEY`, then redeploy.

If the key is missing, kids still see the big written prompt. The parent desk shows a note and Voice on / Voice off. Same phrases are cached (browser + HTTP) so repeats stay snappy.

Hear a prompt and `/s/` from the parent desk Voiceover card to check clarity.

## Kids

| Child | Age | Track |
| --- | --- | --- |
| Riley | 7 | Phonics / words |
| Hudson | 6 | Same ladder, own pace |
| Myles | 3 | Letters and sounds only until unlock |
| Cassidy | 1 | Waiting. No lessons. |

Daily themes (kid-picked): large animals, airplanes, planets and space, bugs, spaceships, farming and equipment (trucks, choppers, wheat, silage, corn, tractors, implements, cars), race cars.
