@echo off
chcp 65001 >nul
title GitHub Pages デプロイ

set GH="C:\Program Files\GitHub CLI\gh.exe"

echo.
echo ==========================================
echo  GitHub Pages デプロイスクリプト
echo ==========================================
echo.

:: gh CLIの確認
%GH% --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] GitHub CLIが見つかりません
    echo  winget install --id GitHub.cli を実行してください
    pause
    exit /b 1
)

:: ログイン確認
%GH% auth status >nul 2>&1
if errorlevel 1 (
    echo [1/4] GitHubにログイン中...
    echo       ブラウザが開きます。GitHubアカウントで認証してください。
    echo.
    %GH% auth login --web --hostname github.com
    if errorlevel 1 (
        echo [ERROR] ログインに失敗しました
        pause
        exit /b 1
    )
)
echo [1/4] ログイン済み

:: GitHubユーザー名取得
for /f "delims=" %%i in ('%GH% api user --jq .login') do set GH_USER=%%i
echo       ユーザー: %GH_USER%

:: リモートが設定済みか確認
cd /d "%~dp0"
git remote get-url origin >nul 2>&1
if not errorlevel 1 (
    echo [2/4] リモートリポジトリ既存 スキップ
    goto :push
)

:: リポジトリ作成
echo.
echo [2/4] GitHubリポジトリを作成中...
%GH% repo create fanza-ranking --public --source=. --remote=origin --description "FANZA動画ランキングサイト"
if errorlevel 1 (
    echo [ERROR] リポジトリ作成に失敗しました
    echo  既存の場合: git remote add origin https://github.com/%GH_USER%/fanza-ranking.git
    pause
    exit /b 1
)
echo       作成完了: https://github.com/%GH_USER%/fanza-ranking

:push
:: プッシュ
echo.
echo [3/4] コードをプッシュ中...
git push -u origin master 2>&1 || git push -u origin main 2>&1
if errorlevel 1 (
    echo [ERROR] プッシュに失敗しました
    pause
    exit /b 1
)

:: GitHub Pages 有効化
echo.
echo [4/4] GitHub Pages を有効化中...
%GH% api repos/%GH_USER%/fanza-ranking/pages --method POST --field source[branch]=master --field source[path]=/ >nul 2>&1 || ^
%GH% api repos/%GH_USER%/fanza-ranking/pages --method POST --field source[branch]=main   --field source[path]=/ >nul 2>&1
echo.
echo ==========================================
echo  デプロイ完了！
echo.
echo  サイトURL (反映まで約1分):
echo  https://%GH_USER%.github.io/fanza-ranking/
echo.
echo  ※ アフィリエイトIDを設定する場合:
echo    __AFFILIATE_ID__ を実際のIDに置換してください
echo    対象ファイル: index.html / js/app.js / scripts/fetch_rankings.py
echo ==========================================
echo.
pause
