import type { LessonItem } from "./types";

export function nextSameSkill(
  moduleItems: LessonItem[],
  current: LessonItem,
  usedIds: Set<string>,
): LessonItem | undefined {
  const unused = moduleItems.filter((it) => it.id !== current.id && !usedIds.has(it.id));
  const sameKind = unused.find((it) => it.dimension === current.dimension && it.kind === current.kind);
  if (sameKind) return sameKind;
  return unused.find((it) => it.dimension === current.dimension);
}
