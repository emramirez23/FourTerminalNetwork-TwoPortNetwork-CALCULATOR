@echo off
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& '%SCRIPT_DIR%Abrir Simulador.ps1'"
