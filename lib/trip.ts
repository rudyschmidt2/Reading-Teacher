import type { Child } from "./types";

export function tripSessionLength(
  sessionLength: Child["sessionLength"],
  viewportWidth: number,
): "shorter" | "standard" | "longer" {
  if (viewportWidth < 700 && sessionLength === "standard") return "shorter";
  return sessionLength;
}
