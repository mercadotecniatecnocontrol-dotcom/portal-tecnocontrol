@echo off
title Productos Aspel -^> Supabase
cd /d "%~dp0"
if exist "%~dp0node\node.exe" (
  "%~dp0node\node.exe" sincronizar-productos-aspel.js
) else (
  node sincronizar-productos-aspel.js
)
pause
