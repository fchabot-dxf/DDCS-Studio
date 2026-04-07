@echo off
cd /d "%~dp0"
echo Generating all G-code configs (including alignment)...
.venv\Scripts\python.exe tools\generate_all_configs.py --html output\ddcs-studio-standalone.html --out "%~dp0generate_output"
pause
