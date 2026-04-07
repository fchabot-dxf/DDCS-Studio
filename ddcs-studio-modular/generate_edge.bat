@echo off
cd /d "%~dp0"
echo Generating edge G-code configs...
.venv\Scripts\python.exe tools\generate_all_configs.py --html output\ddcs-studio-standalone.html --wizard edge --out "%~dp0generate_output"
pause
