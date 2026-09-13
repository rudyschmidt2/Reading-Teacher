#!/usr/bin/env bash
# Start a session in its own git worktree on a fresh branch cut from origin/main.
#
#   npm run worktree -- <short-name> [branch]
#
# The worktree lives outside the repo (so tsc/Turbopack never scan it):
#   $WORKTREE_ROOT/<short-name>            if WORKTREE_ROOT is set
#   ../<repo>.worktrees/<short-name>       if the parent directory is writable
#   ~/worktrees/<repo>/<short-name>        otherwise
#
# If the branch already exists (locally or on origin) the worktree checks it
# out instead of creating a new one, so a session can be resumed.
set -euo pipefail

name="${1:-}"
if [[ -z "$name" ]]; then
  echo "usage: npm run worktree -- <short-name> [branch]" >&2
  exit 1
fi
if [[ ! "$name" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "short-name must be lowercase letters, digits, '.', '_' or '-'" >&2
  exit 1
fi

branch="${2:-cursor/$name}"

common_dir="$(git rev-parse --git-common-dir)"
repo_root="$(cd "$(dirname "$common_dir")" && pwd)"
repo_name="$(basename "$repo_root")"

if [[ -n "${WORKTREE_ROOT:-}" ]]; then
  root="$WORKTREE_ROOT"
elif mkdir -p "$(dirname "$repo_root")/$repo_name.worktrees" 2>/dev/null; then
  root="$(dirname "$repo_root")/$repo_name.worktrees"
else
  root="$HOME/worktrees/$repo_name"
fi
mkdir -p "$root"
dir="$root/$name"

if [[ -e "$dir" ]]; then
  echo "worktree already exists: $dir" >&2
  echo "  cd \"$dir\"" >&2
  exit 1
fi

echo "Fetching origin/main…"
git -C "$repo_root" fetch -q origin main

if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
  echo "Reusing local branch $branch"
  git -C "$repo_root" worktree add "$dir" "$branch"
elif git -C "$repo_root" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  echo "Tracking existing origin/$branch"
  git -C "$repo_root" fetch -q origin "$branch"
  git -C "$repo_root" worktree add --track -b "$branch" "$dir" "origin/$branch"
else
  echo "Creating $branch from origin/main"
  git -C "$repo_root" worktree add --no-track -b "$branch" "$dir" origin/main
fi

# Hooks are shared by every worktree; this keeps commits off main.
git -C "$repo_root" config core.hooksPath .githooks

if [[ -f "$dir/package-lock.json" && -z "${SKIP_INSTALL:-}" ]]; then
  echo "Installing dependencies…"
  (cd "$dir" && npm ci --no-audit --no-fund)
fi

cat <<EOF

Worktree ready.

  cd "$dir"
  npm run dev                 # work here, never on the main checkout
  npm run sync                # merge origin/main in before every push
  git push -u origin $branch  # open a PR against main; the merge queue lands it

EOF
