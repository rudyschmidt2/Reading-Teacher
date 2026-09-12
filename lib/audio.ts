export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text.replace(/[\/ăĕĭŏŭ]/g, (ch) => {
    if (ch === "ă") return "a";
    if (ch === "ĕ") return "e";
    if (ch === "ĭ") return "i";
    if (ch === "ŏ") return "o";
    if (ch === "ŭ") return "u";
    return "";
  });
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 0.92;
  u.pitch = 1.08;
  window.speechSynthesis.speak(u);
}

export function phonemeHint(text: string) {
  return text
    .replace("/s/", "ssss")
    .replace("/m/", "mmm")
    .replace("/t/", "t")
    .replace("/ă/", "short a, apple")
    .replace("/ĭ/", "short i, igloo")
    .replace("/ĕ/", "short e, egg")
    .replace("/ŏ/", "short o, octopus")
    .replace("/ŭ/", "short u, umbrella");
}
