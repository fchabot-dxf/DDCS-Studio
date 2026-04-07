@echo off
cd /d "%~dp0"
echo Generating middle G-code configs...
.venv\Scripts\python.exe tools\generate_all_configs.py --html output\ddcs-studio-standalone.html --wizard middle --out "%~dp0generate_output"
pause
