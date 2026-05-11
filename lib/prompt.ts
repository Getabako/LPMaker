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
};

export function buildCodexPrompt(brief: LpBrief): string {
  const sectionsStr = brief.sections.map((s) => `- ${s}`).join("\n");

  const imageBlock = brief.generateImages
    ? `## 画像（重要）
- 画像は **あなたが直接生成しない**。**外部システムが gpt-image-2 で後から生成する**。
- あなたの仕事は **images.json** を書き出すこと。中身のスキーマ:
  \`\`\`json
  {
    "model": "gpt-image-2",
    "images": [
      {
        "filename": "hero.png",
        "prompt": "Photorealistic hero image for a Japanese specialty coffee brand. Soft morning light through a window, hand-pour coffee, wooden table, steam rising. Editorial photography style, warm tones, shallow depth of field.",
        "size": "1536x1024",
        "quality": "high"
      },
      {
        "filename": "feature-1.png",
        "prompt": "Close-up of fresh roasted coffee beans cascading. Natural light, brown tones, high detail.",
        "size": "1024x1024",
        "quality": "medium"
      }
    ]
  }
  \`\`\`
- 各 image エントリのルール:
  - filename: 半角英数とハイフンのみ + .png（例: hero.png, feature-1.png, voice-1.png, gallery-3.png）
  - prompt: **英語**で、被写体・構図・ライティング・スタイル・色味を具体的に指定する。写真品質を狙う（"photorealistic", "editorial photography style" など）。**LP 全体のトーン（${brief.style}・主色 ${brief.primaryColor}・ターゲット ${brief.audience}）に合わせて統一**。
  - size: "1024x1024" / "1536x1024"（横長：ヒーロー向け）/ "1024x1536"（縦長）のいずれか
  - quality: "high"（ヒーローや主要セクションのみ）/ "medium"（その他）
- 枚数の目安: ヒーロー 1 枚 + 各セクションに 1〜2 枚。**合計 4〜8 枚**。
- index.html では \`<img src="images/<filename>" alt="...">\` で参照する（実ファイルはまだ無いが、後から生成されて埋まる前提で OK）。
- ⚠️ images/ フォルダは作らなくて良い（外部システムが作る）。images.json だけ書き出す。`
    : `## 画像
- 画像ファイルは作らない。images.json も作らない。
- CSS グラデーション・インライン SVG アイコン・絵文字・型抜き図形で装飾する。`;

  return `# あなたへの作業指示

あなたは熟練の Web デザイナー兼フロントエンドエンジニアです。
**ファイルに書き込む形** で 1 枚のリッチな日本語ランディングページを作ってください。

# 🚨 出力ルール（最重要・絶対に守る）

- **HTML/CSS/JS を回答メッセージ本文に書かない**。会話には書かないで、必ずファイルに書く。
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
- 最終回答メッセージは **「index.html を作成しました（行数）」程度の 1〜2 行だけ**。HTML の中身は書かない。

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

# 作業手順

1. 簡単に構成を頭の中で組み立てる（軽く）
2. **ファイルとして** \`index.html\` を書く（apply_patch / シェル / 適切なツールで）
${brief.generateImages ? "3. **ファイルとして** `images.json` を書く（後段で画像が生成される）" : ""}
${brief.generateImages ? "4" : "3"}. 完了報告は 1〜2 行だけ

# 🚨 もう一度

**HTML を会話の中に書き出さない。ファイルに書く。** これを守らないと作業失敗扱いです。
`;
}
