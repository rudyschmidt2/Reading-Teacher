"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  LETTERS,
  MATCH_ROUNDS,
  WORDS,
  letterById,
  type CvcWord,
  type Letter,
} from "@/lib/curriculum";
import { saveSession } from "@/lib/progress";
import { speak } from "@/lib/speech";

type Step =
  | { kind: "intro" }
  | { kind: "teach"; index: number }
  | { kind: "match"; index: number }
  | { kind: "build"; index: number }
  | { kind: "done" };

type Feedback = { tone: "ok" | "try"; message: string } | null;

const TOTAL_STEPS = 1 + LETTERS.length + MATCH_ROUNDS.length + WORDS.length + 1;

function stepNumber(step: Step): number {
  switch (step.kind) {
    case "intro":
      return 1;
    case "teach":
      return 2 + step.index;
    case "match":
      return 2 + LETTERS.length + step.index;
    case "build":
      return 2 + LETTERS.length + MATCH_ROUNDS.length + step.index;
    case "done":
      return TOTAL_STEPS;
  }
}

function nextStep(step: Step): Step {
  switch (step.kind) {
    case "intro":
      return { kind: "teach", index: 0 };
    case "teach":
      return step.index + 1 < LETTERS.length
        ? { kind: "teach", index: step.index + 1 }
        : { kind: "match", index: 0 };
    case "match":
      return step.index + 1 < MATCH_ROUNDS.length
        ? { kind: "match", index: step.index + 1 }
        : { kind: "build", index: 0 };
    case "build":
      return step.index + 1 < WORDS.length
        ? { kind: "build", index: step.index + 1 }
        : { kind: "done" };
    case "done":
      return step;
  }
}

function PrimaryButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-sage px-6 text-2xl font-semibold text-white shadow-[0_10px_24px_rgba(44,106,85,0.24)] transition-colors hover:bg-sage-dark focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sage";

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function HearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-14 min-w-40 items-center justify-center rounded-full border-2 border-sage bg-card px-5 text-xl font-semibold text-sage focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sage"
    >
      {label}
    </button>
  );
}

function LetterTile({
  letter,
  onClick,
  used = false,
  disabled = false,
}: {
  letter: string;
  onClick: () => void;
  used?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={used || disabled}
      aria-label={`letter ${letter}`}
      className="flex h-20 w-20 items-center justify-center rounded-3xl bg-card text-4xl font-semibold text-ink shadow-[0_8px_20px_rgba(31,42,36,0.08)] disabled:cursor-default disabled:opacity-30 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sage"
    >
      {letter}
    </button>
  );
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  if (!feedback) {
    return null;
  }

  const ok = feedback.tone === "ok";
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-2xl px-4 py-3 text-center text-xl font-semibold ${
        ok ? "bg-mist text-ok" : "bg-[#f3e6d4] text-try"
      }`}
    >
      {feedback.message}
    </p>
  );
}

function TeachCard({ letter, onNext }: { letter: Letter; onNext: () => void }) {
  useEffect(() => {
    speak(letter.speak);
  }, [letter]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-xl text-muted">This letter says</p>
      <div className="flex h-44 w-44 items-center justify-center rounded-[2.25rem] bg-card text-8xl font-semibold shadow-[0_12px_32px_rgba(31,42,36,0.08)] sm:h-52 sm:w-52 sm:text-9xl">
        {letter.grapheme}
      </div>
      <p className="text-4xl font-semibold text-sage">/{letter.sound}/</p>
      <p className="text-xl text-muted">{letter.hint}</p>
      <div className="flex w-full flex-col items-center gap-3">
        <HearButton label="Hear it" onClick={() => speak(letter.speak)} />
        <PrimaryButton onClick={onNext}>I heard it</PrimaryButton>
      </div>
    </div>
  );
}

function MatchCard({
  letter,
  choices,
  onSolved,
}: {
  letter: Letter;
  choices: string[];
  onSolved: () => void;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    speak(letter.speak);
  }, [letter]);

  function choose(choice: string) {
    if (locked) {
      return;
    }

    if (choice === letter.id) {
      setLocked(true);
      setFeedback({ tone: "ok", message: "Yes. That is the sound." });
      window.setTimeout(onSolved, 850);
      return;
    }

    setFeedback({ tone: "try", message: "Not that one. Try again." });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-2xl font-semibold leading-snug">
        Which letter says{" "}
        <span className="text-sage">/{letter.sound}/</span>?
      </p>
      <HearButton label="Hear the sound" onClick={() => speak(letter.speak)} />
      <div className="flex flex-wrap justify-center gap-3">
        {choices.map((choice) => (
          <LetterTile
            key={choice}
            letter={choice}
            disabled={locked}
            onClick={() => choose(choice)}
          />
        ))}
      </div>
      <FeedbackBanner feedback={feedback} />
    </div>
  );
}

const BUILD_TILES = ["m", "a", "t", "s", "p"];

function BuildCard({ word, onSolved }: { word: CvcWord; onSolved: () => void }) {
  const [filled, setFilled] = useState<string[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    speak(word.speak);
  }, [word]);

  function choose(letter: string) {
    if (locked || used.includes(letter)) {
      return;
    }

    const expected = word.letters[filled.length];
    if (letter !== expected) {
      setFeedback({ tone: "try", message: "Listen again, then tap the next sound." });
      return;
    }

    const nextFilled = [...filled, letter];
    setFilled(nextFilled);
    setUsed([...used, letter]);
    speak(letterById(letter).speak);

    if (nextFilled.length === word.letters.length) {
      setLocked(true);
      setFeedback({ tone: "ok", message: `You built ${word.word}.` });
      window.setTimeout(() => {
        speak(word.speak);
        onSolved();
      }, 1000);
      return;
    }

    setFeedback({ tone: "ok", message: "Yes." });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-2xl font-semibold">Let&apos;s build</p>
      <p className="text-5xl font-semibold text-sage">{word.word}</p>
      <p className="text-lg text-muted">
        {word.letters.map((letter) => `/${letterById(letter).sound}/`).join(" · ")}
      </p>
      <HearButton label="Hear the word" onClick={() => speak(word.speak)} />
      <div className="flex gap-3">
        {word.letters.map((letter, index) => (
          <div
            key={`${letter}-${index}`}
            className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-mist bg-card text-4xl font-semibold"
          >
            {filled[index] ?? ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {BUILD_TILES.map((letter) => (
          <LetterTile
            key={letter}
            letter={letter}
            used={used.includes(letter)}
            disabled={locked}
            onClick={() => choose(letter)}
          />
        ))}
      </div>
      <FeedbackBanner feedback={feedback} />
    </div>
  );
}

export default function LessonFlow() {
  const [step, setStep] = useState<Step>({ kind: "intro" });

  useEffect(() => {
    if (step.kind === "done") {
      saveSession(
        LETTERS.map((letter) => letter.id),
        WORDS.map((word) => word.id),
      );
    }
  }, [step]);

  function advance() {
    setStep((current) => nextStep(current));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6 sm:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-full px-3 text-lg font-semibold text-sage focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sage"
        >
          Home
        </Link>
        <p className="text-base font-semibold text-muted" aria-live="polite">
          {stepNumber(step)} of {TOTAL_STEPS}
        </p>
      </header>

      {step.kind === "intro" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            First we learn sounds.
          </h1>
          <p className="max-w-sm text-pretty text-xl leading-relaxed text-muted">
            Then we tap letters and build three words: mat, sat, and map.
          </p>
          <div className="flex gap-2 text-3xl font-semibold text-sage">
            {LETTERS.map((letter) => (
              <span
                key={letter.id}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card"
              >
                {letter.grapheme}
              </span>
            ))}
          </div>
          <PrimaryButton onClick={advance}>Let&apos;s go</PrimaryButton>
        </div>
      ) : null}

      {step.kind === "teach" ? (
        <TeachCard
          key={LETTERS[step.index].id}
          letter={LETTERS[step.index]}
          onNext={advance}
        />
      ) : null}

      {step.kind === "match" ? (
        <MatchCard
          key={MATCH_ROUNDS[step.index].letterId}
          letter={letterById(MATCH_ROUNDS[step.index].letterId)}
          choices={MATCH_ROUNDS[step.index].choices}
          onSolved={advance}
        />
      ) : null}

      {step.kind === "build" ? (
        <BuildCard
          key={WORDS[step.index].id}
          word={WORDS[step.index]}
          onSolved={advance}
        />
      ) : null}

      {step.kind === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <h1 className="text-5xl font-semibold">You did it.</h1>
          <p className="max-w-sm text-pretty text-xl leading-relaxed text-muted">
            You practiced five sounds and built three words. That is enough for
            today.
          </p>
          <p className="text-2xl font-semibold text-sage">mat · sat · map</p>
          <PrimaryButton href="/">All done</PrimaryButton>
        </div>
      ) : null}
    </main>
  );
}
