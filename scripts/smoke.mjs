/**
 * Phone-width smoke run. Not a check-*.mjs: it needs a built app and a
 * browser, so the merge queue does not run it.
 *
 *   npm run build && npm run smoke            # starts `next start` on :3123
 *   BASE_URL=https://temporary-rushing-oxygen-gbzsbdg.vercel.app npm run smoke
 *   SHOTS=/tmp/shots npm run smoke            # where the 390px screenshots go
 *
 * What it proves, in order: three-choice probes show all three cards above
 * the dock; a speak probe prints the word and offers "Parent will listen";
 * the desk Skills map shows shelf / frontier / speed and Start here rebuilds
 * the path — and that path is the same after a hard refresh (D1); Practice
 * these pre-fills a band module; the grades page shows shelf + frontier per
 * kid with a link into the map and a band result in the green sheet; Myles
 * shows the map-says-ready badge instead of a checkbox; a kid whose path is
 * finished plays a real review session ("victory lap") and lands a
 * next-band proposal in the parent Inbox, which one tap accepts.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { SCOUT_MY1, SCOUT_RH1 } from "../lib/banks.ts";
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

// The browser runs in the family's zone; the seed's "today" must be that zone's day, not the server's.
const TZ = process.env.SMOKE_TZ ?? "America/Chicago";
const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const at = new Date();
const pass = (by = "parent") => ({ verdict: "pass", by, at: at.toISOString() });

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

const rileyKnows = (band, bit) => {
  if (["first-sounds", "letter-names", "letter-sounds", "short-vowels", "cvc"].includes(band)) return true;
  if (band === "digraphs") return bit === "sh" || bit === "ch";
  return false;
};

function seedHouse({ rileyDone = false } = {}) {
  const house = emptyHouse();
  // Riley: solid through CVC, shaky digraphs (th, ck), no blends.
  const rileyP = mapFor("words", rileyKnows);
  const { report, built } = finishDiagnostic("riley", rileyP, "smoke");
  house.modules.push(...built.modules);
  for (const id of built.passed) house.verdicts[`riley:${id}`] = pass("map");
  if (rileyDone) for (const id of built.path) house.verdicts[`riley:${id}`] = pass("parent");
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
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore" });
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

async function newPage(seedValue) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: [],
    timezoneId: TZ,
  });
  await context.addInitScript(
    ({ key, value }) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    },
    { key: KEY, value: seedValue },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => console.log(`PAGEERROR ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/503/.test(m.text())) console.log(`CONSOLE ${m.text().slice(0, 400)}`);
  });
  return { context, page };
}

const shotFor = (page) => (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const houseOf = async (page) => JSON.parse(await page.evaluate((k) => window.localStorage.getItem(k), KEY));
const kidOf = async (page, id) => (await houseOf(page)).kids.find((k) => k.id === id);
const box = (page) => async (sel) => page.locator(sel).first().boundingBox();

/** Answer the card on screen correctly (speak → Parent will listen). Returns what the kid saw. */
async function playCard(page, house) {
  const main = page.locator("main[data-item]");
  const itemId = await main.getAttribute("data-item");
  const kind = await main.getAttribute("data-item-kind");
  const bank = [...house.modules.flatMap((m) => m.items), ...SCOUT_RH1, ...SCOUT_MY1];
  const item = bank.find((it) => it.id === itemId);
  if (!item) throw new Error(`unknown item ${itemId}`);
  if (kind === "speak") {
    await page.getByRole("button", { name: /parent will listen/i }).click();
    return "pending";
  }
  if (kind === "drag") {
    for (const slot of item.slots) {
      const tile = item.tiles.find((t) => t.id === slot.correctTileId);
      await page.getByRole("button", { name: `tile ${tile.label}`, exact: true }).click();
      await page.waitForTimeout(120);
    }
    return "hit";
  }
  if (item.widget === "trace") {
    await page.getByRole("button", { name: `Trace ${item.letter ?? item.correctId}` }).click();
    await page.getByRole("button", { name: /I traced it/ }).click();
    return "hit";
  }
  const correct = item.choices.find((c) => c.id === item.correctId);
  await page.locator(`[data-choices] .fat-card[aria-label="${correct.label}"]`).click();
  return "hit";
}

try {
  const seedA = JSON.stringify(seedHouse());
  const { context, page } = await newPage(seedA);
  const shot = shotFor(page);
  const bbox = box(page);

  // 1. Front door.
  await page.goto(`${base}/`);
  await page.locator("main").waitFor();
  await shot("01-home");
  check("home renders", (await page.locator("main").count()) > 0);
  check("home has no grade language for kids", !/grade/i.test(await page.locator("main").innerText()));
  const stamp = await (await fetch(`${base}/api/build`)).json();
  console.log(`build stamp: ${stamp.stamp || "(none)"}`);

  // 2. Three-choice probe at 390px: every card above the dock.
  await page.goto(`${base}/kids/hudson/place`);
  try {
    await page.locator("[data-probe]").waitFor();
  } catch (e) {
    console.log("DBG url", page.url(), "text", (await page.locator("body").innerText()).slice(0, 300));
    throw e;
  }
  await page.locator("[data-choices]").waitFor();
  await page.waitForTimeout(900);
  const n = Number(await page.locator("[data-choices]").getAttribute("data-choices"));
  const cards = page.locator("[data-choices] .fat-card");
  const count = await cards.count();
  const dock = await bbox(".play-dock__bar");
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
  check("no build strip on a kid screen", (await page.locator(".refresh-bar").count()) === 0);

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
  const myles = await kidOf(page, "myles");
  const pendingRow = myles.diagnostic.rows.find((r) => r.pending);
  check("pending spoken answer is stored, not a miss", Boolean(pendingRow) && pendingRow.kind === "speak" && pendingRow.pending === true);

  // 4. Desk Skills map: shelf, frontier, speed, Start here.
  await page.goto(`${base}/parent?kid=riley&seg=map#skills-map`);
  await page.locator("#skills-map").waitFor();
  const mapText = await page.locator("#skills-map").innerText();
  check("skills map shows the shelf", /shelf C\+/i.test(mapText), mapText.slice(0, 120));
  check("skills map names the frontier", /frontier: digraphs/i.test(mapText));
  check("skills map shows speed", (await page.locator("#skills-map [data-speed]").count()) === 1);
  check("digraphs is shaky on the map", (await page.locator('[data-band="digraphs"][data-status="shaky"]').count()) === 1);
  await page.locator('[data-band="digraphs"] button').first().click();
  check("digraphs offers Practice these", (await page.locator('[data-practice="digraphs"]').count()) === 1);
  await shot("04-skills-map");

  const before = (await kidOf(page, "riley")).path;
  await page.locator('[data-band="blends"] button').first().click();
  await page.locator('[data-start-here="blends"]').scrollIntoViewIfNeeded();
  await page.locator('[data-start-here="blends"]').click();
  await page.getByRole("dialog").getByRole("button", { name: "Start here" }).click();
  await page.waitForTimeout(400);
  const started = await kidOf(page, "riley");
  const afterStart = started.path;
  const verdicts = (await houseOf(page)).verdicts;
  check("Start here rebuilds the path from blends", afterStart[0] === "rh-blends" && afterStart.join() !== before.join(), afterStart.join());
  check("Start here marks the digraph bank module passed, by Start here", verdicts["riley:rh-digraphs"]?.verdict === "pass" && verdicts["riley:rh-digraphs"]?.by === "start-here", JSON.stringify(verdicts["riley:rh-digraphs"]));
  check("Start here holds the modules it took off", (started.held ?? []).includes("rh-digraphs") || !before.includes("rh-digraphs"));
  await shot("05-start-here");

  // D1: hard refresh, then a cold navigation. The path must not grow back.
  await page.reload();
  await page.locator("#skills-map").waitFor();
  const afterReload = (await kidOf(page, "riley")).path;
  check("Start here path survives a hard refresh", afterReload.join() === afterStart.join(), `${afterStart.length} → ${afterReload.length}`);
  await page.goto(`${base}/parent/grades`);
  await page.locator('[data-map-kid="riley"]').waitFor();
  await page.goto(`${base}/parent?kid=riley&seg=map`);
  await page.locator("#skills-map").waitFor();
  const afterNav = (await kidOf(page, "riley")).path;
  check("and a second load", afterNav.join() === afterStart.join(), `${afterStart.length} → ${afterNav.length}`);
  check("house record is on version 3", (await houseOf(page)).version === 3);

  // 5. Practice these → pre-filled band module in a sheet → on the path.
  await page.locator('[data-band="digraphs"] button').first().click();
  await page.locator('[data-practice="digraphs"]').scrollIntoViewIfNeeded();
  await page.locator('[data-practice="digraphs"]').click();
  await page.locator('[data-prefill-band="digraphs"]').waitFor();
  const seeds = await page.locator("#create-module textarea").inputValue();
  check("Practice these pre-fills the missed bits", /th/.test(seeds) && /ck/.test(seeds), seeds);
  await shot("06-practice-these");
  await page.locator("#create-module button[type=submit]").click();
  await page.waitForTimeout(400);
  const practiced = await kidOf(page, "riley");
  const prId = practiced.path.find((id) => id.startsWith("pr-riley-digraphs-"));
  const prMod = (await houseOf(page)).modules.find((m) => m.id === prId);
  check("practice module is built from the band and on the path", Boolean(prId) && Boolean(prMod) && prMod.items.length >= 2, prId ?? "none");

  // 6. Grades: shelf + frontier per kid, link to the map, practice badge, band result and provenance in the sheet.
  await page.goto(`${base}/parent/grades`);
  await page.locator('[data-map-kid="riley"][data-map-state="done"]').waitFor();
  const gradesCard = await page.locator('[data-map-kid="riley"]').innerText();
  check("grades card shows Riley's shelf", /shelf C\+/i.test(gradesCard), gradesCard.slice(0, 120));
  check("grades card shows Riley's frontier", /Frontier:\s*Digraphs/i.test(gradesCard));
  check("grades card links into the skills map", ((await page.locator('[data-map-link="riley"]').getAttribute("href")) ?? "").includes("#skills-map"));
  check("Hudson is shown as not mapped", (await page.locator('[data-map-kid="hudson"][data-map-state="none"]').count()) === 1);
  check("Cassidy is shown as waiting", (await page.locator('[data-map-kid="cassidy"][data-map-state="waiting"]').count()) === 1);
  check("practice badge shows on the practice module", (await page.getByText("practice", { exact: true }).count()) >= 1);
  check("no fake 0% anywhere on the grades page", !/\b0%/.test(await page.locator("main").innerText()));
  await shot("07-grades-map");
  await page.locator("#module-card-rh-digraphs").scrollIntoViewIfNeeded();
  await page.locator("#module-card-rh-digraphs").click();
  await page.locator('[data-map-result="rh-digraphs"]').waitFor();
  const sheet = await page.locator('[data-map-result="rh-digraphs"]').innerText();
  check("green sheet shows the band result", /shaky/i.test(sheet) && /missed th, ck/i.test(sheet), sheet.slice(0, 120));
  const provenance = await page.locator('[data-verdict-by="start-here"]').first().innerText();
  check("green sheet says the pass came from Start here, not from you", /Start here/.test(provenance), provenance.slice(0, 120));
  await shot("08-sheet-band-result");

  // 7. Myles: map-says-ready badge, no checkbox, unlock gated (Set segment).
  await page.goto(`${base}/parent?kid=myles&seg=settings`);
  await page.locator("[data-scout-ready]").waitFor();
  check("Myles shows the map-says-ready badge", (await page.locator('[data-scout-ready="0"]').count()) === 1);
  const unlock = page.getByRole("button", { name: /confirm first word module/i });
  check("unlock stays disabled until the rule is met", (await unlock.count()) === 1 && (await unlock.isDisabled()));
  check("no readiness checkbox", (await page.locator('input[type="checkbox"]').filter({ hasNot: page.locator("xpath=ancestor::form") }).count()) === 0);
  await unlock.scrollIntoViewIfNeeded();
  await shot("09-myles-unlock");
  await context.close();

  // 8. Continue-learning loop: Riley's path is finished → victory lap → next-band proposal → Accept.
  const doneHouse = seedHouse({ rileyDone: true });
  const { context: ctx2, page: p2 } = await newPage(JSON.stringify(doneHouse));
  const shot2 = shotFor(p2);
  await p2.goto(`${base}/kids/riley/play`);
  await p2.locator("main[data-item]").waitFor();
  check("a finished path still plays: the session is a review", (await p2.locator('main[data-item-source="review"]').count()) === 1);
  check("the kid sees a victory lap, not a grade", /victory lap/i.test(await p2.locator("main").innerText()));
  await shot2("10-victory-lap");
  let guard = 0;
  let hits = 0;
  while (guard++ < 12 && !/\/done/.test(p2.url())) {
    const saw = await playCard(p2, doneHouse);
    if (saw === "hit") hits += 1;
    await p2.waitForTimeout(1500);
  }
  await p2.waitForURL(/\/done/);
  const doneText = await p2.locator("main").innerText();
  check("the done page counts real wins", /real win/i.test(doneText), doneText.slice(0, 140));
  check("the done page says more adventure is coming", /More adventure is coming/.test(doneText));
  await shot2("11-done-real-wins");
  const afterPlay = await houseOf(p2);
  const rileyPlayed = afterPlay.kids.find((k) => k.id === "riley");
  const session = afterPlay.sessions.find((s) => s.kidId === "riley");
  check("the sitting is logged as a review session", Boolean(session) && session.kind === "review" && session.wins === hits, JSON.stringify(session && { kind: session.kind, wins: session.wins, items: session.items }));
  check("review stars landed on real hits only", rileyPlayed.stars === hits, `${rileyPlayed.stars} vs ${hits}`);
  const proposal = (rileyPlayed.plan?.proposals ?? []).find((p) => p.kind === "next-band" && p.status === "pending");
  check("finishing the path wrote a next-band proposal, and the path did not change", Boolean(proposal) && rileyPlayed.path.join() === doneHouse.kids.find((k) => k.id === "riley").path.join());

  await p2.goto(`${base}/parent?kid=riley`);
  await p2.locator('[data-proposal="next-band"]').waitFor();
  const inbox = await p2.locator('[data-proposal="next-band"]').innerText();
  check("the Inbox shows the proposal with real numbers", /finished every module/i.test(inbox) && /passed/.test(inbox), inbox.slice(0, 160));
  await shot2("12-inbox-proposal");
  const pathBefore = rileyPlayed.path.length;
  await p2.locator('[data-proposal="next-band"] [data-option="add"]').click();
  await p2.waitForTimeout(500);
  const accepted = await kidOf(p2, "riley");
  check("one tap on Accept adds the next band to the path", accepted.path.length > pathBefore && accepted.path.some((id) => id === proposal.evidence.band || id.includes(proposal.evidence.band)), accepted.path.join());
  check("the proposal is marked accepted", (accepted.plan?.proposals ?? []).find((p) => p.id === proposal.id)?.status === "accepted");
  check("the Inbox is empty again", (await p2.locator('[data-inbox="empty"]').count()) === 1);
  await shot2("13-inbox-accepted");
  await ctx2.close();
} finally {
  await browser.close();
  if (server) {
    // `next start` re-parents its next-server worker, which would keep the port with a stale build for the next run.
    server.kill("SIGTERM");
    spawnSync("pkill", ["-f", "next-server \\(v"], { stdio: "ignore" });
  }
}

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`\n${failed.length} smoke checks failed`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} smoke checks passed. Screenshots in ${SHOTS}`);
