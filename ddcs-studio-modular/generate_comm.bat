@echo off
cd /d "%~dp0"
echo Generating comm G-code configs...
.venv\Scripts\python.exe tools\generate_all_configs.py --html output\ddcs-studio-standalone.html --wizard comm --out "%~dp0generate_output"
pause
