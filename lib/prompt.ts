export type LpBrief = {
  brand: string;
  headline: string;
  description: string;
  audience: string;
  primaryColor: string;
  accentColor: string;
  style: string;
  sections: string[];
  ctaLabel: string;
  ctaHref: string;
  generateImages: boolean;
  customInstructions?: string;
  characterRefPaths?: string[];
};

export function buildCodexPrompt(brief: LpBrief): string {
  const sectionsStr = brief.sections.map((s) => `- ${s}`).join("\n");

  const customBlock = brief.customInstructions?.trim()
    ? `# 追加カスタム指示（ユーザー記述・最優先で反映）

以下はユーザーが自由記述で指定した、各パーツの見せ方・テイスト・実装したい機能などの追加要件です。**他のデフォルト仕様より優先**して反映してください。

${brief.customInstructions.trim()}
`
    : "";

  const refs = (brief.characterRefPaths || []).filter((p) => p && p.trim().length > 0);
  const characterBlock = refs.length
    ? `## キャラクター参照画像（LP に登場させる）

以下の画像をキャラクター参照として、LP のヒーローや各セクションに自然に登場させてください。**同一人物・同一画風・同一服装で再現**し、表情・ポーズ・構図はその場面に合わせて変える:

${refs.map((p, i) => `- ref${i + 1}: ${p}`).join("\n")}

image_gen ツールを呼び出すときに **これらの画像をリファレンスとして渡す**（gpt-image-2 の image-to-image 機能）。生成した PNG は \`./images/\` 配下に保存し、index.html から相対パスで参照する。`
    : "";

  const imageBlock = brief.generateImages
    ? `## 画像（重要）

あなた（Codex）に内蔵されている **\`image_gen\` ツール（gpt-image-2 / ChatGPT サブスク内蔵）** を直接呼んで画像を生成し、\`./images/\` 配下に PNG として保存してください。

### 🚨 絶対ルール

- **API キーは使わない**。 \`OPENAI_API_KEY\` を読まない、\`openai\` Python/Node SDK を使わない、\`curl https://api.openai.com\` も叩かない。
- **スクリプトを書かない**。 image_gen ツールを **直接呼び出して** PNG を吐き出す。
- 透過背景は使えない（不透明 PNG のみ）。
- 解像度は 16 の倍数、最大 3840px。

### 生成する枚数の目安

- ヒーロー 1 枚（横長 1536x1024 推奨）
- 各セクションに 1〜2 枚（1024x1024 や 1024x1536）
- 合計 **4〜8 枚**

### ファイル名規則

- 半角英数 + ハイフン + \`.png\`（例: \`hero.png\`, \`feature-1.png\`, \`voice-1.png\`, \`gallery-3.png\`）
- 保存先は **\`./images/\`** 配下（\`mkdir -p images\` してから）

### プロンプトの書き方

各画像のプロンプトは **英語** で、被写体・構図・ライティング・スタイル・色味を具体的に指定。LP 全体のトーン（${brief.style} / 主色 ${brief.primaryColor} / ターゲット ${brief.audience}）に合わせて統一感を持たせる。"photorealistic" "editorial photography" など写真品質を狙う形容詞を入れる。

### index.html での参照

\`<img src="images/<filename>" alt="...">\` の相対パスで参照する。

### 失敗したら

画像生成中にエラー（サブスクのレート制限など）が出たら、**そのまま処理を続けて** index.html だけは必ず完成させる。API キー利用などの代替手段に逃げない。`
    : `## 画像

画像ファイルは作らない。\`images/\` フォルダも作らない。CSS グラデーション・インライン SVG アイコン・絵文字で装飾する。`;

  return `# あなたへの作業指示

あなたは熟練の Web デザイナー兼フロントエンドエンジニアです。
**ファイルに書き込む形** で 1 枚のリッチな日本語ランディングページを作ってください。

# 🚨 出力ルール（最重要・絶対に守る）

- **HTML/CSS/JS を回答メッセージ本文に書かない**。会話に書かない、必ずファイルに書く。
- 現在のディレクトリ（cwd）に **\`index.html\` というファイルを作成**する。
- ファイル作成は **\`apply_patch\` ツール** または **シェルコマンド** で行う。例:
  \`\`\`
  apply_patch <<'PATCH'
  *** Begin Patch
  *** Add File: index.html
  +<!doctype html>
  +<html>...
  *** End Patch
  PATCH
  \`\`\`
  もしくは:
  \`\`\`
  cat > index.html <<'HTML'
  <!doctype html>
  ...
  HTML
  \`\`\`
- 最終回答メッセージは **「index.html を作成しました」程度の 1〜2 行**。HTML の中身は書かない。

# 中身の仕様

- index.html 1 ファイルに **CSS と JavaScript をインライン化**（外部 .css / .js は作らない）。
- 外部 CDN は Tailwind CSS の CDN（\`https://cdn.tailwindcss.com\`）のみ使用可。
- セマンティック HTML（header / nav / main / section / footer）。
- レスポンシブ対応: 360px〜1440px で破綻しない（flex / grid）。
- ヘッダーはページ上部に固定。各メニュー項目はページ内アンカー（\`#hero\` 等）で、JS で **スムーススクロール**。
- フッターはコピーライト + SNS リンク（プレースホルダ可）+ 利用規約 / プライバシーポリシーのダミーリンク。
- アクセシビリティ: alt、aria-label、十分なコントラスト。
- 文言は **日本語**。
- グラデーション、ガラスモーフィズム、スクロールアニメ、ホバーエフェクト等で **「リッチにデザインされた LP」** に仕上げる。

# ブランド情報

- ブランド名: ${brief.brand}
- ヘッドライン: ${brief.headline}
- 主色: ${brief.primaryColor}
- アクセント色: ${brief.accentColor}
- スタイル: ${brief.style}
- ターゲット: ${brief.audience}

# 説明

${brief.description}

# セクション構成（この順で、各セクションには id 属性を付与してナビからスムーススクロールできるように）

${sectionsStr}

# CTA

- ボタン文言: ${brief.ctaLabel}
- リンク先: ${brief.ctaHref}

ファーストビューとフッター直前の 2 箇所に同じ CTA を配置。

${imageBlock}

${characterBlock}

${customBlock}

# 作業手順

1. 簡単に構成を頭の中で組み立てる（軽く）
${brief.generateImages ? "2. **image_gen ツール（gpt-image-2）** で画像を生成して `./images/` に保存（API キーやスクリプトは使わない、組み込みツールを直接呼ぶ）" : ""}
${brief.generateImages ? "3" : "2"}. **ファイルとして** \`index.html\` を書く（apply_patch / シェル / 適切なツールで）
${brief.generateImages ? "4" : "3"}. 完了報告は 1〜2 行だけ

# 🚨 再強調

- HTML を会話に書き出さない。**ファイルに書く**。
${brief.generateImages ? "- 画像は **image_gen 内蔵ツールで直接生成**。API キー絶対禁止。" : ""}
`;
}
