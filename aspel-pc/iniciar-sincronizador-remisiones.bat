@echo off
title Remisiones Aspel -^> Supabase
cd /d "%~dp0"
if exist "%~dp0node\node.exe" (
  "%~dp0node\node.exe" sincronizar-remisiones-aspel.js %*
) else (
  node sincronizar-remisiones-aspel.js %*
)
pause
