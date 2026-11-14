#!/bin/bash
# .sim/run-all.sh <tag> : plays every conversation in .sim/conversations that is
# a full scenario (not the short continuations) as <tag>-<name>, then scores them.
#
#   bash .sim/run-all.sh v1

TAG="${1:-run}"
ROOT="${LIFEUI_ROOT:-/c/Users/felix/dev/life-ui}"
cd "$ROOT" || exit 1
for f in gym3 english2 run-plan guitar-plan plain2 sleep; do
  bash .sim/run.sh "$TAG-$f" ".sim/conversations/$f.txt" > /dev/null 2>&1
  [ -f .sim/diag/too-hot ] && { echo "stopped: GPU too hot"; break; }
done
node scripts/sim/score.mjs $(ls .sim/transcripts/"$TAG"-*.txt | grep -v -- "-score.txt")
