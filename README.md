# LP Maker

いくつかの質問に答えるだけで、ヘッダー・フッターに挟まれたあなただけの LP（ランディングページ）を Codex が自動生成します。画像も AI で作って差し込みます。

成果物は `index.html` 1 ファイル＋ `images/` フォルダ。そのままサーバに置くだけで公開できます。

## 使い方（友達に渡すのはこれ 1 行だけ）

**ターミナル**を開いて、下の1行をコピペして Enter を押す:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Getabako/LPMaker/main/install.sh)"
```

初回は Homebrew / Node.js / Codex CLI を自動でインストール（数分）。ChatGPT のログイン画面が出るのでサインインしてください。終了は **Ctrl+C**。

2 回目以降も同じ 1 行 → 最新版にアップデートして起動。

## 動作要件

- macOS（Intel / Apple Silicon どちらも）
- ChatGPT Plus / Pro / Business / Enterprise
- 画像生成を使う場合のみ OpenAI API キー（platform.openai.com で発行、有料）
