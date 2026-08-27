@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo かんたん3D CAD を起動します...
echo.

rem ブラウザを開く（サーバー起動を少し待ってから）
start "" http://localhost:8080/index.html

rem Python サーバーを起動（python / py どちらでも動くように）
where python >nul 2>nul
if %errorlevel%==0 (
    python server.py 8080
) else (
    py server.py 8080
)

pause
