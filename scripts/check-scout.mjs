import { scoutDue } from "../lib/scout.ts";

// The real clock, in the family's local day. Due after a daily finished
// today; first scout at five dailies; then five sessions since the last
// scout, or a week; never twice in one day; never on a day with no daily.
const now = new Date(2026, 8, 13, 19, 30); // 7:30 pm local, Sep 13
const today = "2026-09-13";

const checks = [
  ["not due with 0 dailies", scoutDue({ dailySessions: 0 }, now) === false],
  ["not due with 5 dailies but lastDailyDate not today (cold-open guard)", scoutDue({ dailySessions: 5, lastDailyDate: "2026-09-12" }, now) === false],
  ["due with 5 dailies and lastDailyDate today and no lastScoutDate", scoutDue({ dailySessions: 5, lastDailyDate: today }, now) === true],
  ["first scout is still offered at 6 and 9 dailies", scoutDue({ dailySessions: 6, lastDailyDate: today }, now) && scoutDue({ dailySessions: 9, lastDailyDate: today }, now)],
  ["not due if lastScoutDate is today", scoutDue({ dailySessions: 5, lastDailyDate: today, lastScoutDate: today }, now) === false],
  ["due if lastScoutDate is 8 days ago, lastDailyDate today, dailySessions 1", scoutDue({ dailySessions: 1, lastDailyDate: today, lastScoutDate: "2026-09-05" }, now) === true],
  ["not due if lastScoutDate is 3 days ago and dailySessions 2", scoutDue({ dailySessions: 2, lastDailyDate: today, lastScoutDate: "2026-09-10" }, now) === false],
  ["due five sessions after the last scout (11 → 16), not at a multiple of five", scoutDue({ dailySessions: 16, lastDailyDate: today, lastScoutDate: "2026-09-11", plan: { lastScoutSession: 11 } }, now) === true],
  ["not due at 15 dailies when the last scout was at 11 (R4)", scoutDue({ dailySessions: 15, lastDailyDate: today, lastScoutDate: "2026-09-11", plan: { lastScoutSession: 11 } }, now) === false],
  ["a 7:30 pm daily counts for today, not tomorrow (E1)", scoutDue({ dailySessions: 5, lastDailyDate: today }, now) === true],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} scout checks failed`);
  process.exit(1);
}
console.log("\nAll scout sitting checks passed.");
