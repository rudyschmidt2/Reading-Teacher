/**
 * Deal answer cards and tiles so the right one is never in a predictable spot.
 * Authored items list the correct choice first; this re-deals them with a
 * seeded shuffle (stable across re-renders) and keeps the correct card out of
 * the slot it sat in on the previous question.
 */

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: T[], seed: string): T[] {
  const out = [...list];
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle choices; if the correct one lands in `avoidSlot`, swap it elsewhere.
 * Returns the dealt list and the slot the correct choice now occupies.
 */
export function dealChoices<T extends { id: string }>(
  choices: T[],
  correctId: string | undefined,
  seed: string,
  avoidSlot?: number,
): { dealt: T[]; correctSlot: number } {
  const dealt = seededShuffle(choices, seed);
  let correctSlot = dealt.findIndex((c) => c.id === correctId);
  if (correctSlot !== -1 && avoidSlot !== undefined && correctSlot === avoidSlot && dealt.length > 1) {
    const candidates = dealt.map((_, i) => i).filter((i) => i !== avoidSlot);
    const target = candidates[Math.floor(rng(`${seed}-swap`)() * candidates.length)];
    [dealt[correctSlot], dealt[target]] = [dealt[target], dealt[correctSlot]];
    correctSlot = target;
  }
  return { dealt, correctSlot };
}

/** Shuffle tiles so a word is never spelled by tapping left to right. */
export function dealTiles<T extends { id: string }>(tiles: T[], seed: string): T[] {
  if (tiles.length < 2) return tiles;
  let dealt = seededShuffle(tiles, seed);
  if (dealt.every((t, i) => t.id === tiles[i].id)) dealt = [...dealt.slice(1), dealt[0]];
  return dealt;
}
