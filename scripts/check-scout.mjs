function todayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

function scoutDue(child, now = new Date()) {
  const today = todayStamp(now);
  const sessions = child.dailySessions ?? 0;
  if (child.lastDailyDate !== today) return false;
  if (child.lastScoutDate === today) return false;

  const neverScouted = !child.lastScoutDate;
  const everyFive = sessions > 0 && sessions % 5 === 0;
  const firstScout = neverScouted && sessions >= 5;
  const weekly = Boolean(child.lastScoutDate) && daysBetween(child.lastScoutDate, today) >= 7;
  return firstScout || everyFive || weekly;
}

const now = new Date("2026-09-13T12:00:00Z");
const today = "2026-09-13";

const checks = [
  ["not due with 0 dailies", scoutDue({ dailySessions: 0 }, now) === false],
  [
    "not due with 5 dailies but lastDailyDate not today (cold-open guard)",
    scoutDue({ dailySessions: 5, lastDailyDate: "2026-09-12" }, now) === false,
  ],
  [
    "due with 5 dailies and lastDailyDate today and no lastScoutDate",
    scoutDue({ dailySessions: 5, lastDailyDate: today }, now) === true,
  ],
  [
    "not due if lastScoutDate is today",
    scoutDue({ dailySessions: 5, lastDailyDate: today, lastScoutDate: today }, now) === false,
  ],
  [
    "due if lastScoutDate is 8 days ago, lastDailyDate today, dailySessions 1",
    scoutDue({ dailySessions: 1, lastDailyDate: today, lastScoutDate: "2026-09-05" }, now) === true,
  ],
  [
    "not due if lastScoutDate is 3 days ago and dailySessions 2",
    scoutDue({ dailySessions: 2, lastDailyDate: today, lastScoutDate: "2026-09-10" }, now) === false,
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} scout checks failed`);
  process.exit(1);
}
console.log("\nAll scout sitting checks passed.");
