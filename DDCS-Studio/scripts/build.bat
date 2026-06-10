@echo off
cd /d "%~dp0.."
echo Building standalone...
call npm run build:standalone
pause
