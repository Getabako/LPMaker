@AGENTS.md

## ターミナルで直接指示されたときの動作（重要・追加運用）

このフォルダで Claude Code を開き、ユーザーが事業内容・指示文・素材などを貼った場合は、Web UI への入力を待たず、**このツール（ランディングページ生成）として成果物を一気に作り切る**。普段は UI を起動して使う（README 参照）が、ターミナルで直接渡されたときはこの手順で動く。

1. **仕様を把握する**: `lib/prompt.ts`（`buildCodexPrompt`）を読み、ヒーロー種別・画像生成ルール・外部埋め込み・出力形式（Tailwind CDN + インライン CSS/JS の単一 `index.html` + `images/`）の規約を踏襲する。
2. **案件フォルダを作る**: `generated/<案件名>/` を作る（案件名は内容から命名）。成果物はすべてこのフォルダ内に入れる。
3. **生成する**: 内容から brief を組み立て、`lib/prompt.ts` の規約に沿った PROMPT.txt を `generated/<案件名>/` に書き、そのフォルダを cwd にして Codex を起動。画像は必ず Codex 内蔵の image_gen を使う（**有料画像 API は絶対に使わない**。PreToolUse フックが自動ブロック）。
   ```
   cd generated/<案件名>
   codex exec --dangerously-bypass-approvals-and-sandbox -m gpt-5.5 < PROMPT.txt 2>&1 | tee codex.log
   ```
   `index.html` と `images/*.png` が揃うまで完了にしない。
4. **公開（GitHub Pages）**: 公開するか一度ユーザーに確認。OK なら `gh` で公開する（`app/api/publish/route.ts` と同じ流れ）: `gh repo create` → `git init/add/commit/push` → `gh api -X POST repos/<owner>/<repo>/pages` で Pages 有効化。公開 URL は `https://<owner>.github.io/<repo>/`。
5. **報告**: 生成物のパスと、公開した場合は Pages URL を数行で報告する。
