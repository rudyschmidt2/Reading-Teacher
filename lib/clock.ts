/**
 * Wall-clock helpers for timing a kid's answer and stamping the day. Kept out
 * of components so render stays pure; call these from effects and handlers.
 *
 * Days are the family's local calendar days, never UTC: a 7:30 pm session in
 * Central time is still today, and tomorrow's theme pick is still tomorrow.
 */

export function nowMs() {
  return Date.now();
}

export function elapsedMs(since: number) {
  return Math.max(0, Date.now() - since);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` in local time. */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole local days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** `YYYY-MM-DD` that is `n` local days after `day`. */
export function addDays(day: string, n: number): string {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + n);
  return localDay(d);
}

export function todayStamp() {
  return localDay();
}
