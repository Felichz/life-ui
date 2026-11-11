# Opens the compiled desktop app, building it first when it is missing or
# older than the code. The desktop shortcut "LifeUI" runs this.
#
#   powershell -ExecutionPolicy Bypass -File scripts\desktop.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\desktop.ps1 -Rebuild

param([switch]$Rebuild)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "src-tauri\target\release\lifeui.exe"
Set-Location $root

# Everything the compiled app is made from
$sources = @("src", "src-tauri\src", "src-tauri\capabilities", "public") |
  ForEach-Object { Join-Path $root $_ } |
  Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem $_ -Recurse -File }
$sources += @("AGENT.md", "index.html", "package.json", "tailwind.config.js", "vite.config.ts",
  "src-tauri\tauri.conf.json", "src-tauri\Cargo.toml") |
  ForEach-Object { Join-Path $root $_ } |
  Where-Object { Test-Path $_ } |
  ForEach-Object { Get-Item $_ }
$newest = ($sources | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

$stale = $Rebuild -or -not (Test-Path $exe) -or ((Get-Item $exe).LastWriteTime -lt $newest)

if ($stale) {
  if (Get-Process lifeui -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }) {
    Write-Host "LifeUI esta abierta: cierrala para poder compilar la version nueva." -ForegroundColor Yellow
    Read-Host "Pulsa Enter cuando la hayas cerrado"
  }
  Write-Host "Compilando LifeUI (la primera vez tarda varios minutos)..." -ForegroundColor Cyan
  if (-not (Test-Path (Join-Path $root "node_modules"))) { npm install }
  # --no-bundle: only the program, without building installers
  npx tauri build --no-bundle
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $exe)) {
    Write-Host "La compilacion fallo. Revisa los mensajes de arriba." -ForegroundColor Red
    Read-Host "Pulsa Enter para cerrar"
    exit 1
  }
}

Start-Process $exe
