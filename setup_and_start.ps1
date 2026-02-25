# ============================================================
# FANZAランキング サイト セットアップ & 起動スクリプト
# PowerShellで実行: Right-click → PowerShellで実行
# または: powershell -ExecutionPolicy Bypass -File setup_and_start.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host " FANZAランキング セットアップ" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Python確認 ---
Write-Host "[1/4] Python を確認中..." -ForegroundColor Yellow
try {
    $pyVersion = python --version 2>&1
    Write-Host "  OK: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python が見つかりません" -ForegroundColor Red
    Write-Host "  https://www.python.org/downloads/ からインストールしてください"
    Read-Host "Enterキーで終了"
    exit 1
}

# --- Step 2: 依存パッケージインストール ---
Write-Host "[2/4] Pythonパッケージをインストール中..." -ForegroundColor Yellow
Set-Location "$ScriptDir\scripts"
try {
    pip install -r requirements.txt --quiet
    Write-Host "  OK: requests, beautifulsoup4, lxml インストール済み" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: パッケージインストール中にエラーが発生しました" -ForegroundColor Yellow
    Write-Host "  手動で実行: pip install -r scripts\requirements.txt"
}
Set-Location $ScriptDir

# --- Step 3: ランキングデータ取得 ---
Write-Host "[3/4] ランキングデータを取得中..." -ForegroundColor Yellow
Write-Host "  (APIキー未設定の場合はサンプルデータを使用します)" -ForegroundColor Gray
Set-Location "$ScriptDir\scripts"
try {
    python fetch_rankings.py
    Write-Host "  OK: data/ フォルダにJSONデータを保存しました" -ForegroundColor Green
} catch {
    Write-Host "  INFO: データ取得をスキップ (サンプルデータで起動します)" -ForegroundColor Yellow
}
Set-Location $ScriptDir

# --- Step 4: ローカルWebサーバー起動 ---
Write-Host "[4/4] ローカルWebサーバーを起動中..." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " サイトURL: http://localhost:8080" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "ブラウザが自動で開きます..." -ForegroundColor Gray
Write-Host "停止するには Ctrl+C を押してください" -ForegroundColor Gray
Write-Host ""

# ブラウザを少し遅れて開く
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8080"
} | Out-Null

# Python HTTPサーバー起動
python -m http.server 8080
