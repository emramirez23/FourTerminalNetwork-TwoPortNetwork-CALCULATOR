$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$webRoot = Join-Path $projectRoot "web"
$artifactRoot = Join-Path $projectRoot "artifacts\local_server"
$preferredPort = 8888
$assetVersion = "20260518-builder-topologies"
$pythonCommand = $null

function Get-PythonCommand {
  $localPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
  if (Test-Path $localPython) {
    return $localPython
  }

  foreach ($candidate in @("py", "python")) {
    try {
      $command = Get-Command $candidate -ErrorAction Stop
      return $command.Source
    } catch {
      continue
    }
  }

  throw "No se encontro una instalacion de Python disponible en PATH."
}

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

    $hasCurrentUi = $response.Content -like "*exampleButtons*"
    $hasExpectedAssets = ($response.Content -like "*styles.css?v=$assetVersion*") -and ($response.Content -like "*app.js?v=$assetVersion*")
    return ($hasCurrentUi -and $hasExpectedAssets)
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
$pythonCommand = Get-PythonCommand

$port = $preferredPort
$serverReady = (Test-PortOpen -Port $port) -and (Test-SimulatorServer -Port $port)
if ((Test-PortOpen -Port $port) -and -not $serverReady) {
  $port = Get-AvailablePort -StartPort ($preferredPort + 1)
}

if (-not $serverReady) {
  $stdout = Join-Path $artifactRoot "http-server.out.log"
  $stderr = Join-Path $artifactRoot "http-server.err.log"
  $arguments = @("-m", "http.server", "$port", "--bind", "127.0.0.1", "-d", "`"$webRoot`"")

  Start-Process `
    -FilePath $pythonCommand `
    -ArgumentList $arguments `
    -WorkingDirectory $projectRoot `
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
  $details = ""
  $stderrLog = Join-Path $artifactRoot "http-server.err.log"
  if (Test-Path $stderrLog) {
    $details = (Get-Content $stderrLog -ErrorAction SilentlyContinue | Select-Object -Last 10) -join [Environment]::NewLine
  }
  [System.Windows.Forms.MessageBox]::Show(
    "No se pudo iniciar el servidor local en el puerto $port. Revise artifacts\local_server\http-server.err.log." + $(if ($details) { "`n`nUltimas lineas:`n$details" } else { "" }),
    "Simulador de Cuadripolos",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
Start-Process "http://127.0.0.1:$port/?open=$cacheBust"
