param(
  [switch]$NoPause,
  [ValidateSet("menu", "setup", "build", "start", "site", "dashboard", "tiktok-runtime", "dev-stack")]
  [string]$Mode = "menu"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = $root

function Write-Section([string]$text) {
  Write-Host ""
  Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Test-PortBusy([int]$Port) {
  $rows = netstat -ano | Select-String -Pattern "LISTENING"
  foreach ($row in $rows) {
    $line = $row.ToString()
    if ($line -match "[:\.]$Port\s+.*LISTENING") {
      return $true
    }
  }
  return $false
}

function Get-FreePort([int]$StartPort = 3000, [int]$MaxAttempts = 10) {
  for ($i = 0; $i -lt $MaxAttempts; $i++) {
    $port = $StartPort + $i
    if (-not (Test-PortBusy -Port $port)) {
      return $port
    }
  }
  throw "No free port found in range $StartPort-$($StartPort + $MaxAttempts - 1)."
}

function Resolve-AppApiUrl {
  if ($env:DONATELKO_API_URL) {
    return $env:DONATELKO_API_URL
  }

  for ($port = 3000; $port -le 3010; $port++) {
    try {
      $res = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/setup" -Method GET -TimeoutSec 2 -UseBasicParsing
      if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500) {
        return "http://127.0.0.1:$port"
      }
    } catch {
      # try next port
    }
  }

  return "http://127.0.0.1:3000"
}

function Ensure-ProjectDirectory {
  if (-not (Test-Path -LiteralPath (Join-Path $projectDir "package.json"))) {
    throw "package.json not found. Expected project path: $projectDir"
  }
}

function Ensure-EnvFiles {
  Ensure-ProjectDirectory
  $dbUrl = "file:{0}/prisma/dev.db" -f (($projectDir -replace "\\", "/"))

  $envPath = Join-Path $projectDir ".env"
  if (-not (Test-Path -LiteralPath $envPath)) {
    @(
      "DATABASE_URL=`"$dbUrl`"",
      "DASHBOARD_PASSWORD=`"donatelko`""
    ) | Set-Content -LiteralPath $envPath -Encoding UTF8
    Write-Host "Created .env with SQLite database config." -ForegroundColor Yellow
  } else {
    $envRaw = Get-Content -LiteralPath $envPath -Raw
    if ($envRaw -notmatch "(?m)^\s*DATABASE_URL=") {
      Add-Content -LiteralPath $envPath -Value "`nDATABASE_URL=`"$dbUrl`""
      Write-Host "Added DATABASE_URL to .env." -ForegroundColor Yellow
    }
    if ($envRaw -notmatch "(?m)^\s*DASHBOARD_PASSWORD=") {
      Add-Content -LiteralPath $envPath -Value "`nDASHBOARD_PASSWORD=`"donatelko`""
      Write-Host "Added DASHBOARD_PASSWORD to .env." -ForegroundColor Yellow
    }
  }

  $envLocalPath = Join-Path $projectDir ".env.local"
  if (-not (Test-Path -LiteralPath $envLocalPath)) {
    @(
      "NEXT_PUBLIC_PROJECT_ID="
    ) | Set-Content -LiteralPath $envLocalPath -Encoding UTF8
    Write-Host "Created .env.local with starter values." -ForegroundColor Yellow
  } else {
    $envLocalRaw = Get-Content -LiteralPath $envLocalPath -Raw
    if ($envLocalRaw -notmatch "(?m)^\s*NEXT_PUBLIC_PROJECT_ID=") {
      Add-Content -LiteralPath $envLocalPath -Value "`nNEXT_PUBLIC_PROJECT_ID="
      Write-Host "Added NEXT_PUBLIC_PROJECT_ID to .env.local." -ForegroundColor Yellow
    }
  }
}

function Ensure-NodeModules {
  Ensure-ProjectDirectory
  Ensure-EnvFiles
  $nodeModules = Join-Path $projectDir "node_modules"
  if (-not (Test-Path -LiteralPath $nodeModules)) {
    Write-Section "Installing dependencies"
    Push-Location $projectDir
    try {
      npm install
    } finally {
      Pop-Location
    }
  }
}

function Ensure-Database {
  Ensure-ProjectDirectory
  Ensure-EnvFiles
  Push-Location $projectDir
  try {
    Write-Section "Preparing SQLite database"
    npm run db:push -- --skip-generate
    npm run db:seed
  } finally {
    Pop-Location
  }
}

function Ensure-Bootstrap {
  Ensure-NodeModules
  $dbFile = Join-Path $projectDir "prisma\dev.db"
  if (-not (Test-Path -LiteralPath $dbFile)) {
    Ensure-Database
  }
}

function Build-Project {
  Ensure-Bootstrap
  Write-Section "Building production bundle"
  Push-Location $projectDir
  try {
    npm run build
  } finally {
    Pop-Location
  }
}

function Start-Site {
  Ensure-Bootstrap
  $port = Get-FreePort -StartPort 3000
  Write-Section "Starting DEV public donation site"
  Write-Host "URL: http://localhost:$port" -ForegroundColor Green
  Push-Location $projectDir
  try {
    npx next dev --port $port
  } finally {
    Pop-Location
  }
}

function Start-Dashboard {
  Ensure-Bootstrap
  $port = Get-FreePort -StartPort 3000
  Write-Section "Starting DEV dashboard"
  Write-Host "URL: http://localhost:$port/dashboard" -ForegroundColor Green
  Push-Location $projectDir
  try {
    npx next dev --port $port
  } finally {
    Pop-Location
  }
}

function Start-Production {
  Ensure-Bootstrap
  $buildId = Join-Path $projectDir ".next\BUILD_ID"
  if (-not (Test-Path -LiteralPath $buildId)) {
    Build-Project
  }
  $port = Get-FreePort -StartPort 3000
  Write-Section "Starting PRODUCTION server"
  Write-Host "URL: http://localhost:$port" -ForegroundColor Green
  Push-Location $projectDir
  try {
    npx next start --port $port
  } finally {
    Pop-Location
  }
}

function Start-TikTokRuntime {
  Ensure-Bootstrap
  Write-Section "Starting internal TikTok runtime"
  $apiUrl = Resolve-AppApiUrl
  Write-Host "Runtime source: scripts/tiktok-runtime.cjs" -ForegroundColor Green
  Write-Host "API URL: $apiUrl" -ForegroundColor Green
  Write-Host "Username source: Dashboard -> Connections -> TikTok username" -ForegroundColor Green
  Push-Location $projectDir
  try {
    $env:DONATELKO_API_URL = $apiUrl
    node scripts/tiktok-runtime.cjs
  } finally {
    Remove-Item Env:DONATELKO_API_URL -ErrorAction SilentlyContinue
    Pop-Location
  }
}

function Start-DevStack {
  Ensure-Bootstrap
  $port = Get-FreePort -StartPort 3000

  Write-Section "Starting full DEV stack"
  Write-Host "1) App DEV: http://localhost:$port" -ForegroundColor Green
  Write-Host "2) TikTok runtime: internal" -ForegroundColor Green
  Write-Host "3) Runtime stays in this window" -ForegroundColor Green

  Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c","cd /d `"$projectDir`" && npx next dev --port $port"
  $env:DONATELKO_API_URL = "http://127.0.0.1:$port"
  Push-Location $projectDir
  try {
    node scripts/tiktok-runtime.cjs
  } finally {
    Pop-Location
    Remove-Item Env:DONATELKO_API_URL -ErrorAction SilentlyContinue
  }
}

if ($Mode -eq "setup") {
  Write-Section "Setup"
  Ensure-Bootstrap
  Write-Host "Dependencies and DB are ready." -ForegroundColor Green
  exit 0
}
if ($Mode -eq "build") { Build-Project; exit 0 }
if ($Mode -eq "start") { Start-Production; exit 0 }
if ($Mode -eq "site") { Start-Site; exit 0 }
if ($Mode -eq "dashboard") { Start-Dashboard; exit 0 }
if ($Mode -eq "tiktok-runtime") { Start-TikTokRuntime; exit 0 }
if ($Mode -eq "dev-stack") { Start-DevStack; exit 0 }

while ($true) {
  Clear-Host
  Write-Host "Stream Project Launcher" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "1. Setup (install deps + DB + env)"
  Write-Host "2. Dev: public donation page (hot reload)"
  Write-Host "3. Dev: dashboard page (hot reload)"
  Write-Host "4. Build: production bundle (next build)"
  Write-Host "5. Start: production server (next start)"
  Write-Host "6. TikTok runtime only (events + action triggers)"
  Write-Host "7. Full dev stack (site + TikTok runtime)"
  Write-Host "0. Exit"
  Write-Host ""
  Write-Host "Notes:" -ForegroundColor DarkGray
  Write-Host "- 2/3 are coding modes (dev)." -ForegroundColor DarkGray
  Write-Host "- 4/5 are stable production modes." -ForegroundColor DarkGray
  Write-Host "- 6 is 'only software runtime' for TikTok events." -ForegroundColor DarkGray
  Write-Host ""

  $choice = Read-Host "Choose option (0-7)"

  switch ($choice) {
    "1" {
      Write-Section "Setup"
      Ensure-Bootstrap
      Write-Host "Dependencies and DB are ready." -ForegroundColor Green
      if (-not $NoPause) { Read-Host "Press Enter to continue" | Out-Null }
    }
    "2" { Start-Site; break }
    "3" { Start-Dashboard; break }
    "4" {
      Build-Project
      if (-not $NoPause) { Read-Host "Press Enter to continue" | Out-Null }
    }
    "5" { Start-Production; break }
    "6" { Start-TikTokRuntime; break }
    "7" { Start-DevStack; break }
    "0" { break }
    default {
      Write-Host "Invalid option. Use 0..7." -ForegroundColor Red
      Start-Sleep -Seconds 1
    }
  }
}
