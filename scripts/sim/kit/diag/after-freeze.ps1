# Run after a freeze and restart. Gathers what is known about the last one into
# .sim\diag\report-<time>\ and prints a short summary.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .sim\diag\after-freeze.ps1

$ErrorActionPreference = "SilentlyContinue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $dir ("report-" + (Get-Date -Format "yyyy-MM-dd_HHmm"))
New-Item -ItemType Directory -Force -Path $out | Out-Null
$since = (Get-Date).AddHours(-48)

# 1. Windows: unexpected restarts, hardware errors, GPU driver, disk
$events = Get-WinEvent -FilterHashtable @{ LogName = "System"; StartTime = $since } | Where-Object {
  ($_.ProviderName -eq "Microsoft-Windows-Kernel-Power" -and $_.Id -in 41, 137) -or
  ($_.Id -eq 6008) -or
  ($_.ProviderName -match "WHEA|nvlddmkm|Display|disk|Ntfs|volmgr|Resource-Exhaustion|Kernel-Processor-Power")
}
$events | Select-Object TimeCreated, ProviderName, Id, LevelDisplayName, Message |
  Format-List | Out-File (Join-Path $out "windows-events.txt") -Width 300
$crashes = Get-WinEvent -FilterHashtable @{ LogName = "System"; ProviderName = "Microsoft-Windows-Kernel-Power"; Id = 41; StartTime = $since } |
  ForEach-Object {
    $x = [xml]$_.ToXml(); $d = @{}
    $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_.'#text' }
    [pscustomobject]@{ Boot = $_.TimeCreated; Bugcheck = $d["BugcheckCode"]; PowerButton = $d["PowerButtonTimestamp"] }
  }
$crashes | Format-Table -AutoSize | Out-File (Join-Path $out "unexpected-restarts.txt")
Get-ChildItem C:\Windows\Minidump | Select-Object Name, LastWriteTime, Length |
  Out-File (Join-Path $out "minidumps.txt")

# 2. Telemetry: the file of the boot before this one, its last 10 minutes
$files = Get-ChildItem (Join-Path $dir "telemetry-*.csv") | Sort-Object LastWriteTime
$thisBoot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
$previous = $files | Where-Object { $_.LastWriteTime -lt $thisBoot } | Select-Object -Last 1
$last = $null
if ($previous) {
  Copy-Item $previous.FullName $out
  $rows = Import-Csv $previous.FullName
  $last = $rows | Select-Object -Last 1
  $end = [datetime]::ParseExact($last.time, "yyyy-MM-dd HH:mm:ss", $null)
  $tail = $rows | Where-Object { [datetime]::ParseExact($_.time, "yyyy-MM-dd HH:mm:ss", $null) -gt $end.AddMinutes(-10) }
  $tail | Export-Csv (Join-Path $out "telemetry-last-10-min.csv") -NoTypeInformation
}

# 3. LM Studio: the server log lines of the 15 minutes before the last telemetry line
$lmDir = Join-Path $env:USERPROFILE ".lmstudio\server-logs"
$lmLogs = Get-ChildItem $lmDir -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3
if ($last) {
  $from = $end.AddMinutes(-15).ToString("yyyy-MM-dd HH:mm")
  $to = $end.AddMinutes(1).ToString("yyyy-MM-dd HH:mm")
  foreach ($log in $lmLogs) {
    Get-Content $log.FullName | Where-Object {
      $_ -match "^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})" -and $Matches[1] -ge $from -and $Matches[1] -le $to
    } | Out-File (Join-Path $out ("lmstudio-" + $log.Name)) -Width 400
  }
}

# 4. Test markers
$markers = Join-Path $dir "markers.txt"
if (Test-Path $markers) { Get-Content $markers -Tail 40 | Out-File (Join-Path $out "markers-tail.txt") }

# 5. Summary
$summary = @()
$summary += "Report: $out"
$summary += "This boot: $thisBoot"
$summary += "Unexpected restarts (48 h):"
$summary += ($crashes | ForEach-Object { "  boot {0}  bugcheck {1}" -f $_.Boot, $_.Bugcheck })
if ($last) {
  $hot = ($tail | Measure-Object -Property gpu_temp_c -Maximum).Maximum
  $lowClock = ($tail | Where-Object { [int]$_.gpu_util -gt 50 } | Measure-Object -Property gpu_sm_mhz -Minimum).Minimum
  $maxShared = ($tail | Measure-Object -Property shared_mib -Maximum).Maximum
  $maxDedicated = ($tail | Measure-Object -Property dedicated_mib -Maximum).Maximum
  $summary += "Last telemetry line (the moment it stopped): $($last.time)"
  $summary += "  GPU $($last.gpu_temp_c) C, $($last.gpu_power_w) W, $($last.gpu_sm_mhz) MHz, use $($last.gpu_util)%, throttle $($last.throttle), $($last.pstate)"
  $summary += "  VRAM dedicated $($last.dedicated_mib) MiB, shared $($last.shared_mib) MiB; CPU $($last.cpu_load)% at $($last.cpu_mhz) MHz; free RAM $($last.ram_free_mib) MiB"
  $summary += "  marker: $($last.marker)"
  $summary += "Last 10 minutes: hottest GPU $hot C; lowest GPU clock under load $lowClock MHz; most dedicated VRAM $maxDedicated MiB; most shared $maxShared MiB"
} else {
  $summary += "No telemetry from the boot before this one: the logger was not running."
}
# Level 1-3 only: Ntfs writes an "is healthy" note after every forced restart
$summary += "Windows warnings or errors from GPU, hardware or disk (48 h): " + ($events | Where-Object { $_.ProviderName -match "WHEA|nvlddmkm|Display|disk|Ntfs" -and $_.Level -le 3 }).Count
$summary | Out-File (Join-Path $out "summary.txt")
$summary
