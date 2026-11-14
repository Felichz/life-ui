#!/bin/bash
# .sim/ab-on.sh <tag> : the six scenarios and the elbow with the second reading on
cd "${LIFEUI_ROOT:-/c/Users/felix/dev/life-ui}" || exit 1
for f in gym3 english2 run-plan guitar-plan plain2 sleep elbow; do
  grep -q "$1-$f done" .sim/diag/markers.txt && continue
  SIM_REVIEW=on bash .sim/run.sh "$1-$f" ".sim/conversations/$f.txt" > /dev/null 2>&1
  [ -f .sim/diag/too-hot ] && { echo "stopped: GPU too hot"; exit 1; }
done
node scripts/sim/score.mjs $(ls .sim/transcripts/"$1"-*.txt | grep -v -- "-score.txt") | grep -E "^\S.*: [0-9]+/[0-9]+|FAIL"
