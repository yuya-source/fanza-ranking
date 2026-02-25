@echo off
:: ============================================================
:: Windowsタスクスケジューラ 登録スクリプト
:: 毎朝8時(JST)に自動でランキングを更新します
:: 管理者権限で実行してください
:: ============================================================

echo.
echo FANZAランキング 自動更新タスクを登録します...
echo 毎日 08:00 (日本時間) に fetch_rankings.py を実行します
echo.

:: バッチファイルの絶対パスを取得
set BATCH_FILE=%~dp0run_fetch.bat

:: タスク名
set TASK_NAME=FANZARankingUpdate

:: 既存タスクを削除（存在する場合）
schtasks /Delete /TN "%TASK_NAME%" /F 2>nul

:: タスクを登録
:: 毎日 08:00 JST に実行
schtasks /Create ^
  /TN "%TASK_NAME%" ^
  /TR "\"%BATCH_FILE%\"" ^
  /SC DAILY ^
  /ST 08:00 ^
  /RL HIGHEST ^
  /F

if %ERRORLEVEL% == 0 (
  echo.
  echo [成功] タスクを登録しました: %TASK_NAME%
  echo       毎日 08:00 に自動実行されます
  echo.
  echo 登録タスクの確認:
  schtasks /Query /TN "%TASK_NAME%" /FO LIST
) else (
  echo.
  echo [エラー] タスクの登録に失敗しました
  echo 管理者権限でこのバッチファイルを実行してください
  echo.
)

pause
