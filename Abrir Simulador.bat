@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

pushd "%SCRIPT_DIR%" >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Abrir Simulador.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

if not "%EXIT_CODE%"=="0" (
  echo.
  echo No se pudo abrir el Simulador de Cuadripolos. Codigo: %EXIT_CODE%
  echo Si existe, revisa artifacts\local_server\http-server.err.log para ver el detalle.
  echo.
  pause
)

exit /b %EXIT_CODE%
