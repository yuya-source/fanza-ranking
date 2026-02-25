@echo off
chcp 65001 >nul
title FANZAランキング セットアップ & 起動

echo.
echo ==========================================
echo  FANZAランキング セットアップ & 起動
echo ==========================================
echo.

:: Pythonの確認
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Pythonが見つかりません
    echo.
    echo https://www.python.org/downloads/ からインストールしてください
    pause
    exit /b 1
)

echo [1/3] Pythonパッケージをインストール中...
pip install playwright --quiet
python -m playwright install chromium --quiet 2>nul
echo       完了

echo.
echo [2/3] ランキングデータを取得中...
echo       (APIキー未設定のためサンプルデータで起動します)
cd /d "%~dp0scripts"
python fetch_rankings.py 2>nul || echo       スキップ (サンプルデータを使用)
cd /d "%~dp0"

echo.
echo [3/3] ローカルWebサーバーを起動中...
echo.
echo ==========================================
echo  ブラウザで開く: http://localhost:8080
echo  停止するには このウィンドウを閉じる
echo ==========================================
echo.

:: ブラウザを2秒後に自動で開く
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"

:: Webサーバー起動
python -m http.server 8080
