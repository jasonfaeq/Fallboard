@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b)
if not exist node_modules (echo Installing dependencies, first run only... & call npm install)
call npm run dev -- --open
pause
