#!/bin/bash
# Continues .sim/ab.sh <tag>: plays only the scenarios whose transcript does not end in "done"
ROOT="${LIFEUI_ROOT:-/c/Users/felix/dev/life-ui}"
cd "$ROOT" || exit 1
for review in off on; do
  t="$1$([ $review = on ] && echo 1 || echo 0)"
  for f in gym3 english2 run-plan guitar-plan plain2 sleep elbow; do
    grep -q "$t-$f done" .sim/diag/markers.txt && continue
    SIM_REVIEW=$review bash .sim/run.sh "$t-$f" ".sim/conversations/$f.txt" > /dev/null 2>&1
    [ -f .sim/diag/too-hot ] && { echo "stopped: GPU too hot"; exit 1; }
  done
done
for t in "${1}0" "${1}1"; do
  echo "##### $t"
  node scripts/sim/score.mjs $(ls .sim/transcripts/"$t"-*.txt | grep -v -- "-score.txt") | grep -E "^\S.*: [0-9]+/[0-9]+|FAIL"
done
