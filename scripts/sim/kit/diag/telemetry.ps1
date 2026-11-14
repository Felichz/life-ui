# Writes one line every 2 seconds to .sim\diag\telemetry-<boot time>.csv:
# GPU temperature, power, clocks, use, VRAM (dedicated and shared), throttle
# reasons, CPU load and clock, free RAM, and the last test marker.
# Each line is appended and the file closed at once, so after a hard freeze
# the last seconds before it are on disk.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .sim\diag\telemetry.ps1
#
# Only one copy runs at a time (a second one exits).

$ErrorActionPreference = "SilentlyContinue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lock = Join-Path $dir "telemetry.pid"
if (Test-Path $lock) {
  $old = Get-Content $lock
  if ($old -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) { exit 0 }
}
Set-Content -Path $lock -Value $PID

$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString("yyyy-MM-dd_HHmm")
$file = Join-Path $dir "telemetry-$boot.csv"
$markers = Join-Path $dir "markers.txt"
if (-not (Test-Path $file)) {
  [IO.File]::AppendAllText($file, "time,gpu_temp_c,gpu_power_w,gpu_sm_mhz,gpu_mem_mhz,gpu_util,vram_used_mib,throttle,pstate,dedicated_mib,shared_mib,cpu_load,cpu_mhz,ram_free_mib,marker`r`n")
}

while ($true) {
  $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $gpu = (& nvidia-smi --query-gpu=temperature.gpu,power.draw,clocks.sm,clocks.mem,utilization.gpu,memory.used,clocks_throttle_reasons.active,pstate --format=csv,noheader,nounits 2>$null) -replace "\s", ""
  if (-not $gpu) { $gpu = ",,,,,,," }
  $mem = Get-Counter "\GPU Adapter Memory(*)\Dedicated Usage", "\GPU Adapter Memory(*)\Shared Usage" -ErrorAction SilentlyContinue
  $dedicated = 0; $shared = 0
  if ($mem) {
    foreach ($s in $mem.CounterSamples) {
      if ($s.Path -like "*dedicated usage") { $dedicated = [Math]::Max($dedicated, $s.CookedValue) }
      if ($s.Path -like "*shared usage") { $shared = [Math]::Max($shared, $s.CookedValue) }
    }
  }
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $os = Get-CimInstance Win32_OperatingSystem
  $marker = ""
  if (Test-Path $markers) { $marker = (Get-Content $markers -Tail 1) -replace ",", ";" }
  $fields = @(
    $now, $gpu,
    [int]($dedicated / 1MB), [int]($shared / 1MB),
    $cpu.LoadPercentage, $cpu.CurrentClockSpeed,
    [int]($os.FreePhysicalMemory / 1KB), $marker
  )
  [IO.File]::AppendAllText($file, ($fields -join ",") + "`r`n")
  Start-Sleep -Seconds 2
}
