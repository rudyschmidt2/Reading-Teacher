/**
 * Wall-clock helpers for timing a kid's answer and stamping the day. Kept out
 * of components so render stays pure; call these from effects and handlers.
 */

export function nowMs() {
  return Date.now();
}

export function elapsedMs(since: number) {
  return Math.max(0, Date.now() - since);
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
