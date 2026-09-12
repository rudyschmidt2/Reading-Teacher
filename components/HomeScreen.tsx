"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  PROGRESS_KEY,
  parseProgress,
  type Progress,
} from "@/lib/progress";

function subscribeProgress(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getProgressSnapshot() {
  return window.localStorage.getItem(PROGRESS_KEY);
}

function getServerProgressSnapshot() {
  return null;
}

function LetterPills({ letters }: { letters: string[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {letters.map((letter) => (
        <li
          key={letter}
          className="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-mist px-3 text-2xl font-semibold text-ink"
        >
          {letter}
        </li>
      ))}
    </ul>
  );
}

export default function HomeScreen() {
  const raw = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getServerProgressSnapshot,
  );
  const progress: Progress = parseProgress(raw);
  const hasProgress =
    progress.lettersPracticed.length > 0 || progress.wordsBuilt.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-5 py-8 sm:px-8 sm:py-10">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sage">
          Reading Teacher
        </p>
        <h1 className="mt-4 text-balance text-5xl font-semibold leading-tight sm:text-6xl">
          Hi, reader.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-xl leading-relaxed text-muted">
          We will learn letter sounds, then build little words.
        </p>
      </header>

      <section className="my-10 flex flex-col items-center gap-8">
        <div
          aria-hidden="true"
          className="grid grid-cols-5 gap-2 text-3xl font-semibold text-sage sm:text-4xl"
        >
          {["m", "a", "t", "s", "p"].map((letter) => (
            <span
              key={letter}
              className="flex h-16 w-16 items-center justify-center rounded-3xl bg-card shadow-[0_8px_24px_rgba(31,42,36,0.08)]"
            >
              {letter}
            </span>
          ))}
        </div>

        <Link
          href="/lesson"
          className="inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-sage text-2xl font-semibold text-white shadow-[0_10px_24px_rgba(44,106,85,0.28)] transition-colors hover:bg-sage-dark focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sage"
        >
          Start
        </Link>

        <p className="text-center text-lg text-muted">
          A short practice. About 5 minutes.
        </p>
      </section>

      <section className="rounded-3xl bg-card px-5 py-6 shadow-[0_8px_24px_rgba(31,42,36,0.06)]">
        {hasProgress ? (
          <div className="space-y-4 text-center">
            <h2 className="text-lg font-semibold">You have practiced</h2>
            <LetterPills letters={progress.lettersPracticed} />
            {progress.wordsBuilt.length > 0 ? (
              <p className="text-xl text-muted">
                Words: {progress.wordsBuilt.join(", ")}
              </p>
            ) : null}
            <p className="text-base text-muted">
              {progress.sessionsCompleted}{" "}
              {progress.sessionsCompleted === 1 ? "session" : "sessions"} on
              this device
            </p>
          </div>
        ) : (
          <p className="text-center text-lg leading-relaxed text-muted">
            Today&apos;s sounds: <strong className="text-ink">m a t s p</strong>
          </p>
        )}
      </section>

      <p className="mt-8 text-center text-sm leading-relaxed text-muted">
        For grown-ups: sit nearby the first time. No account needed. Progress
        stays on this device.
      </p>
    </main>
  );
}
