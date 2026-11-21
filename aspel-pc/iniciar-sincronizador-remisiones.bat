@echo off
title Remisiones Aspel -^> Supabase
cd /d "%~dp0"
REM Mismo Node portatil que usa arrancar-vigilante.bat
set NODE_EXE=C:\Users\Glenp\Downloads\node-v24.20.0-win-x64\node-v24.20.0-win-x64\node.exe
if exist "%~dp0node\node.exe" set NODE_EXE=%~dp0node\node.exe
"%NODE_EXE%" sincronizar-remisiones-aspel.js %*
pause
