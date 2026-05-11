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
    ? `## 画像
- 各セクションに合った画像（ヒーローイメージ、特徴の図解、雰囲気写真など）を **あなた自身が生成して** ./images/ フォルダに保存してください。
- ファイル名は半角英数字とハイフンのみ（例: hero.png, feature-1.png, customer-voice-1.png）。
- index.html では <img src="images/hero.png" alt="..."> の形で参照する（同一フォルダにある画像を相対パスで）。
- 画像のスタイルは LP 全体のトーン（${brief.style}・主色 ${brief.primaryColor}）に合わせて統一。
- 1〜2 枚で済ませず、各セクションを引き立てる枚数を作る。最低 4 枚は欲しい。
- 画像生成ができない場合は images/ を作らず、CSS / SVG / 絵文字で代用する。HTML 生成は必ず完了させる。`
    : `## 画像
- 画像ファイルは作らない。images/ フォルダも作らない。
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
2. ${brief.generateImages ? "必要なら画像を生成して images/ に保存" : ""}
3. **ファイルとして** \`index.html\` を書く（apply_patch / シェル / 適切なツールで）
4. 完了報告は 1〜2 行だけ

# 🚨 もう一度

**HTML を会話の中に書き出さない。ファイルに書く。** これを守らないと作業失敗扱いです。
`;
}
