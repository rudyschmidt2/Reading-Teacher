export type Progress = {
  lettersPracticed: string[];
  wordsBuilt: string[];
  sessionsCompleted: number;
  lastPlayedAt: string | null;
};

export const PROGRESS_KEY = "reading-teacher-progress-v1";

export function emptyProgress(): Progress {
  return {
    lettersPracticed: [],
    wordsBuilt: [],
    sessionsCompleted: 0,
    lastPlayedAt: null,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function mergeSession(
  current: Progress,
  letters: string[],
  words: string[],
  playedAt: string,
): Progress {
  return {
    lettersPracticed: unique([...current.lettersPracticed, ...letters]),
    wordsBuilt: unique([...current.wordsBuilt, ...words]),
    sessionsCompleted: current.sessionsCompleted + 1,
    lastPlayedAt: playedAt,
  };
}

export function parseProgress(raw: string | null): Progress {
  if (!raw) {
    return emptyProgress();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      lettersPracticed: Array.isArray(parsed.lettersPracticed)
        ? parsed.lettersPracticed.filter((item) => typeof item === "string")
        : [],
      wordsBuilt: Array.isArray(parsed.wordsBuilt)
        ? parsed.wordsBuilt.filter((item) => typeof item === "string")
        : [],
      sessionsCompleted:
        typeof parsed.sessionsCompleted === "number"
          ? parsed.sessionsCompleted
          : 0,
      lastPlayedAt:
        typeof parsed.lastPlayedAt === "string" ? parsed.lastPlayedAt : null,
    };
  } catch {
    return emptyProgress();
  }
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") {
    return emptyProgress();
  }

  return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
}

export function saveSession(letters: string[], words: string[]): Progress {
  const next = mergeSession(
    loadProgress(),
    letters,
    words,
    new Date().toISOString(),
  );

  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
}
