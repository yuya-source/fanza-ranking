@echo off
:: ============================================================
:: FANZA ランキング取得 & GitHub Pages 自動更新バッチ
:: Windowsタスクスケジューラから呼び出されます
:: ============================================================

cd /d "%~dp0.."

set PYTHON=python
set GH_REMOTE=https://github.com/hitomi-la-sourse/fanza-ranking.git
set LOG=%~dp0..\fetch.log

echo [%date% %time%] ===== 自動更新開始 ===== >> "%LOG%"

:: ===== 1. ランキングデータ取得 =====
echo [%date% %time%] データ取得中... >> "%LOG%"
cd /d "%~dp0"
%PYTHON% fetch_rankings.py >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] [ERROR] データ取得失敗 >> "%LOG%"
    exit /b 1
)

:: ===== 2. GitHub に push =====
cd /d "%~dp0.."
echo [%date% %time%] GitHub へ push 中... >> "%LOG%"

git add data/daily.json data/monthly.json data/alltime.json
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "auto: ranking update %date%"
    git push origin master >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo [%date% %time%] [ERROR] push 失敗 >> "%LOG%"
    ) else (
        echo [%date% %time%] push 完了 >> "%LOG%"
    )
) else (
    echo [%date% %time%] データ変更なし push スキップ >> "%LOG%"
)

echo [%date% %time%] ===== 完了 ===== >> "%LOG%"
