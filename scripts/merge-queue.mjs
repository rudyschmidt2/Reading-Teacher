#!/usr/bin/env node
// Merge queue for pull requests into main.
//
//   node scripts/merge-queue.mjs run [--dry-run]
//       Oldest PR first: bring it up to date with main, build it, merge it,
//       then start over so every remaining PR is re-based on the new main.
//       Conflicting PRs get the `needs-rebase` label and one comment; PRs whose
//       build fails get `build-failing`. Drafts and PRs labelled `hold` wait.
//
//   node scripts/merge-queue.mjs check
//       From a session branch: report whether it would conflict with
//       origin/main or with any other open PR.
//
// Needs an authenticated `gh` and `git` 2.38+. Runs in CI from
// .github/workflows/merge-queue.yml and locally from `npm run merge-queue`.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const LABEL_CONFLICT = "needs-rebase";
const LABEL_FAILING = "build-failing";
const LABEL_HOLD = "hold";
const MERGE_METHOD = process.env.MERGE_METHOD ?? "merge";
const DELETE_MERGED_BRANCHES = (process.env.DELETE_MERGED_BRANCHES ?? "1") !== "0";
const MAX_PASSES = Number(process.env.MERGE_QUEUE_PASSES ?? 8);

const [command = "run", ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");

const log = (...parts) => console.log("[merge-queue]", ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

function tryRun(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { status: res.status ?? 1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

const git = (...args) => sh("git", args);
const gh = (...args) => sh("gh", args);
const ghJson = (...args) => JSON.parse(gh(...args));

const repo = ghJson("repo", "view", "--json", "nameWithOwner").nameWithOwner;

function listOpenPrs() {
  const prs = ghJson(
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--base",
    "main",
    "--limit",
    "100",
    "--json",
    "number,title,headRefName,headRefOid,isDraft,mergeable,mergeStateStatus,labels",
  );
  return prs.sort((a, b) => a.number - b.number);
}

const hasLabel = (pr, name) => pr.labels.some((l) => l.name === name);

async function waitForMergeable(pr) {
  let current = pr;
  for (let attempt = 0; attempt < 8 && current.mergeable === "UNKNOWN"; attempt++) {
    await sleep(5000);
    const fresh = ghJson("pr", "view", String(pr.number), "--repo", repo, "--json", "mergeable,mergeStateStatus,headRefOid,labels");
    current = { ...current, ...fresh };
  }
  return current;
}

function fetchPrHead(pr) {
  git("fetch", "-q", "origin", `+refs/pull/${pr.number}/head:refs/remotes/pr/${pr.number}`);
  return `pr/${pr.number}`;
}

function isAncestor(a, b) {
  return tryRun("git", ["merge-base", "--is-ancestor", a, b]).status === 0;
}

// Files that would conflict merging `b` into `a`, or [] if the merge is clean.
function conflictsBetween(a, b) {
  const res = tryRun("git", ["merge-tree", "--write-tree", "--name-only", a, b]);
  if (res.status === 0) return [];
  const lines = res.out.split("\n").slice(1);
  const files = [];
  for (const line of lines) {
    if (line.trim() === "") break;
    files.push(line.trim());
  }
  return files.length ? files : ["(unknown files)"];
}

function ensureLabels() {
  const defs = [
    [LABEL_CONFLICT, "E4E669", "Conflicts with main. Run npm run sync in the session worktree and push."],
    [LABEL_FAILING, "D93F0B", "next build or a scripts/check-*.mjs failed on this branch."],
    [LABEL_HOLD, "C5DEF5", "Merge queue skips this PR until the label is removed."],
  ];
  for (const [name, color, description] of defs) {
    const res = tryRun("gh", ["label", "create", name, "--repo", repo, "--color", color, "--description", description, "--force"]);
    if (res.status !== 0) log(`could not ensure label ${name}: ${res.out.trim()}`);
  }
}

function addLabel(pr, name) {
  if (hasLabel(pr, name)) return;
  if (dryRun) return log(`would label #${pr.number} ${name}`);
  const res = tryRun("gh", ["pr", "edit", String(pr.number), "--repo", repo, "--add-label", name]);
  if (res.status !== 0) log(`could not add label ${name} to #${pr.number}: ${res.out.trim()}`);
}

function removeLabel(pr, name) {
  if (!hasLabel(pr, name)) return;
  if (dryRun) return log(`would unlabel #${pr.number} ${name}`);
  const res = tryRun("gh", ["pr", "edit", String(pr.number), "--repo", repo, "--remove-label", name]);
  if (res.status !== 0) log(`could not remove label ${name} from #${pr.number}: ${res.out.trim()}`);
}

function commentOnce(pr, kind, sha, body) {
  const marker = `<!-- merge-queue:${kind}:${sha} -->`;
  const existing = tryRun("gh", ["api", `repos/${repo}/issues/${pr.number}/comments`, "--paginate", "--jq", ".[].body"]);
  if (existing.out.includes(marker)) return;
  if (dryRun) return log(`would comment on #${pr.number} (${kind})`);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "merge-queue-comment-")), "body.md");
  writeFileSync(file, `${marker}\n${body}\n`);
  const res = tryRun("gh", ["pr", "comment", String(pr.number), "--repo", repo, "--body-file", file]);
  rmSync(path.dirname(file), { recursive: true, force: true });
  if (res.status !== 0) log(`could not comment on #${pr.number}: ${res.out.trim()}`);
}

function flagConflict(pr, sha) {
  const files = conflictsBetween("origin/main", sha);
  log(`#${pr.number} conflicts with main: ${files.join(", ")}`);
  addLabel(pr, LABEL_CONFLICT);
  commentOnce(
    pr,
    "conflict",
    sha,
    [
      "**Merge queue:** this branch conflicts with `main`, so it cannot be merged automatically.",
      "",
      "Conflicting files:",
      "",
      ...files.map((f) => `- \`${f}\``),
      "",
      "From the session worktree run `npm run sync`, resolve, commit, and push. The queue re-checks on every push and every 15 minutes.",
    ].join("\n"),
  );
}

function flagFailing(pr, sha, output) {
  log(`#${pr.number} failed verification`);
  addLabel(pr, LABEL_FAILING);
  const tail = output.trim().split("\n").slice(-60).join("\n");
  commentOnce(
    pr,
    "build",
    sha,
    [
      `**Merge queue:** \`next build\` or a \`scripts/check-*.mjs\` failed at ${sha.slice(0, 7)}, so this PR was not merged.`,
      "",
      "```",
      tail,
      "```",
      "",
      "Fix, push, and the queue will try again.",
    ].join("\n"),
  );
}

// Build the PR head in a throwaway worktree. The head already contains main,
// so this is exactly what main would be after the merge.
function verify(sha) {
  const dir = mkdtempSync(path.join(tmpdir(), "merge-queue-verify-"));
  const steps = [
    ["npm", ["ci", "--no-audit", "--no-fund"]],
    ["npm", ["run", "build"]],
  ];
  try {
    git("worktree", "add", "--detach", "-q", dir, sha);
    const checks = tryRun("sh", ["-c", "ls scripts/check-*.mjs 2>/dev/null"], { cwd: dir }).out.trim();
    for (const script of checks ? checks.split("\n") : []) {
      steps.push(["node", ["--experimental-strip-types", script]]);
    }
    let transcript = "";
    for (const [cmd, args] of steps) {
      log(`  $ ${cmd} ${args.join(" ")}`);
      const res = tryRun(cmd, args, { cwd: dir, env: { ...process.env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" } });
      transcript += `$ ${cmd} ${args.join(" ")}\n${res.out}\n`;
      if (res.status !== 0) return { ok: false, output: transcript };
    }
    return { ok: true, output: transcript };
  } finally {
    tryRun("git", ["worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

function updateBranch(pr, sha) {
  log(`#${pr.number} is behind main; updating branch`);
  if (dryRun) return;
  const res = tryRun("gh", ["api", "-X", "PUT", `repos/${repo}/pulls/${pr.number}/update-branch`, "-f", `expected_head_sha=${sha}`]);
  if (res.status !== 0) throw new Error(`update-branch failed for #${pr.number}: ${res.out.trim()}`);
}

function mergePr(pr, sha) {
  log(`merging #${pr.number} ${pr.title}`);
  if (dryRun) return;
  gh("pr", "merge", String(pr.number), "--repo", repo, `--${MERGE_METHOD}`, "--match-head-commit", sha);
  if (DELETE_MERGED_BRANCHES) {
    const res = tryRun("gh", ["api", "-X", "DELETE", `repos/${repo}/git/refs/heads/${pr.headRefName}`]);
    if (res.status !== 0) log(`could not delete ${pr.headRefName}: ${res.out.trim()}`);
  }
}

async function run() {
  if (dryRun) log("dry run: nothing will be labelled, commented, updated, or merged");
  ensureLabels();
  const merged = [];
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    git("fetch", "-q", "origin", "main");
    const prs = listOpenPrs();
    if (prs.length === 0) {
      log("no open pull requests against main");
      break;
    }
    log(`pass ${pass}: ${prs.map((p) => `#${p.number}`).join(" ")}`);
    let progressed = false;
    let updated = false;
    for (let pr of prs) {
      if (pr.isDraft) {
        log(`#${pr.number} is a draft; waiting`);
        continue;
      }
      if (hasLabel(pr, LABEL_HOLD)) {
        log(`#${pr.number} has ${LABEL_HOLD}; waiting`);
        continue;
      }
      pr = await waitForMergeable(pr);
      const sha = pr.headRefOid;
      fetchPrHead(pr);
      if (pr.mergeable === "CONFLICTING") {
        flagConflict(pr, sha);
        continue;
      }
      if (pr.mergeable !== "MERGEABLE") {
        log(`#${pr.number} mergeability still ${pr.mergeable}; will retry`);
        continue;
      }
      removeLabel(pr, LABEL_CONFLICT);
      if (!isAncestor("origin/main", sha)) {
        updateBranch(pr, sha);
        progressed = true;
        updated = true;
        continue;
      }
      const result = verify(sha);
      if (!result.ok) {
        flagFailing(pr, sha, result.output);
        continue;
      }
      removeLabel(pr, LABEL_FAILING);
      mergePr(pr, sha);
      merged.push(pr.number);
      progressed = true;
      if (!dryRun) break; // main moved; start over so the rest get updated against it
    }
    if (!progressed || dryRun) break;
    if (updated) await sleep(10000); // let GitHub recompute mergeability after update-branch
  }
  log(merged.length ? `merged ${merged.map((n) => `#${n}`).join(", ")}` : "nothing merged this run");
}

function check() {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch === "main" || branch === "HEAD") {
    console.error(`You are on '${branch}'. Sessions work on a branch in a worktree: npm run worktree -- <name>`);
    process.exit(1);
  }
  git("fetch", "-q", "origin", "main");
  const head = git("rev-parse", "HEAD");
  const mainConflicts = conflictsBetween("origin/main", head);
  if (mainConflicts.length) {
    console.log(`${branch} would conflict with origin/main in:\n  ${mainConflicts.join("\n  ")}`);
  } else if (isAncestor("origin/main", head)) {
    console.log(`${branch} is up to date with origin/main.`);
  } else {
    console.log(`${branch} merges cleanly with origin/main (run npm run sync to bring it in).`);
  }

  const others = listOpenPrs().filter((pr) => pr.headRefName !== branch);
  for (const pr of others) {
    const ref = fetchPrHead(pr);
    const files = conflictsBetween(head, ref);
    if (files.length) {
      console.log(`Heads up: would conflict with open PR #${pr.number} (${pr.headRefName}) in:\n  ${files.join("\n  ")}`);
    } else {
      console.log(`No conflict with open PR #${pr.number} (${pr.headRefName}).`);
    }
  }
  process.exit(mainConflicts.length ? 1 : 0);
}

if (command === "run") {
  await run();
} else if (command === "check") {
  check();
} else {
  console.error("usage: merge-queue.mjs run [--dry-run] | check");
  process.exit(2);
}
