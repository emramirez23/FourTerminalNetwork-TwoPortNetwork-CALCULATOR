$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot
try {
  Write-Host "==> Pruebas frontend"
  npm --prefix web test
  if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas del frontend." }

  Write-Host "==> Pruebas backend"
  .\.venv\Scripts\python.exe -m pytest -q
  if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas del backend." }

  Write-Host "==> Suite completa OK"
} finally {
  Pop-Location
}
