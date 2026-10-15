---
name: verify-reading-teacher
description: Drive Reading Teacher in a browser and prove a change with screenshots. Use before calling UI work done on this repo.
---

# Verify Reading Teacher

Surface: signed-in web app. Other surfaces (cron routes, export APIs) are not the thing a person taps; do not treat a 200 from an API as proof of a screen.

This skill was written from the route map on 2026-10-15. If a path below 404s, fix this file in the same change. Run maintain-verification-skill when screens move.

## Launch

From the repo root:

```bash
npm install
npm run dev
```

Ready means a browser can load `http://127.0.0.1:3000/` and see the app shell or the sign-in screen, not merely that a port accepts a socket. `npm run dev` prints a local URL when Next or Vite is up. Record the PID in `artifacts/verify/reading-teacher/server.pid`.

Auth: Parent screens are under `/parent`. Kid play is under `/kids`. Do not start a live voice session just to prove a layout change.

Isolation: one verification server for this app. Do not start a second `npm run dev` against the same port or the same database. If `3000` is already taken by your own session, reuse it and say so. Never point this skill at production for a write, a seed, or a payment.

Teardown is in Cleanup.

## Doctor

```bash
node .cursor/skills/verify-reading-teacher/control.mjs doctor
```

It GETs `http://127.0.0.1:3000/` and prints JSON `{"ok":true,"status":200}` or a 3xx to sign-in. `ok` is false on connection failure or a 5xx. Run doctor before every drive. A database health URL is not a substitute.

## Drive

Harness is Playwright against the local server. Prefer `getByRole` and `data-testid` already in the repo. Do not click by coordinates.

```bash
npx playwright test --reporter=line
```

This repo has no `test:e2e` script. Drive with a one-off Playwright script or the browser, and keep the assertions in the feature file.


Open the feature file that matches the change and drive every entry point it lists. A proof that only hits one convenient button is incomplete when the map lists others.

## Evidence

Write proof to `artifacts/verify/reading-teacher/` and do not delete it in cleanup:

- `note.md` — what changed, the path driven, pass or fail
- screenshot after the action and a second screenshot of the resulting state
- the command output

Exercise the real user path. Do not call a test-only endpoint unless the feature file says the repo's own e2e seed is the supported way to sign in, and never against production. Confirm side effects you claim (a row, a file, a toast) by looking at them, not by trusting the button label.

## Cleanup

Kill only the PID in `artifacts/verify/reading-teacher/server.pid`. Do not `pkill` by process name. Leave `artifacts/verify/reading-teacher/` in place. If the run failed, still kill that PID before retrying so the port is free.

## Helpers

`node .cursor/skills/verify-reading-teacher/control.mjs doctor` — read-only ready check, JSON on stdout, exit 1 when not ready.

`node .cursor/skills/verify-reading-teacher/control.mjs --help` — lists commands. Doctor has no side effects. There is no mutate command.
