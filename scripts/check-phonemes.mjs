const SOUNDS = {
  s: "ssss",
  m: "mmm",
  n: "nnn",
  t: "tuh",
  ă: "aaa, apple",
};

function expandPhonemeToken(raw) {
  const inner = raw.trim().replace(/^\/+|\/+$/g, "");
  return SOUNDS[inner] ?? SOUNDS[inner.toLowerCase()] ?? inner;
}

function letterName(raw) {
  const ch = raw.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  return ch === "s" ? "ess" : ch;
}

function prepareSpokenText(text, kind = "prompt") {
  const raw = text.trim();
  if (!raw) return "";
  if (kind === "letter") return letterName(raw);
  if (kind === "phoneme") return expandPhonemeToken(raw);
  return raw.replace(/\/([^/]{1,4})\//g, (_, token) => expandPhonemeToken(token)).replace(/\s+/g, " ").trim();
}

const checks = [
  ["/s/ is ssss", expandPhonemeToken("/s/") === "ssss"],
  ["/m/ is mmm", expandPhonemeToken("/m/") === "mmm"],
  ["/t/ is tuh", expandPhonemeToken("/t/") === "tuh"],
  ["/ă/ is apple cue", expandPhonemeToken("/ă/") === "aaa, apple"],
  ["prompt keeps words and expands /s/", prepareSpokenText("Stamp the one that says /s/.") === "Stamp the one that says ssss."],
  ["letter s is ess", letterName("s") === "ess"],
  ["kind phoneme", prepareSpokenText("/n/", "phoneme") === "nnn"],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} phoneme checks failed`);
  process.exit(1);
}
console.log("\nAll phoneme checks passed.");
