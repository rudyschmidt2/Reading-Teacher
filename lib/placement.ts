import type { GradeDimension, PlacementShelf } from "./types";

export type PlacementRow = { id: string; rung: string; ok: boolean; dim: GradeDimension };

export function scorePlacement(
  all: PlacementRow[],
  track: "letters" | "words",
): { grade: PlacementShelf; note: string; kidLine: string; owned: string[] } {
  const owned = all.filter((r) => r.ok).map((r) => r.id);
  if (track === "letters") {
    const names = all.filter((r) => r.rung === "names");
    const sounds = all.filter((r) => r.rung === "letter-sounds");
    const nHit = names.filter((r) => r.ok).length;
    const sHit = sounds.filter((r) => r.ok).length;
    const total = all.filter((r) => r.ok).length;
    let grade: PlacementShelf = "A3";
    if (total <= 2) grade = "A0";
    else if (nHit >= 3 && sHit <= 2) grade = "A1";
    else if (sHit >= 3 && nHit <= 2) grade = "A2";
    return {
      grade,
      note: `Names ${nHit}/${Math.max(names.length, 4)}, sounds ${sHit}/${Math.max(sounds.length, 4)}. Stay in letters and sounds.`,
      kidLine: "You beamed up a letter!",
      owned,
    };
  }

  const rungOf = (rung: string) => all.filter((r) => r.rung === rung);
  const pass = (rung: string, need: number, burst: number) => {
    const rows = rungOf(rung);
    const hits = rows.filter((r) => r.ok).length;
    const last2 = rows.slice(-2);
    const twoMiss = last2.length === 2 && last2.every((r) => !r.ok);
    return hits >= need && !twoMiss && rows.length >= burst;
  };
  const soundsPass = pass("sounds", 3, 4);
  const lettersPass = pass("letters", 4, 6);
  const cvcPass = pass("cvc", 3, 4);
  if (!soundsPass) {
    return {
      grade: "S",
      note: "Stopped on sounds. First-sound play, no print.",
      kidLine: "You found the snake!",
      owned: owned.slice(0, 4),
    };
  }
  if (!lettersPass) {
    return {
      grade: "L",
      note: "Passed sounds, stopped on letters.",
      kidLine: "You flew through a letter!",
      owned: owned.slice(0, 4),
    };
  }
  if (!cvcPass) {
    return {
      grade: "C",
      note: "Passed letters, stopped on CVC.",
      kidLine: "You read a real word!",
      owned: owned.slice(0, 4),
    };
  }
  return {
    grade: "C+",
    note: "Passed CVC. Short CVC lessons next.",
    kidLine: "You read a real word!",
    owned: owned.slice(0, 4),
  };
}

export function struggleStop(next: PlacementRow[], rung: string) {
  const rows = next.filter((r) => r.rung === rung);
  const last2 = rows.slice(-2);
  if (last2.length === 2 && last2.every((r) => !r.ok)) return true;
  if ((rung === "sounds" || rung === "letters" || rung === "cvc") && rows.length >= 4 && rows.filter((r) => r.ok).length < 2) {
    return true;
  }
  return false;
}
