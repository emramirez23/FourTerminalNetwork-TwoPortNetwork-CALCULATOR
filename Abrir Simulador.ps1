$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webRoot = Join-Path $projectRoot "web"
$artifactRoot = Join-Path $projectRoot "artifacts\local_server"
$preferredPort = 8888
$assetVersion = "20260517-audit-fixes"

function Test-PortOpen {
  param([int] $Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connection = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne(300)) {
      return $false
    }
    $client.EndConnect($connection)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-SimulatorServer {
  param([int] $Port)

  try {
    $probe = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $response = Invoke-WebRequest `
      -Uri "http://127.0.0.1:$Port/index.html?probe=$probe" `
      -UseBasicParsing `
      -Headers @{ "Cache-Control" = "no-cache" } `
      -TimeoutSec 2

    return ($response.Content -like "*insertLowerBtn*" -and $response.Content -like "*app.js?v=$assetVersion*")
  } catch {
    return $false
  }
}

function Get-AvailablePort {
  param([int] $StartPort)

  for ($candidate = $StartPort; $candidate -lt ($StartPort + 20); $candidate++) {
    if (-not (Test-PortOpen -Port $candidate)) {
      return $candidate
    }
  }

  throw "No se encontro un puerto libre entre $StartPort y $($StartPort + 19)."
}

if (-not (Test-Path (Join-Path $webRoot "index.html"))) {
  [System.Windows.Forms.MessageBox]::Show(
    "No se encontro web\index.html. Ejecute este script desde la carpeta del proyecto.",
    "Simulador de Cuadripolos",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

$port = $preferredPort
$serverReady = (Test-PortOpen -Port $port) -and (Test-SimulatorServer -Port $port)
if ((Test-PortOpen -Port $port) -and -not $serverReady) {
  $port = Get-AvailablePort -StartPort ($preferredPort + 1)
}

if (-not $serverReady) {
  $stdout = Join-Path $artifactRoot "http-server.out.log"
  $stderr = Join-Path $artifactRoot "http-server.err.log"
  $arguments = "-m http.server $port --bind 127.0.0.1 -d `"$webRoot`""

  Start-Process `
    -FilePath "python" `
    -ArgumentList $arguments `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr | Out-Null

  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    if ((Test-PortOpen -Port $port) -and (Test-SimulatorServer -Port $port)) {
      break
    }
    Start-Sleep -Milliseconds 250
  }
}

if (-not ((Test-PortOpen -Port $port) -and (Test-SimulatorServer -Port $port))) {
  [System.Windows.Forms.MessageBox]::Show(
    "No se pudo iniciar el servidor local en el puerto $port. Revise artifacts\local_server\http-server.err.log.",
    "Simulador de Cuadripolos",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Start-Process "http://127.0.0.1:$port/?open=$cacheBust"
