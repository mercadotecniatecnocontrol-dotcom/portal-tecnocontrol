@echo off
title Instalar guardian de Aspel
cd /d "%~dp0"
echo.
echo Creando tarea programada "Guardian Aspel Tecnocontrol" (cada 5 minutos)...
schtasks /create /tn "Guardian Aspel Tecnocontrol" /tr "wscript.exe \"%~dp0guardian-aspel.vbs\"" /sc minute /mo 5 /f
if errorlevel 1 (
  echo.
  echo  NO se pudo crear la tarea programada. Avisale a Claude con una captura de esta ventana.
) else (
  echo.
  echo  Listo. Arrancando el guardian ahora...
  wscript.exe "%~dp0guardian-aspel.vbs"
)
echo.
pause
