/**
 * Phone-width smoke run for the placement release. Not a check-*.mjs: it
 * needs a built app and a browser, so the merge queue does not run it.
 *
 *   npm run build && npm run smoke            # starts `next start` on :3123
 *   BASE_URL=https://reading-teacher.vercel.app npm run smoke
 *   SHOTS=/tmp/shots npm run smoke            # where the 390px screenshots go
 *
 * What it proves, in order: three-choice probes show all three cards above
 * the dock; a speak probe prints the word and offers "Parent will listen";
 * the desk Skills map shows shelf / frontier / speed and Start here rebuilds
 * the path — and that path is the same after a hard refresh (D1); Practice
 * these pre-fills a band module; the grades page shows shelf + frontier per
 * kid with a link into the map and a band result in the green sheet; Myles
 * shows the scout-says-ready badge instead of a checkbox.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { answerProbe, currentProbe, finishDiagnostic, startDiagnostic } from "../lib/diagnostic.ts";
import { emptyHouse, withPath } from "../lib/house.ts";

const KEY = "reading-teacher-v2";
const PORT = 3123;
const SHOTS = process.env.SHOTS ?? "/tmp/smoke-shots";
mkdirSync(SHOTS, { recursive: true });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push([name, ok]);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
};

// --- seed -----------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
const at = new Date();

function mapFor(track, knows, stopAtSpeak = false) {
  let p = startDiagnostic(track, at);
  let guard = 0;
  while (p.cursor && guard++ < 500) {
    const probe = currentProbe(p);
    if (stopAtSpeak && probe.kind === "speak") break;
    p = answerProbe(p, probe, knows(probe.band, probe.bit), 900, at);
  }
  return p;
}

function seedHouse() {
  const house = emptyHouse();
  // Riley: solid through CVC, shaky digraphs (th, ck), no blends.
  const rileyP = mapFor("words", (band, bit) => {
    if (["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(band)) return true;
    if (band === "digraphs") return bit === "sh" || bit === "ch";
    return false;
  });
  const { report, built } = finishDiagnostic("riley", rileyP, "smoke");
  house.modules.push(...built.modules);
  for (const id of built.passed) house.verdicts[`riley:${id}`] = "pass";
  // Myles: eight letter names tapped, the speak probe is next.
  const mylesP = mapFor("letters", () => true, true);
  house.kids = house.kids.map((k) => {
    if (k.id === "riley") {
      return withPath(
        { ...k, diagnostic: rileyP, diagnosticReport: report, placementGrade: report.shelf, placementNote: report.note, kidLine: report.kidLine, themeToday: "planets-space", themeDate: today },
        built.path,
      );
    }
    if (k.id === "hudson") return { ...k, themeToday: "race-cars", themeDate: today };
    if (k.id === "myles") return { ...k, diagnostic: mylesP, themeToday: "bugs", themeDate: today };
    return k;
  });
  return house;
}

// --- server ---------------------------------------------------------------

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not come up`);
}

let server;
let base = process.env.BASE_URL;
if (!base) {
  base = `http://localhost:${PORT}`;
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore" });
  await waitFor(`${base}/api/build`);
}
base = base.replace(/\/$/, "");

// --- browser --------------------------------------------------------------

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch();
}
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: [],
});
const seed = JSON.stringify(seedHouse());
await context.addInitScript(
  ({ key, value }) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
  },
  { key: KEY, value: seed },
);
const page = await context.newPage();
page.on("dialog", (d) => d.accept());
page.setDefaultTimeout(15000);

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const house = async () => JSON.parse(await page.evaluate((k) => window.localStorage.getItem(k), KEY));
const kid = async (id) => (await house()).kids.find((k) => k.id === id);
const box = async (sel) => page.locator(sel).first().boundingBox();

try {
  // 1. Front door.
  await page.goto(`${base}/`);
  await page.locator("main").waitFor();
  await shot("01-home");
  check("home renders", (await page.locator("main").count()) > 0);
  const stamp = await (await fetch(`${base}/api/build`)).json();
  console.log(`build stamp: ${stamp.stamp || "(none)"}`);

  // 2. Three-choice probe at 390px: every card above the dock.
  await page.goto(`${base}/kids/hudson/place`);
  await page.locator("[data-probe]").waitFor();
  await page.locator("[data-choices]").waitFor();
  await page.waitForTimeout(1200); // let the staggered deal-in finish
  const n = Number(await page.locator("[data-choices]").getAttribute("data-choices"));
  const cards = page.locator("[data-choices] .fat-card");
  const count = await cards.count();
  const dock = await box(".play-dock__bar");
  let allAbove = true;
  let allShown = true;
  for (let i = 0; i < count; i++) {
    const b = await cards.nth(i).boundingBox();
    if (!b || b.y + b.height > (dock?.y ?? 844) + 1) allAbove = false;
    const opacity = await cards.nth(i).evaluate((el) => Number(getComputedStyle(el).opacity));
    if (!(await cards.nth(i).isVisible()) || opacity < 0.95) allShown = false;
  }
  await shot("02-place-three-cards");
  check("first probe deals three cards", n === 3 && count === 3, `${n} / ${count}`);
  check("every card sits above the dock at 390px", allAbove);
  check("every card is fully shown", allShown);

  // 3. Speak probe: print card + Parent will listen; the answer lands as pending.
  await page.goto(`${base}/kids/myles/place`);
  await page.locator('[data-probe-kind="speak"]').waitFor();
  const print = page.locator("[data-print]");
  await shot("03-speak-probe");
  check("speak probe prints the letter", (await print.count()) === 1 && ((await print.getAttribute("data-print")) ?? "").length === 1);
  check("speak probe has no choice cards", (await page.locator("[data-choices]").count()) === 0);
  const listen = page.getByRole("button", { name: /parent will listen/i });
  check("Parent will listen is offered", (await listen.count()) === 1);
  await listen.click();
  await page.waitForTimeout(900);
  const myles = await kid("myles");
  const pendingRow = myles.diagnostic.rows.find((r) => r.pending);
  check("pending spoken answer is stored, not a miss", Boolean(pendingRow) && pendingRow.kind === "speak" && pendingRow.pending === true);

  // 4. Desk Skills map: shelf, frontier, speed, Start here.
  await page.goto(`${base}/parent?kid=riley#skills-map`);
  await page.locator("#skills-map").waitFor();
  const mapText = await page.locator("#skills-map").innerText();
  check("skills map shows the shelf", /shelf C\+/i.test(mapText), mapText.slice(0, 120));
  check("skills map names the frontier", /frontier: digraphs/i.test(mapText));
  check("skills map shows speed", (await page.locator("#skills-map [data-speed]").count()) === 1);
  check("digraphs is shaky on the map", (await page.locator('[data-band="digraphs"][data-status="shaky"]').count()) === 1);
  check("digraphs offers Practice these", (await page.locator('[data-practice="digraphs"]').count()) === 1);
  await page.locator("#skills-map").scrollIntoViewIfNeeded();
  await shot("04-skills-map");

  const before = (await kid("riley")).path;
  await page.locator('[data-start-here="blends"]').scrollIntoViewIfNeeded();
  await page.locator('[data-start-here="blends"]').click();
  await page.waitForTimeout(400);
  const started = await kid("riley");
  const afterStart = started.path;
  const verdicts = (await house()).verdicts;
  check("Start here rebuilds the path from blends", afterStart[0] === "rh-blends" && afterStart.join() !== before.join(), afterStart.join());
  check("Start here marks the digraph bank module passed", verdicts["riley:rh-digraphs"] === "pass");
  check("Start here holds the modules it took off", (started.held ?? []).includes("rh-digraphs") || !before.includes("rh-digraphs"));
  await page.locator('[data-start-here="blends"]').scrollIntoViewIfNeeded();
  await shot("05-start-here");

  // D1: hard refresh, then a cold navigation. The path must not grow back.
  await page.reload();
  await page.locator("#skills-map").waitFor();
  const afterReload = (await kid("riley")).path;
  check("Start here path survives a hard refresh", afterReload.join() === afterStart.join(), `${afterStart.length} → ${afterReload.length}`);
  await page.goto(`${base}/parent/grades`);
  await page.locator('[data-map-kid="riley"]').waitFor();
  await page.goto(`${base}/parent?kid=riley`);
  await page.locator("#skills-map").waitFor();
  const afterNav = (await kid("riley")).path;
  check("and a second load", afterNav.join() === afterStart.join(), `${afterStart.length} → ${afterNav.length}`);
  check("house record is on version 2", (await house()).version === 2);

  // 5. Practice these → pre-filled band module → on the path.
  await page.locator('[data-practice="digraphs"]').scrollIntoViewIfNeeded();
  await page.locator('[data-practice="digraphs"]').click();
  await page.locator('[data-prefill-band="digraphs"]').waitFor();
  const seeds = await page.locator("#create-module textarea").inputValue();
  check("Practice these pre-fills the missed bits", /th/.test(seeds) && /ck/.test(seeds), seeds);
  await shot("06-practice-these");
  await page.locator("#create-module button[type=submit]").click();
  await page.waitForTimeout(400);
  const practiced = await kid("riley");
  const prId = practiced.path.find((id) => id.startsWith("pr-riley-digraphs-"));
  const prMod = (await house()).modules.find((m) => m.id === prId);
  check("practice module is built from the band and on the path", Boolean(prId) && Boolean(prMod) && prMod.items.length >= 2, prId ?? "none");

  // 6. Grades: shelf + frontier per kid, link to the map, practice badge, band result in the sheet.
  await page.goto(`${base}/parent/grades`);
  await page.locator('[data-map-kid="riley"][data-map-state="done"]').waitFor();
  const gradesCard = await page.locator('[data-map-kid="riley"]').innerText();
  check("grades card shows Riley's shelf", /shelf C\+/i.test(gradesCard), gradesCard.slice(0, 120));
  check("grades card shows Riley's frontier", /Frontier:\s*Digraphs/i.test(gradesCard));
  check("grades card links into the skills map", ((await page.locator('[data-map-link="riley"]').getAttribute("href")) ?? "").includes("#skills-map"));
  check("Hudson is shown as not mapped", (await page.locator('[data-map-kid="hudson"][data-map-state="none"]').count()) === 1);
  check("Cassidy is shown as waiting", (await page.locator('[data-map-kid="cassidy"][data-map-state="waiting"]').count()) === 1);
  check("practice badge shows on the practice module", (await page.getByText("practice", { exact: true }).count()) >= 1);
  await shot("07-grades-map");
  await page.locator("#module-card-rh-digraphs").scrollIntoViewIfNeeded();
  await page.locator("#module-card-rh-digraphs").click();
  await page.locator('[data-map-result="rh-digraphs"]').waitFor();
  const sheet = await page.locator('[data-map-result="rh-digraphs"]').innerText();
  check("green sheet shows the band result", /shaky/i.test(sheet) && /missed th, ck/i.test(sheet), sheet.slice(0, 120));
  await shot("08-sheet-band-result");

  // 7. Myles: scout-says-ready badge, no checkbox, unlock gated.
  await page.goto(`${base}/parent?kid=myles`);
  await page.locator("[data-scout-ready]").waitFor();
  check("Myles shows the scout-says-ready badge", (await page.locator('[data-scout-ready="0"]').count()) === 1);
  const unlock = page.getByRole("button", { name: /confirm first word module/i });
  check("unlock stays disabled until the rule is met", (await unlock.count()) === 1 && (await unlock.isDisabled()));
  check("no readiness checkbox", (await page.locator('input[type="checkbox"]').filter({ hasNot: page.locator("xpath=ancestor::form") }).count()) === 0);
  await unlock.scrollIntoViewIfNeeded();
  await shot("09-myles-unlock");
} finally {
  await browser.close();
  server?.kill();
}

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`\n${failed.length} smoke checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} smoke checks passed. Screenshots in ${SHOTS}`);
