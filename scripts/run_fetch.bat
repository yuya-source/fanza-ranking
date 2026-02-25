@echo off
:: ============================================================
:: FANZA ランキング取得スクリプト起動バッチ
:: Windowsタスクスケジューラから呼び出されます
:: ============================================================

:: スクリプトのディレクトリに移動
cd /d "%~dp0"

:: Python のパスを設定 (インストール場所に合わせて変更してください)
:: set PYTHON="C:\Python312\python.exe"
set PYTHON=python

:: 実行ログ
echo [%date% %time%] ランキング取得開始 >> "%~dp0..\fetch.log"

:: スクリプト実行
%PYTHON% fetch_rankings.py

:: 終了
echo [%date% %time%] 取得完了 >> "%~dp0..\fetch.log"
