export type LpBrief = {
  brand: string;
  headline: string;
  description: string;
  audience: string;
  primaryColor: string;
  accentColor: string;
  style: string;
  styleCustom?: string;
  sections: string[];
  sectionsCustom?: string;
  ctaLabel: string;
  ctaHref: string;
  generateImages: boolean;
  customInstructions?: string;
  characterRefPaths?: string[];
  heroMode?: "static" | "slider" | "video" | "gradient";
  heroVideoUrl?: string;
  heroSliderUrls?: string;
  embedMapUrl?: string;
  embedVideoUrls?: string;
  embedSocialUrls?: string;
  embedCustomHtml?: string;
};

export function buildCodexPrompt(brief: LpBrief): string {
  const extraSections = (brief.sectionsCustom || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const sectionsStr = [...brief.sections, ...extraSections].map((s) => `- ${s}`).join("\n");

  const styleStr = [brief.style, brief.styleCustom?.trim()].filter(Boolean).join(" / ");

  const heroLines: string[] = [];
  switch (brief.heroMode) {
    case "slider": {
      const urls = (brief.heroSliderUrls || "")
        .split("\n").map((s) => s.trim()).filter(Boolean);
      heroLines.push("- ヒーローは **画像スライダー** にする（自動切替 + ドットインジケータ、JS でフェード or スライド）。");
      if (urls.length) heroLines.push(`- スライド画像 URL:\n${urls.map((u) => `  - ${u}`).join("\n")}`);
      else heroLines.push("- スライド画像 URL は未指定のため、image_gen で複数枚生成して並べる。");
      break;
    }
    case "video":
      heroLines.push("- ヒーローは **動画背景**。fullscreen で autoplay / loop / muted / playsinline。");
      if (brief.heroVideoUrl?.trim()) {
        const u = brief.heroVideoUrl.trim();
        const isYouTube = /youtu\.?be/i.test(u);
        const isVimeo = /vimeo\.com/i.test(u);
        if (isYouTube || isVimeo) {
          heroLines.push(`- 動画 URL: ${u} （${isYouTube ? "YouTube" : "Vimeo"} の iframe を背景に敷き、controls=0 / autoplay / loop / mute で再生。pointer-events:none で操作を奪わない）`);
        } else {
          heroLines.push(`- 動画 URL（mp4 等）: ${u} → <video> タグの src に直接指定`);
        }
      } else {
        heroLines.push("- 動画 URL 未指定。プレースホルダ動画タグだけ用意し、暗いオーバーレイとキャッチコピーを重ねる");
      }
      break;
    case "gradient":
      heroLines.push("- ヒーローは **画像を使わず**、主色とアクセント色のグラデーションのみで構成（タイポグラフィで魅せる）。");
      break;
    default:
      heroLines.push("- ヒーローは静止画 1 枚 + 大きなキャッチコピー。");
  }
  const heroBlock = `# ヒーロー（ファーストビュー）の見せ方

${heroLines.join("\n")}`;

  const embedItems: string[] = [];
  if (brief.embedMapUrl?.trim()) {
    embedItems.push(`- **地図**: 「アクセス」セクション付近に Google マップを iframe で埋め込む。URL: ${brief.embedMapUrl.trim()}
  - 「https://www.google.com/maps/embed?...」形式ならそのまま iframe src に。
  - 共有 URL 形式（maps.app.goo.gl 等）なら、おおよその場所を表す \`maps.google.com/maps?q=...&output=embed\` の形に変換して src に入れる。`);
  }
  const videoUrls = (brief.embedVideoUrls || "")
    .split("\n").map((s) => s.trim()).filter(Boolean);
  if (videoUrls.length) {
    embedItems.push(`- **動画**: 以下を「動画」セクションに iframe 埋め込み（YouTube は \`https://www.youtube.com/embed/<ID>\`、Vimeo は \`https://player.vimeo.com/video/<ID>\` に変換）。
${videoUrls.map((u) => `  - ${u}`).join("\n")}`);
  }
  const socialUrls = (brief.embedSocialUrls || "")
    .split("\n").map((s) => s.trim()).filter(Boolean);
  if (socialUrls.length) {
    embedItems.push(`- **SNS / 外部リンク**: フッターまたはサイド固定ナビにアイコンリンクとして配置（適切なブランドカラー / インライン SVG アイコン）。
${socialUrls.map((u) => `  - ${u}`).join("\n")}`);
  }
  if (brief.embedCustomHtml?.trim()) {
    embedItems.push(`- **そのまま貼り付けたいコード**: 以下を最も自然なセクションに **そのまま挿入**（改変せず）。
\`\`\`
${brief.embedCustomHtml.trim()}
\`\`\``);
  }
  const embedBlock = embedItems.length
    ? `# 外部埋め込み（必ず反映）

${embedItems.join("\n\n")}

iframe には適切な width/height/frameborder=0/loading=lazy を付け、レスポンシブで崩れないよう aspect-ratio または padding-bottom トリックで wrap する。`
    : "";

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

各画像のプロンプトは **英語** で、被写体・構図・ライティング・スタイル・色味を具体的に指定。LP 全体のトーン（${styleStr} / 主色 ${brief.primaryColor} / ターゲット ${brief.audience}）に合わせて統一感を持たせる。"photorealistic" "editorial photography" など写真品質を狙う形容詞を入れる。

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
- スタイル: ${styleStr}
- ターゲット: ${brief.audience}

# 説明

${brief.description}

${heroBlock}

# セクション構成（この順で、各セクションには id 属性を付与してナビからスムーススクロールできるように）

${sectionsStr}

# CTA

- ボタン文言: ${brief.ctaLabel}
- リンク先: ${brief.ctaHref}

ファーストビューとフッター直前の 2 箇所に同じ CTA を配置。

${embedBlock}

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
