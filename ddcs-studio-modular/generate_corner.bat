@echo off
cd /d "%~dp0"
echo Generating corner G-code configs...
.venv\Scripts\python.exe tools\generate_all_configs.py --html output\ddcs-studio-standalone.html --wizard corner --out "%~dp0generate_output"
pause
