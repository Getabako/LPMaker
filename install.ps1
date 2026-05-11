# LP Maker — Windows one-line installer & launcher
#
# 友達向けの 1 行 (PowerShell):
#   iwr -useb https://raw.githubusercontent.com/Getabako/LPMaker/main/install.ps1 | iex
#
# 何度貼っても OK。初回は全部インストール、2 回目以降は最新版に更新して起動。

$ErrorActionPreference = "Stop"

# --- 設定 ---
$GH_REPO   = if ($env:LPMAKER_REPO)   { $env:LPMAKER_REPO }   else { "Getabako/LPMaker" }
$BRANCH    = if ($env:LPMAKER_BRANCH) { $env:LPMAKER_BRANCH } else { "main" }
$InstallDir = if ($env:LPMAKER_HOME)  { $env:LPMAKER_HOME }  else { "$HOME\.lpmaker" }

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function OK($msg)   { Write-Host $msg -ForegroundColor Green }
function Err($msg)  { Write-Host $msg -ForegroundColor Red }

Info "▶ LP Maker セットアップを開始します（Windows）"

# 1. winget 必須
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Err "✗ winget が見つかりません。Windows 10/11 (build 1809+) で Microsoft Store から 'App Installer' を入れてください。"
    exit 1
}

function Ensure-Pkg($cmd, $wingetId, $label) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Info "▶ $label をインストールします"
        winget install --id $wingetId -e --silent --accept-source-agreements --accept-package-agreements
        # PATH を再読み込み
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
}

# 2. Node.js
Ensure-Pkg "node"  "OpenJS.NodeJS.LTS"  "Node.js (LTS)"

# 3. git
Ensure-Pkg "git"   "Git.Git"            "Git"

# 4. gh (GitHub CLI)
Ensure-Pkg "gh"    "GitHub.cli"         "GitHub CLI"

# 5. Codex CLI
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Info "▶ Codex CLI をインストールします"
    # npm 経由が確実
    npm install -g @openai/codex
}

# 6. pnpm（任意。無くても npm で動く）
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Info "▶ pnpm を有効化します"
    corepack enable
}

# 7. リポジトリを取得 or 更新
if (Test-Path "$InstallDir\.git") {
    Info "▶ 既存のアプリを最新版に更新します"
    git -C $InstallDir fetch --quiet origin $BRANCH
    git -C $InstallDir reset --quiet --hard "origin/$BRANCH"
} else {
    Info "▶ アプリをダウンロードします → $InstallDir"
    if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
    git clone --quiet --depth 1 --branch $BRANCH "https://github.com/$GH_REPO.git" $InstallDir
}

Set-Location $InstallDir

# 8. コミットが変わった or 成果物が無いなら再ビルド
$CurSha = (git -C $InstallDir rev-parse HEAD).Trim()
$MarkFile = "$InstallDir\.next\.built-sha"
$LastSha = if (Test-Path $MarkFile) { (Get-Content $MarkFile -ErrorAction SilentlyContinue).Trim() } else { "" }

$NeedBuild = $false
if (-not (Test-Path "$InstallDir\node_modules")) { $NeedBuild = $true }
if (-not (Test-Path "$InstallDir\.next\standalone\server.js")) { $NeedBuild = $true }
if ($CurSha -ne $LastSha) { $NeedBuild = $true }

if ($NeedBuild) {
    Info "▶ アプリを準備中（初回 or 更新時のみ）"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install --silent
        pnpm build | Out-Null
    } else {
        npm install --silent
        npm run build | Out-Null
    }
    New-Item -ItemType Directory -Force -Path "$InstallDir\.next" | Out-Null
    Set-Content -Path $MarkFile -Value $CurSha
}

# 9. ChatGPT ログイン状態
try { codex login status *>$null } catch {
    Info ""
    Info "▶ 初回ログイン: ChatGPT アカウントと接続します"
    Info "  ブラウザが開きます。サインインしてください。"
    Info ""
    codex login
}

# 10. 起動
OK ""
OK "✓ 起動します。終了は Ctrl+C。"
OK ""
node "$InstallDir\bin\cli.js"
