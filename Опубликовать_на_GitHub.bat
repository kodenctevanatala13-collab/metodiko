@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ========================================================
echo   ОТПРАВКА САЙТА «МЕТОДИКО» НА GITHUB
echo ========================================================
echo.
echo [1/3] Фиксация файлов...
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Обновление портала МЕТОДИКО" 2>nul
"C:\Program Files\Git\cmd\git.exe" branch -M main

echo.
echo [2/3] Отправка на GitHub...
echo (Если появится окно браузера - подтвердите вход в GitHub)
echo.
"C:\Program Files\Git\cmd\git.exe" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   УСПЕШНО! Все файлы сайта загружены на GitHub.
    echo   Теперь можно переходить в Vercel и нажимать Deploy!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo   ВНИМАНИЕ: Проверьте, создан ли репозиторий metodiko
    echo   на странице https://github.com/new
    echo ========================================================
)

echo.
pause