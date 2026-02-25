@echo off
chcp 65001 >nul
:: ============================================================
:: Windowsタスクスケジューラ 登録スクリプト
:: 毎朝8時(JST)に自動でランキングを取得 & GitHub に push します
:: ★ 右クリック →「管理者として実行」してください
:: ============================================================

echo.
echo ==========================================
echo  FANZAランキング 自動更新タスク登録
echo ==========================================
echo.

set BATCH_FILE=%~dp0run_fetch.bat
set TASK_NAME=FANZARankingUpdate

:: 既存タスクを削除
schtasks /Delete /TN "%TASK_NAME%" /F 2>nul

:: タスクを登録（毎日 08:00）
schtasks /Create ^
  /TN "%TASK_NAME%" ^
  /TR "\"%BATCH_FILE%\"" ^
  /SC DAILY ^
  /ST 08:00 ^
  /RL HIGHEST ^
  /F

if %ERRORLEVEL% == 0 (
    echo.
    echo [成功] タスク登録完了: %TASK_NAME%
    echo       毎日 08:00 に自動実行 → GitHub Pages に自動反映されます
    echo.
    schtasks /Query /TN "%TASK_NAME%" /FO LIST
) else (
    echo.
    echo [エラー] 管理者として実行してください
    echo  このファイルを右クリック →「管理者として実行」
)

echo.
pause
