#!/bin/bash
# .sim/run.sh <session> <conversation file> : plays a conversation against the
# local model, one message per run, into .sim/transcripts/<session>.txt
#
# Before each message: the GPU logger is running, and the GPU is below COOL_C.
# While a message runs, a watchdog stops it if the GPU reaches HOT_C.
# Every step is written to .sim/diag/markers.txt, which the logger copies into
# each line, so after a freeze the last line says what was running.
#
#   bash .sim/run.sh g50 .sim/conversations/gym3.txt
#   NORESET=1 bash .sim/run.sh g50 .sim/conversations/yes.txt   (continues a session)

COOL_C="${COOL_C:-72}"
HOT_C="${HOT_C:-87}"
ROOT="${LIFEUI_ROOT:-/c/Users/felix/dev/life-ui}"
SIM="$ROOT/.sim"
DIAG="$SIM/diag"
OUT="$SIM/transcripts"
mkdir -p "$OUT" "$DIAG"
S="$1"; F="$2"
[ -z "$S" ] || [ -z "$F" ] && { echo "usage: run.sh <session> <conversation file>"; exit 2; }
cd "$ROOT" || exit 1

mark() { echo "$(date '+%F %T') $*" >> "$DIAG/markers.txt"; }
gpu_temp() { nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 | cut -d. -f1; }

# The logger: started hidden if it is not running
pid=$(cat "$DIAG/telemetry.pid" 2>/dev/null)
if [ -z "$pid" ] || ! powershell -NoProfile -Command "if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >/dev/null 2>&1; then
  powershell -NoProfile -Command "Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','$(cygpath -w "$DIAG/telemetry.ps1")'" >/dev/null 2>&1
  mark "logger started"
fi

# The server and the model
if ! curl -s -m 5 -o /dev/null http://127.0.0.1:1234/v1/models; then mark "server start"; lms server start >/dev/null 2>&1; sleep 4; fi
if ! lms ps 2>/dev/null | grep -q "qwen/qwen3.5-9b"; then mark "model load"; lms load qwen/qwen3.5-9b --context-length 12288 --gpu max -y >/dev/null 2>&1; fi

cool_down() {
  local t
  t=$(gpu_temp)
  while [ -n "$t" ] && [ "$t" -ge "$COOL_C" ]; do
    mark "$S cooling at ${t}C"
    sleep 10
    t=$(gpu_temp)
  done
}

rm -f "$DIAG/too-hot"
watchdog() {
  while true; do
    local t
    t=$(gpu_temp)
    if [ -n "$t" ] && [ "$t" -ge "$HOT_C" ]; then
      mark "$S ABORT GPU at ${t}C"
      touch "$DIAG/too-hot"
      powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*lifeui-sim*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    fi
    sleep 3
  done
}
watchdog & WATCH=$!
trap 'kill $WATCH 2>/dev/null' EXIT

export SIM_CONTEXT="${SIM_CONTEXT:-12288}"
if [ -z "$NORESET" ]; then npm run -s sim -- "$S" reset > "$OUT/$S.txt"; else echo "=====CONTINUES" >> "$OUT/$S.txt"; fi

PARTS="$OUT/$S.parts"
python - "$F" "$PARTS" <<'PY'
import io, sys, os, shutil
text = io.open(sys.argv[1], encoding='utf-8').read()
shutil.rmtree(sys.argv[2], ignore_errors=True)
os.makedirs(sys.argv[2], exist_ok=True)
for i, part in enumerate(p.strip() for p in text.split('\n---\n') if p.strip()):
    io.open(os.path.join(sys.argv[2], f'{i:02d}.txt'), 'w', encoding='utf-8').write(part)
PY

n=0
for part in "$PARTS"/*.txt; do
  n=$((n + 1))
  cool_down
  mark "$S message $n start ($(gpu_temp)C)"
  npm run -s sim -- "$S" say < "$part" >> "$OUT/$S.txt" 2>&1
  mark "$S message $n end ($(gpu_temp)C)"
  if [ -f "$DIAG/too-hot" ]; then echo "=====STOPPED: GPU too hot" >> "$OUT/$S.txt"; break; fi
done
echo "=====STATE" >> "$OUT/$S.txt"
npm run -s sim -- "$S" state >> "$OUT/$S.txt" 2>&1
mark "$S done"
echo DONE
