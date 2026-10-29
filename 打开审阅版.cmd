@echo off
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Please run npm.cmd ci --ignore-scripts and npm.cmd run build first.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4318 in your browser.
echo If this preview is already running, use the existing browser tab.
node scripts\serve.mjs
pause
