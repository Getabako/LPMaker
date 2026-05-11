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
- **画像が自前で生成できない場合**: SVG / CSS グラデーション / 絵文字 / アイコンフォントだけで装飾して images/ は作らない。HTML 生成は必ず完了させる。`
    : `## 画像
- 画像ファイルは作らない。images/ フォルダも作らない。
- 代わりに CSS グラデーション・インライン SVG アイコン・絵文字・型抜き図形などで装飾する。`;

  return `あなたは熟練の Web デザイナー兼フロントエンドエンジニアです。
以下の要件で **1 枚のリッチな日本語ランディングページ** を作り、現在のディレクトリ（cwd）に書き出してください。

## 厳守ルール
- 出力は **index.html 1 ファイル** に CSS と JavaScript をすべてインライン化する（外部 .css / .js ファイルは作らない）。
- 外部 CDN は Tailwind CSS の CDN（https://cdn.tailwindcss.com）のみ使用可。
- セマンティック HTML（header / nav / main / section / footer）。
- レスポンシブ対応: 360px〜1440px で破綻しない。flex / grid を使う。
- ヘッダーは画面上部に固定。各メニュー項目はページ内アンカー（#hero, #features など）で、JS で **スムーススクロール**（CSS の scroll-behavior: smooth ＋ クリックハンドラ）。
- フッターはコピーライト + SNS リンク（プレースホルダ可）+ 利用規約 / プライバシーポリシーのダミーリンクを含む。
- アクセシビリティ: alt、aria-label、十分なコントラスト。
- 文言は日本語で書く。
- **作り込み**: パララックス・スクロールアニメ・ガラスモーフィズム・グラデーション・カードのホバーエフェクトなどを使って「リッチにデザインされた LP」に仕上げる。情報量より体験。

## ブランド情報
- ブランド名: ${brief.brand}
- ヘッドライン: ${brief.headline}
- 主色: ${brief.primaryColor}
- アクセント色: ${brief.accentColor}
- スタイル: ${brief.style}
- ターゲット: ${brief.audience}

## 説明
${brief.description}

## セクション構成（この順で）
${sectionsStr}

各セクションには id 属性を付与し、ヘッダーナビからスムーススクロールで飛べるようにすること。

## CTA
- ボタン文言: ${brief.ctaLabel}
- リンク先: ${brief.ctaHref}
ファーストビューとフッター直前の 2 箇所に同じ CTA を配置する。

${imageBlock}

## 作業の進め方
1. デザイン計画を頭の中で組み立てる
2. ${brief.generateImages ? "必要な画像を生成して images/ に保存（自前の画像生成機能を使う）" : "（画像なしモード）"}
3. index.html を一発で書き出す（部分編集ではなく完成形を 1 回の write で）
4. 終わったら 1〜2 行で完了報告して終了

絶対に index.html の生成は完了させること。画像生成だけ失敗してもいいので、HTML は必ず作る。
`;
}
