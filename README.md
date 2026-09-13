# Reading Teacher

Phonics-first site for Riley (7), Hudson (6), Myles (3), and Cassidy (1, waiting).

Kids pick a face, smash today’s theme, take placement, then play tap / drag / speak adventures. Honest miss: “not that one.” Stars only on real hits. Parent desk holds grades, speed, pass/fail, and the create / reorder / ease / harden loop.

## Run

```bash
npm install
cp .env.example .env.local
# put OPENAI_API_KEY in .env.local
npm run dev
```

Kid voiceover uses OpenAI `gpt-4o-mini-tts` (voice `coral`) via `/api/voice`. Primary env: `OPENAI_API_KEY`. Optional: `AI_GATEWAY_API_KEY`, `READING_TEACHER_VOICE`, `READING_TEACHER_TTS_MODEL`. On Vercel, add `OPENAI_API_KEY` under Project → Settings → Environment Variables, then redeploy. If the key is missing, kids still see the big written prompt.

## Kids

| Child | Age | Track |
| --- | --- | --- |
| Riley | 7 | Phonics / words |
| Hudson | 6 | Same ladder, own pace |
| Myles | 3 | Letters and sounds only until unlock |
| Cassidy | 1 | Waiting. No lessons. |

Daily themes (kid-picked): large animals, airplanes, planets and space, bugs, spaceships, farming and equipment (trucks, choppers, wheat, silage, corn, tractors, implements, cars), race cars.

House rules for later agents: [`docs/project-context.md`](docs/project-context.md). Work lanes (voice vs listen vs PWA vs play leftovers): [`docs/agent-lanes.md`](docs/agent-lanes.md).
