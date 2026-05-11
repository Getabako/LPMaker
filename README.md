# LP Maker

質問に答えるだけで、Codex がリッチな LP（ランディングページ）を自動生成。画像も AI で作って差し込みます。GitHub Pages へのワンクリック公開つき。

成果物は `index.html` 1 ファイル＋ `images/` フォルダ。

## 使い方（友達に渡すのはこの 1 行）

### Mac

**ターミナル**を開いて、下を 1 行コピペして Enter:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Getabako/LPMaker/main/install.sh)"
```

### Windows

**PowerShell** を開いて、下を 1 行コピペして Enter:

```
iwr -useb https://raw.githubusercontent.com/Getabako/LPMaker/main/install.ps1 | iex
```

---

初回は Node / Codex CLI / git / gh（GitHub CLI）を自動で入れます（数分）。ChatGPT のログイン画面が出るのでサインインしてください。

URL がターミナルに表示されるので、ブラウザに貼って開いてください（自動オープンしません）。

終了は **Ctrl+C**。

2 回目以降も同じ 1 行で最新版に更新して起動します。

## 機能

- **3 ステップウィザード** — ブランド名・キャッチコピー・色・スタイル・セクション・CTA を選ぶだけ
- **Codex が HTML/CSS/JS を自動生成** — Tailwind CDN + インラインで 1 ファイル完結
- **画像も AI 生成** — Codex 組み込みの `image_gen` (gpt-image-2) で `./images/` に保存。ChatGPT サブスク内で動く（API キー不要）
- **ZIP ダウンロード** — そのままサーバに置くだけで公開可能
- **GitHub Pages にワンクリック公開** — `gh repo create` でリポジトリ作成 → push → Pages 有効化を自動

## 動作要件

- macOS（Intel / Apple Silicon）または Windows 10/11
- ChatGPT Plus / Pro / Business / Enterprise いずれか
- GitHub Pages 公開を使う場合: `gh auth login` を 1 回（インストーラの後、または手動で）

## 共有について

このツールは **各ユーザーが自分の Mac/Windows で動かす** 設計です。Codex の認証は各人の `~/.codex/auth.json` に縛られているため、サーバにデプロイして URL 配布で他人のサブスクで動かす、ということはできません（Codex 側の制約）。
