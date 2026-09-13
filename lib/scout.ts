import type { Child } from "./types";

export type ScoutClock = Pick<Child, "dailySessions" | "lastDailyDate" | "lastScoutDate">;

export function todayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

export function scoutDue(child: ScoutClock, now = new Date()): boolean {
  const today = todayStamp(now);
  const sessions = child.dailySessions ?? 0;
  if (child.lastDailyDate !== today) return false;
  if (child.lastScoutDate === today) return false;

  const neverScouted = !child.lastScoutDate;
  const everyFive = sessions > 0 && sessions % 5 === 0;
  const firstScout = neverScouted && sessions >= 5;
  const weekly = child.lastScoutDate ? daysBetween(child.lastScoutDate, today) >= 7 : false;
  return firstScout || everyFive || weekly;
}

export function scoutDueReason(child: ScoutClock, now = new Date()): string | null {
  if (!scoutDue(child, now)) return null;
  return "Scout sitting is due — daily path will not auto-change.";
}
