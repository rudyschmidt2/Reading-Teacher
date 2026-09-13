#!/usr/bin/env bash
# Bring origin/main into the current session branch so the PR is never behind.
#
#   npm run sync            merge origin/main into this branch
#   npm run sync -- --check only report whether a merge would conflict
#
# Exits 1 with the list of conflicting files if the merge does not apply
# cleanly; resolve them, commit, then push.
set -euo pipefail

check_only=0
for arg in "$@"; do
  case "$arg" in
    --check) check_only=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "main" || "$branch" == "HEAD" ]]; then
  echo "You are on '$branch'. Sessions work on a branch in a worktree: npm run worktree -- <name>" >&2
  exit 1
fi

git fetch -q origin main

if git merge-base --is-ancestor origin/main HEAD; then
  echo "$branch already contains origin/main."
  exit 0
fi

if [[ "$check_only" == 1 ]]; then
  if out="$(git merge-tree --write-tree --name-only origin/main HEAD 2>/dev/null)"; then
    echo "$branch merges cleanly with origin/main (run 'npm run sync' to bring it in)."
    exit 0
  fi
  echo "$branch would conflict with origin/main in:" >&2
  echo "$out" | awk 'NR > 1 && NF == 0 { exit } NR > 1 { print "  " $0 }' >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes. Commit or stash them before syncing." >&2
  exit 1
fi

if git merge --no-edit origin/main -m "Merge origin/main into $branch"; then
  echo "Merged origin/main into $branch."
  exit 0
fi

echo >&2
echo "Merge conflicts with origin/main:" >&2
git diff --name-only --diff-filter=U | sed 's/^/  /' >&2
echo >&2
echo "Resolve them, then: git add -A && git commit" >&2
exit 1
