import { daysBetween, localDay } from "./clock.ts";
import type { Child } from "./types";

export type ScoutClock = Pick<Child, "dailySessions" | "lastDailyDate" | "lastScoutDate"> & { plan?: { lastScoutSession?: number } };

export function todayStamp(now = new Date()): string {
  return localDay(now);
}

/**
 * A scout is due after a daily finished today and: the kid has five or more
 * dailies and has never scouted; or five dailies have passed since the last
 * scout; or the last scout is a week old. Never on a day with no daily (no
 * cold open) and never twice in one day.
 */
export function scoutDue(child: ScoutClock, now = new Date()): boolean {
  const today = todayStamp(now);
  const sessions = child.dailySessions ?? 0;
  if (child.lastDailyDate !== today) return false;
  if (child.lastScoutDate === today) return false;

  const neverScouted = !child.lastScoutDate;
  const since = child.plan?.lastScoutSession;
  const fiveSince = since !== undefined ? sessions - since >= 5 : sessions > 0 && sessions % 5 === 0;
  const firstScout = neverScouted && sessions >= 5;
  const weekly = child.lastScoutDate ? daysBetween(child.lastScoutDate, today) >= 7 : false;
  return firstScout || fiveSince || weekly;
}

export function scoutDueReason(child: ScoutClock, now = new Date()): string | null {
  if (!scoutDue(child, now)) return null;
  return "Scout sitting is due — daily path will not auto-change.";
}
