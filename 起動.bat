@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo かんたん3D CAD を起動します...
echo.

rem はじめての起動なら、必要なものを入れる
if not exist "node_modules\" (
    echo 初回セットアップ中です。少し待ってください...
    call npm install
    echo.
)

rem ブラウザを開く（Viteの開発サーバーは 5173 番）
start "" http://localhost:5173/

rem 開発サーバーを起動
call npm run dev

pause
