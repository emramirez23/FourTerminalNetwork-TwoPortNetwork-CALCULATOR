param(
    [switch] $Prod = $true
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Cli = Join-Path $Root ".netlify-cli-tmp\node_modules\.bin\netlify.cmd"

if (-not (Test-Path $Cli)) {
    npm install --prefix (Join-Path $Root ".netlify-cli-tmp") --no-audit --no-fund netlify-cli@26.0.2
}

Push-Location $Root
try {
    & $Cli status
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No hay sesion de Netlify. Ejecute: .\.netlify-cli-tmp\node_modules\.bin\netlify.cmd login"
        exit $LASTEXITCODE
    }

    if ($Prod) {
        & $Cli deploy --dir=web --prod
    } else {
        & $Cli deploy --dir=web
    }
} finally {
    Pop-Location
}
