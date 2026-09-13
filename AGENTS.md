<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repo

Every session works in its own git worktree on its own branch. `main` is only
ever changed by the merge queue. Git hooks refuse commits and pushes on `main`.

## Start of a session

```bash
npm run worktree -- <short-name>          # branch cursor/<short-name> off fresh origin/main
npm run worktree -- <short-name> <branch> # or an explicit branch name
cd <the printed directory>
```

The worktree is created outside the repo (`../<repo>.worktrees/<name>`, or
`~/worktrees/<repo>/<name>`), so `tsc` and Turbopack never scan it. Resuming a
branch that already exists locally or on origin is the same command.

Never edit files in the `main` checkout. If you find yourself there, run the
command above and move.

## Before every push

```bash
npm run sync            # merge origin/main into this branch
npm run sync -- --check # only report whether it would conflict
npm run merge-queue check   # also report overlap with every other open PR
```

If `sync` reports conflicts, resolve them in this worktree, commit, then push.
Keep changes inside the lane you own (see `docs/agent-lanes.md`); touching the
same lines as another open PR is what creates conflicts.

## Landing

Push the branch and open a PR against `main`. Do not merge it yourself. The
merge queue (`.github/workflows/merge-queue.yml`, `scripts/merge-queue.mjs`)
runs on every PR push, on every push to `main`, and every 15 minutes:

1. Oldest open PR first. Drafts and PRs labelled `hold` wait.
2. If the PR is behind `main`, the queue updates the branch with `main`.
3. If the PR conflicts with `main`, it gets `needs-rebase` plus one comment
   listing the files. Fix it with `npm run sync` and push.
4. Otherwise the queue runs `npm ci`, `next build`, and every
   `scripts/check-*.mjs` on the PR head. A failure gets `build-failing` plus a
   comment with the log.
5. A clean build is merged (merge commit) and the remote branch is deleted.
   Then the queue starts over so the remaining PRs are re-checked against the
   new `main`.

After your PR lands, remove the worktree: `git worktree remove <dir>`.

Run the queue by hand with `npm run merge-queue run --dry-run` to see what it
would do, or `npm run merge-queue run` to do it (needs an authenticated `gh`
with write access).
