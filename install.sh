#!/usr/bin/env bash
# Codex Runner — one-line installer & launcher
#
# 友達向けの 1 行コマンド (このスクリプトを GitHub に置いた後):
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/<YOUR_GH>/<REPO>/main/install.sh)"
#
# 何度貼っても OK。初回は全部インストール、2 回目以降は既存のものを使って起動するだけ。

set -e

# --- 設定（公開時に書き換える） ----------------------------------------
GH_REPO="${LPMAKER_REPO:-Getabako/LPMaker}"
BRANCH="${LPMAKER_BRANCH:-main}"
INSTALL_DIR="${LPMAKER_HOME:-$HOME/.lpmaker}"
# -----------------------------------------------------------------------

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }

cyan "▶ Codex Runner セットアップを開始します"

# 1. OS チェック
if [[ "$(uname)" != "Darwin" ]]; then
  red "✗ いまは Mac (macOS) 専用です。"
  exit 1
fi

# 2. Homebrew
if ! command -v brew >/dev/null 2>&1; then
  cyan "▶ Homebrew をインストールします（初回のみ・数分かかります）"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # PATH を読み込み直し
  if [[ -d /opt/homebrew/bin ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi

# 3. Node.js
if ! command -v node >/dev/null 2>&1; then
  cyan "▶ Node.js をインストールします"
  brew install node
fi

# 4. Codex CLI
if ! command -v codex >/dev/null 2>&1; then
  cyan "▶ Codex CLI をインストールします"
  brew install codex
fi

# 5. git（普通入ってるが念のため）
command -v git >/dev/null 2>&1 || brew install git

# 6. リポジトリを取得 or 更新
if [[ -d "$INSTALL_DIR/.git" ]]; then
  cyan "▶ 既存のアプリを最新版に更新します"
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" reset --quiet --hard "origin/$BRANCH"
else
  cyan "▶ アプリをダウンロードします → $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"
  git clone --quiet --depth 1 --branch "$BRANCH" \
    "https://github.com/$GH_REPO.git" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# 7. 依存と本番ビルド（コミットが変わった or 成果物が無いなら再ビルド）
CUR_SHA="$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
MARK_FILE="$INSTALL_DIR/.next/.built-sha"
LAST_SHA=""
[[ -f "$MARK_FILE" ]] && LAST_SHA="$(cat "$MARK_FILE" 2>/dev/null || echo)"

NEED_BUILD=0
[[ ! -d node_modules ]] && NEED_BUILD=1
[[ ! -f .next/standalone/server.js ]] && NEED_BUILD=1
[[ "$CUR_SHA" != "$LAST_SHA" ]] && NEED_BUILD=1

if [[ "$NEED_BUILD" -eq 1 ]]; then
  cyan "▶ アプリを準備中（初回 or 更新があった時のみ・30 秒〜1 分）"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --silent
    pnpm build >/dev/null
  else
    npm install --silent
    npm run build >/dev/null
  fi
  mkdir -p "$INSTALL_DIR/.next"
  echo "$CUR_SHA" > "$MARK_FILE"
fi

# 8. ChatGPT へのログイン状態を確認（必要なら本人にやってもらう）
if ! codex login status >/dev/null 2>&1; then
  cyan ""
  cyan "▶ 初回ログイン: ChatGPT アカウントと接続します"
  cyan "  ブラウザが開きます。ChatGPT (Plus/Pro/Business) でサインインしてください。"
  cyan ""
  codex login || {
    red "ログインがキャンセルされました。次回もう一度この 1 行を実行してください。"
    exit 1
  }
fi

# 9. 起動
green ""
green "✓ 起動します。ブラウザが自動で開きます。終了は Ctrl+C。"
green ""
exec node bin/cli.js
