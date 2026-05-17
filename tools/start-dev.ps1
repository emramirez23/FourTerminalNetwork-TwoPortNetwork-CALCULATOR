$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendLogDir = Join-Path $projectRoot "artifacts\dev"
$backendStdout = Join-Path $backendLogDir "backend.out.log"
$backendStderr = Join-Path $backendLogDir "backend.err.log"

New-Item -ItemType Directory -Force -Path $backendLogDir | Out-Null

$backendReady = $false
try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 1
  $backendReady = $health.Content -like "*ok*"
} catch {
  $backendReady = $false
}

if (-not $backendReady) {
  Start-Process `
    -FilePath ".\.venv\Scripts\python.exe" `
    -ArgumentList "-m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendStdout `
    -RedirectStandardError $backendStderr | Out-Null
}

& (Join-Path $projectRoot "Abrir Simulador.ps1")

Write-Host "Frontend: http://127.0.0.1:8888"
Write-Host "Backend:  http://127.0.0.1:8000/docs"
