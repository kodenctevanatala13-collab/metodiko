@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [1/3] Git add and commit...
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Release portal Metodiko"
echo [2/3] Setting branch main...
"C:\Program Files\Git\cmd\git.exe" branch -M main
echo [3/3] Ready to push!
pause
