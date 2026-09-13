# Agent lanes

The voiceover agent got follow-ups that are not voiceover. Keep work in the lane that owns it.

## Voiceover — [PR #3](https://github.com/rudyschmidt2/Reading-Teacher/pull/3)

**Owner:** [Natural voiceover for Reading Teacher](https://cursor.com/agents/bc-4d1fcda0-071b-5903-b171-a7655161bd22)  
**Branch:** `cursor/natural-voice-voiceover-bd22`

Rudy said kid-facing spoken prompts were hard to understand. Browser `speechSynthesis` muffles phonemes. `/s/` `/ă/` `/t/` never even used the hint helper.

This lane owns:

- `lib/voice.ts`, `lib/phonemes.ts`, `app/api/voice/route.ts`
- Neural TTS (OpenAI `gpt-4o-mini-tts`, voice `coral`) for prompts and letter sounds
- Cache, cancel previous clip, parent mute / Hear a prompt / Hear /s/
- Env: `OPENAI_API_KEY` (primary), `AI_GATEWAY_API_KEY`, `READING_TEACHER_VOICE`, `READING_TEACHER_TTS_MODEL`
- No robotic browser fallback pretending to be natural. Missing key → written prompt only + parent note.

Still owed on that PR: hear the voice with a real key on an iPad. Do not merge unless asked.

## Listen / “what-repeat” — same PR for now, split if it fights SpeakPanel

Follow-up dumped on the voiceover agent: if the child says **what / huh / repeat / again / say it again**, replay the last prompt.

Code lives on PR #3 (`lib/listen.ts`, `lib/repeat-ask.ts`). Treat further work as **verify + harden**, not a new dump onto voiceover:

- iPad Safari mic permission after Add to Home Screen
- Pause mic while TTS plays
- Do not grade “what” / “again” as a spoken attempt
- Do not steal the existing Say-it widget

## PWA — same PR for now, split if icons / SW need a real pass

Follow-up dumped on the voiceover agent: “This needs to be a PWA app does that help?” Yes for tablet mic + cached clips.

Code lives on PR #3 (`app/manifest.ts`, `components/Pwa.tsx`, `public/sw.js`, icons). Further work:

- Real A2HS on iPad Safari
- Icon quality
- Service-worker cache policy (do not break lesson play)

Do **not** start a second service worker on another branch.

## Product / play leftover — this branch

House rules live in `docs/project-context.md`. These were specified in the Program chat and only half-built on main:

| Lane | Status on main | Do |
| --- | --- | --- |
| Periodic scout sitting | Manual “Send a scout” only. Reports exist. | After 5 dailies or 7 days, offer a secret tunnel. Never cold-open the day. Path does not auto-change. |
| Host “that’s enough” | Host hold (1.6s) already ends play. Easy to miss. | Keep hold. Make it findable (hold-fill like the parent door). Kid copy: “That’s enough.” Never fail. |
| Skip-stuck | Miss retries the **same** card (`version++`). | After two honest misses, deal another item of the same skill/dimension. No “skip” / “easier” on the kid door. |
| Create module | Parent form exists. | Leave unless the form is broken. |
| Vowel faces | Colors already locked in `VOWEL_FACE` + `.vowel-*`. | Audit only. Do not restyle per theme. |
| Offline / trip pack | App is already localStorage-first. PWA cache is PR #3. | Short session on a narrow phone. Do not add a second SW. |
| Activate Cassidy | Parent Activate button exists. | Leave waiting. No fake lessons. |

## Do not put back on the voiceover agent

- Kids, tracks, themes, placement shelves, parent grading, scout, skip-stuck, trip layout
- Curriculum banks / SATPIN coverage
- A second PWA or a second TTS stack
