@echo off
cd /d "%~dp0"
echo Building and deploying output/ to Cloudflare Pages...
call npm run deploy:pages
pause
