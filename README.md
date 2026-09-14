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

Open [http://localhost:3000](http://localhost:3000).

This is a Next.js App Router app and is meant to deploy on Vercel. The only environment variable is the voiceover key described below; everything else runs without configuration.

## Working on it

Each session gets its own worktree and branch; `main` is landed only by the merge queue.

```bash
npm run worktree -- <short-name>   # new worktree + branch off origin/main
npm run sync                       # merge origin/main in before pushing
```

Push the branch, open a PR, and the [merge queue](.github/workflows/merge-queue.yml) updates it with `main`, builds it, and merges it. Details in [AGENTS.md](AGENTS.md).

## Voiceover

Lesson prompts and letter sounds use a natural neural teacher voice (OpenAI `gpt-4o-mini-tts`, voice `marin`, uncompressed `wav`) — warm and clear for Riley (7), Hudson (6), and Myles (3). Phonemes are spoken as short English (`sss`, `a as in apple`), not letter-runs. Browser `speechSynthesis` is not used; it muffled phonemes.

Add one of these to `.env.local` (local) or the Vercel project env (Production / Preview / Development):

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes (primary) | OpenAI key for `/v1/audio/speech`. Never commit it. |
| `AI_GATEWAY_API_KEY` | Alternative | Used only if `OPENAI_API_KEY` is unset. Calls Vercel AI Gateway TTS. |
| `READING_TEACHER_VOICE` | No | Voice id. Default `marin` (or `cedar`). |
| `READING_TEACHER_TTS_MODEL` | No | Default `gpt-4o-mini-tts` (or `openai/gpt-4o-mini-tts` on the gateway). |
| `READING_TEACHER_TTS_FORMAT` | No | Default `wav`. Use `mp3` only if a client cannot play wav. |

```bash
cp .env.example .env.local
# put the real key in .env.local
```

On Vercel: Project → Settings → Environment Variables → add `OPENAI_API_KEY`, then redeploy.

If the key is missing, kids still see the big written prompt. If the key is set but OpenAI has no credits, the parent desk says so — add billing, or set `AI_GATEWAY_API_KEY`. Same phrases are cached so repeats stay snappy.

Hear a prompt and `/s/` from the parent desk Voiceover card to check clarity.

### How a turn works

The microphone is off except on a speak step (repeat a word, repeat a sentence, read aloud).

- Tap / drag / trace: do the move. The mic stays off. Tap **Again** to hear the line again.
- Speak items: the teacher finishes the prompt, then the ear opens once. The orb says “I'm listening.” Wrong word is an honest miss; silence just closes the ear (“Tap to talk” opens it again). Saying **what** or **again** replays the prompt and the ear opens once more after it.
- The ear never restarts on its own, never listens while the teacher talks, and closes when the child leaves the step.
- **Again** on the bottom toolbar (and the big prompt) play the line again. Hold **That's enough** there to finish.
- If the browser blocks the mic the orb says “Allow the mic” once; tap it after allowing.

This needs the tablet microphone (Safari / Chrome). Install as an app so the mic stays allowed.

### Install as an app (PWA)

Yes — a PWA helps. On the iPad, **Add to Home Screen** (Share → Add) so Reading Teacher opens full-screen. That keeps the mic permission and makes voice + “what / again” more reliable than a browser tab.

Chrome on Android: browser menu → Install app.

The app manifest starts at the kids door. A service worker caches repeated voice clips. Use HTTPS (Vercel) for install.

## Kids

| Child | Age | Track |
| --- | --- | --- |
| Riley | 7 | Phonics / words |
| Hudson | 6 | Same ladder, own pace |
| Myles | 3 | Letters and sounds only until unlock |
| Cassidy | 1 | Waiting. No lessons. |

Daily themes (kid-picked): large animals, airplanes, planets and space, bugs, spaceships, farming and equipment (trucks, choppers, wheat, silage, corn, tractors, implements, cars), race cars.

House rules for later agents: [`docs/project-context.md`](docs/project-context.md). Work lanes (voice vs listen vs PWA vs play leftovers): [`docs/agent-lanes.md`](docs/agent-lanes.md).
