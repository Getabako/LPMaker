"use client";

import { useEffect, useRef, useState } from "react";

type Brief = {
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
  customInstructions: string;
  characterRefPaths: string[];
};

const STYLES = ["モダン", "ポップ", "ラグジュアリー", "ミニマル", "和風", "サイバー"];
const SECTION_OPTIONS = [
  "ヒーロー（ファーストビュー）",
  "サービスの特徴・強み",
  "使い方・3 ステップ",
  "料金プラン",
  "お客様の声",
  "よくある質問（FAQ）",
  "実績・数字",
  "会社情報",
  "お問い合わせフォーム",
];

const INITIAL: Brief = {
  brand: "",
  headline: "",
  description: "",
  audience: "",
  primaryColor: "#0ea5e9",
  accentColor: "#f59e0b",
  style: "モダン",
  sections: ["ヒーロー（ファーストビュー）", "サービスの特徴・強み", "料金プラン", "お問い合わせフォーム"],
  ctaLabel: "今すぐ申し込む",
  ctaHref: "mailto:info@example.com",
  generateImages: true,
  customInstructions: "",
  characterRefPaths: [],
};

type Log = { kind: string; text: string; ts: number };
type Phase = "wizard" | "generating" | "done";

export default function Home() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>(INITIAL);
  const [refsInput, setRefsInput] = useState("");
  const [phase, setPhase] = useState<Phase>("wizard");
  const [logs, setLogs] = useState<Log[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const append = (kind: string, text: string) =>
    setLogs((p) => [...p, { kind, text, ts: Date.now() }]);

  const toggleSection = (s: string) => {
    setBrief((b) => ({
      ...b,
      sections: b.sections.includes(s)
        ? b.sections.filter((x) => x !== s)
        : [...b.sections, s],
    }));
  };

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const startGenerate = async () => {
    setPhase("generating");
    setLogs([]);
    setResultId(null);
    append("info", "Codex に LP 生成を依頼…");

    const refPaths = refsInput.split("\n").map((s) => s.trim()).filter(Boolean);
    const briefToSend: Brief = { ...brief, characterRefPaths: refPaths };

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: briefToSend }),
    });

    if (!res.body) {
      append("error", "通信に失敗しました");
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try {
          handleEvent(ev, JSON.parse(data));
        } catch {
          append("raw", data);
        }
      }
    }
  };

  const handleEvent = (ev: string, data: any) => {
    switch (ev) {
      case "init":
        append(
          "info",
          `生成 ID: ${data.id} ${data.willGenerateImages ? "(画像生成あり / Codex 組み込み image_gen)" : "(画像生成なし)"}`,
        );
        break;
      case "heartbeat":
        // 既存ハートビート行があれば置き換え、無ければ追加
        setLogs((p) => {
          const idx = p.findIndex((l) => l.kind === "heartbeat");
          const entry: Log = {
            kind: "heartbeat",
            text: `Codex 稼働中… ${data.elapsedSec} 秒経過`,
            ts: Date.now(),
          };
          if (idx >= 0) {
            const c = [...p];
            c[idx] = entry;
            return c;
          }
          return [...p, entry];
        });
        break;
      case "step":
        append(data.kind || "step", data.text);
        break;
      case "agent":
        if (data.text) append("agent", data.text);
        break;
      case "delta":
        // agent message 途中経過。連続してくるので末尾の delta 行に append する
        setLogs((p) => {
          const last = p[p.length - 1];
          if (last && last.kind === "agent-delta") {
            const c = [...p];
            c[c.length - 1] = { ...last, text: last.text + (data.text ?? "") };
            return c;
          }
          return [...p, { kind: "agent-delta", text: data.text ?? "", ts: Date.now() }];
        });
        break;
      case "reasoning_delta":
        setLogs((p) => {
          const last = p[p.length - 1];
          if (last && last.kind === "reasoning-stream") {
            const c = [...p];
            c[c.length - 1] = { ...last, text: last.text + (data.text ?? "") };
            return c;
          }
          return [...p, { kind: "reasoning-stream", text: data.text ?? "", ts: Date.now() }];
        });
        break;
      case "cmd_output":
        append("cmd-out", data.text ?? "");
        break;
      case "stderr":
        append("stderr", data.text ?? "");
        break;
      case "done":
        setResultId(data.id);
        setPhase("done");
        append("done", "LP 完成");
        break;
      case "error":
        append("error", data.message ?? JSON.stringify(data));
        break;
    }
  };

  const reset = () => {
    setPhase("wizard");
    setStep(0);
    setLogs([]);
    setResultId(null);
  };

  if (phase === "done" && resultId) {
    return <ResultView id={resultId} onReset={reset} />;
  }
  if (phase === "generating") {
    return <GeneratingView logs={logs} logEndRef={logEndRef} />;
  }

  return (
    <main className="min-h-screen text-stone-800">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <SectionTitle
          title="LP Maker"
          subtitle="if(塾) ランディングページ自動生成室"
        />

        <Stepper step={step} />

        {step === 0 && (
          <CharacterDialog
            ashura={{ img: "ashura_suggest", text: "ワシは LP Maker の案内人じゃ。どんなブランドの LP を作るか、まずは基本情報を授けてくれぬか。" }}
            mobuta={{ img: "mobuta_present", text: "うん、ちゃんと書くね！" }}
          />
        )}
        {step === 1 && (
          <CharacterDialog
            ashura={{ img: "ashura_think", text: "次は見た目の話じゃ。色とスタイル、どんな雰囲気にしたい？" }}
            mobuta={{ img: "mobuta_idea", text: "こんな感じがいい！" }}
          />
        )}
        {step === 2 && (
          <CharacterDialog
            ashura={{ img: "ashura_normal", text: "いよいよ仕上げじゃ。CTA や追加のこだわりがあれば書いてくれ。" }}
            mobuta={{ img: "mobuta_happy", text: "完成が楽しみだなぁ！" }}
          />
        )}

        {step === 0 && <Step1 brief={brief} setBrief={setBrief} />}
        {step === 1 && (
          <Step2 brief={brief} setBrief={setBrief} toggleSection={toggleSection} />
        )}
        {step === 2 && (
          <Step3
            brief={brief}
            setBrief={setBrief}
            refsInput={refsInput}
            setRefsInput={setRefsInput}
          />
        )}

        <div className="flex justify-between pt-4">
          <button
            disabled={step === 0}
            onClick={prev}
            className="px-6 py-3 rounded-full text-base bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            戻る
          </button>
          {step < 2 ? (
            <button
              onClick={next}
              disabled={step === 0 && (!brief.brand.trim() || !brief.headline.trim())}
              className="px-7 py-3 rounded-full text-base font-medium text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
            >
              次へ
            </button>
          ) : (
            <button
              onClick={startGenerate}
              disabled={brief.sections.length === 0}
              className="px-7 py-3 rounded-full text-base font-medium text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
            >
              LP を生成する
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="w-full bg-white/80 backdrop-blur border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold tracking-wider text-sm">
            LP
          </div>
          <span className="font-bold tracking-wide text-stone-800">LP Maker</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-4 py-1.5 rounded-full text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium shadow-sm">
            Ashura
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-stone-200/70">
      <img
        src="/characters/ashura_normal.png"
        alt="アシュラくん"
        className="w-12 h-12 object-contain"
        draggable={false}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-orange-600">
          {title}
        </h1>
        <p className="text-sm text-stone-500 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["基本情報", "デザイン・構成", "CTA・画像生成"];
  return (
    <div className="flex items-center gap-3 text-sm">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-3 flex-1">
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-base font-bold shadow-sm ${
              i <= step
                ? "bg-gradient-to-br from-orange-500 to-red-500 border-orange-400 text-white"
                : "border-stone-300 text-stone-400 bg-white"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-base font-medium ${i === step ? "text-stone-800" : "text-stone-400"}`}>
            {l}
          </span>
          {i < labels.length - 1 && (
            <div className="flex-1 h-px bg-stone-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-base font-semibold tracking-wide text-stone-800">{label}</span>
      {hint && <span className="block text-sm text-stone-500 leading-relaxed">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-base leading-relaxed tracking-wide text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 shadow-sm";

function Step1({
  brief,
  setBrief,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
}) {
  return (
    <section className="space-y-5">
      <Field label="ブランド名 / サービス名" hint="ページのタイトルに使います">
        <input
          className={inputCls}
          value={brief.brand}
          onChange={(e) => setBrief({ ...brief, brand: e.target.value })}
          placeholder="例: SunRise Coffee"
        />
      </Field>
      <Field label="キャッチコピー（1 行）" hint="ファーストビューに大きく出ます">
        <input
          className={inputCls}
          value={brief.headline}
          onChange={(e) => setBrief({ ...brief, headline: e.target.value })}
          placeholder="例: 朝の 15 分を、最高の一杯から"
        />
      </Field>
      <Field label="サービス・商品の説明" hint="数行で OK。読者に何を提供するか">
        <textarea
          className={inputCls}
          rows={4}
          value={brief.description}
          onChange={(e) => setBrief({ ...brief, description: e.target.value })}
          placeholder="例: 産地直送のスペシャルティ豆を、自宅でハンドドリップ品質で淹れられるサブスクリプションサービスです。"
        />
      </Field>
      <Field label="ターゲット（誰に向けたページ？）">
        <input
          className={inputCls}
          value={brief.audience}
          onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
          placeholder="例: 自宅で本格コーヒーを楽しみたい 30 代会社員"
        />
      </Field>
    </section>
  );
}

function Step2({
  brief,
  setBrief,
  toggleSection,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
  toggleSection: (s: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="メインカラー">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={brief.primaryColor}
              onChange={(e) =>
                setBrief({ ...brief, primaryColor: e.target.value })
              }
              className="h-12 w-14 rounded-lg border border-stone-300 bg-white cursor-pointer"
            />
            <input
              className={inputCls}
              value={brief.primaryColor}
              onChange={(e) =>
                setBrief({ ...brief, primaryColor: e.target.value })
              }
            />
          </div>
        </Field>
        <Field label="アクセントカラー">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={brief.accentColor}
              onChange={(e) =>
                setBrief({ ...brief, accentColor: e.target.value })
              }
              className="h-12 w-14 rounded-lg border border-stone-300 bg-white cursor-pointer"
            />
            <input
              className={inputCls}
              value={brief.accentColor}
              onChange={(e) =>
                setBrief({ ...brief, accentColor: e.target.value })
              }
            />
          </div>
        </Field>
      </div>

      <Field label="デザインスタイル">
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setBrief({ ...brief, style: s })}
              className={`text-base px-4 py-3 rounded-xl border-2 tracking-wide font-medium shadow-sm transition-colors ${
                brief.style === s
                  ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white"
                  : "bg-white border-stone-300 text-stone-700 hover:bg-amber-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label="掲載するセクション"
        hint="チェックを入れた順番ではなく、デザインに合った順序で生成されます"
      >
        <div className="grid grid-cols-2 gap-2">
          {SECTION_OPTIONS.map((s) => (
            <label
              key={s}
              className={`flex items-center gap-3 text-base leading-relaxed px-4 py-3 rounded-xl border-2 cursor-pointer shadow-sm transition-colors ${
                brief.sections.includes(s)
                  ? "bg-amber-50 border-orange-300 text-stone-800"
                  : "bg-white border-stone-300 text-stone-700 hover:bg-amber-50/50"
              }`}
            >
              <input
                type="checkbox"
                checked={brief.sections.includes(s)}
                onChange={() => toggleSection(s)}
                className="accent-emerald-500"
              />
              {s}
            </label>
          ))}
        </div>
      </Field>
    </section>
  );
}

function Step3({
  brief,
  setBrief,
  refsInput,
  setRefsInput,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
  refsInput: string;
  setRefsInput: (v: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="CTA ボタンの文言">
          <input
            className={inputCls}
            value={brief.ctaLabel}
            onChange={(e) =>
              setBrief({ ...brief, ctaLabel: e.target.value })
            }
          />
        </Field>
        <Field label="CTA のリンク先" hint="URL または mailto:">
          <input
            className={inputCls}
            value={brief.ctaHref}
            onChange={(e) => setBrief({ ...brief, ctaHref: e.target.value })}
          />
        </Field>
      </div>

      <Field
        label="画像生成 (gpt-image-2)"
        hint="Codex 組み込みの image_gen ツールで生成（ChatGPT サブスク内・API キー不要）。サブスク制限などで失敗した場合は画像なしで完成します。"
      >
        <label className="flex items-center gap-3 text-base bg-white border-2 border-stone-300 rounded-xl px-4 py-3 cursor-pointer leading-relaxed text-stone-700 shadow-sm">
          <input
            type="checkbox"
            checked={brief.generateImages}
            onChange={(e) =>
              setBrief({ ...brief, generateImages: e.target.checked })
            }
            className="accent-emerald-500"
          />
          AI 画像を生成して LP に差し込む
        </label>
      </Field>

      <Field
        label="追加カスタム指示（自由記述）"
        hint="各パーツの見せ方・テイスト・実装したい機能などを自由に記述。例: 「ヒーローに動画背景を入れたい」「料金表は3カラムでホバー時に拡大」「FAQ はアコーディオン式」など。記述した内容は LP 生成の最優先要件として反映されます。"
      >
        <textarea
          className={inputCls}
          rows={6}
          value={brief.customInstructions}
          onChange={(e) =>
            setBrief({ ...brief, customInstructions: e.target.value })
          }
          placeholder={"例:\n・ヒーローは動画ループの背景にしたい\n・料金プランは年額/月額のトグル切替\n・お問い合わせフォームに Slack 風のチャット UI を実装\n・全体的に手書き風のフォントとアニメーションを多用"}
        />
      </Field>

      <Field
        label="キャラクター参照画像（任意）"
        hint="image_gen の image-to-image 機能で、ヒーロー画像や各セクションに同じキャラを登場させたい場合のみ。絶対パスを 1 行 1 枚で。空欄でも OK。"
      >
        <textarea
          className={`${inputCls} font-mono`}
          rows={4}
          value={refsInput}
          onChange={(e) => setRefsInput(e.target.value)}
          placeholder={"/Users/you/Desktop/ifJukuManager/Codex/images/高1.png\n/Users/you/.../山1.png"}
        />
      </Field>
    </section>
  );
}

function GeneratingView({
  logs,
  logEndRef,
}: {
  logs: Log[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <main className="min-h-screen text-stone-800">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <SectionTitle title="生成中" subtitle="Codex が LP を書いておるところじゃ。1〜3 分ほど待たれよ" />
        <CharacterDialog
          ashura={{ img: "ashura_normal", text: "Codex が文面を整え、画像を呼び寄せておる最中じゃ。少し待たれよ。" }}
          mobuta={{ img: "mobuta_think", text: "ドキドキ……どんな LP になるかな" }}
        />
        <div className="bg-stone-900 border border-stone-300 rounded-2xl p-4 h-[460px] overflow-y-auto font-mono text-xs space-y-1 shadow-inner">
          {logs.map((l, i) => (
            <div key={i} className={kindClass(l.kind)}>
              <span className="text-stone-500">
                {new Date(l.ts).toLocaleTimeString()}
              </span>{" "}
              {l.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </main>
  );
}

function ResultView({ id, onReset }: { id: string; onReset: () => void }) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<Log[]>([]);
  const [result, setResult] = useState<{ repo: string; pagesUrl: string; note?: string } | null>(null);

  const publish = async () => {
    setPublishing(true);
    setPublishLogs([]);
    setResult(null);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, repoName: repoName.trim() || undefined }),
    });
    if (!res.body) {
      setPublishLogs((p) => [...p, { kind: "error", text: "通信失敗", ts: Date.now() }]);
      setPublishing(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let ev = "message";
        let dataStr = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event: ")) ev = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        try {
          const data = JSON.parse(dataStr);
          if (ev === "step") {
            setPublishLogs((p) => [...p, { kind: "step", text: data.text, ts: Date.now() }]);
          } else if (ev === "error") {
            setPublishLogs((p) => [...p, { kind: "error", text: data.message, ts: Date.now() }]);
          } else if (ev === "done") {
            setResult({ repo: data.repo, pagesUrl: data.pagesUrl, note: data.note });
            setPublishLogs((p) => [...p, { kind: "done", text: `✓ ${data.pagesUrl}`, ts: Date.now() }]);
          }
        } catch {}
      }
    }
    setPublishing(false);
  };

  return (
    <main className="min-h-screen flex flex-col text-stone-800">
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/characters/ashura_happy.png"
            alt="アシュラくん"
            className="w-12 h-12 object-contain"
            draggable={false}
          />
          <h1 className="font-bold text-lg tracking-wide text-orange-600">LP が完成したぞ</h1>
          <img
            src="/characters/mobuta_happy.png"
            alt="モブ太くん"
            className="w-10 h-10 object-contain"
            draggable={false}
          />
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/download/${id}`}
            className="text-sm text-white px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 shadow-sm font-medium"
          >
            ZIP ダウンロード
          </a>
          <button
            onClick={() => setPublishOpen((v) => !v)}
            className="text-sm text-white px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-sm font-medium"
          >
            GitHub Pages に公開
          </button>
          <a
            href={`/api/preview/${id}/index.html`}
            target="_blank"
            rel="noreferrer"
            className="text-sm bg-white border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-full text-stone-700 shadow-sm"
          >
            新しいタブで開く
          </a>
          <button
            onClick={onReset}
            className="text-sm bg-white border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-full text-stone-700 shadow-sm"
          >
            もう一度作る
          </button>
        </div>
      </header>

      {publishOpen && (
        <section className="border-b border-stone-200 px-6 py-4 bg-amber-50/60 space-y-3">
          {!result && !publishing && (
            <div className="flex items-end gap-2 max-w-2xl">
              <label className="flex-1 space-y-1">
                <span className="text-sm text-stone-600">リポジトリ名（空欄でブランド名から自動）</span>
                <input
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono text-stone-800 shadow-sm"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="例: lp-cafe-lumiere"
                />
              </label>
              <button
                onClick={publish}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white px-5 py-2 rounded-full text-sm font-medium shadow-sm"
              >
                公開する
              </button>
            </div>
          )}
          {(publishing || publishLogs.length > 0) && (
            <div className="bg-stone-900 border border-stone-300 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1 shadow-inner">
              {publishLogs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.kind === "error"
                      ? "text-red-400"
                      : l.kind === "done"
                      ? "text-emerald-400 font-semibold"
                      : "text-stone-200"
                  }
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
          {result && (
            <div className="bg-white border border-orange-300 rounded-xl p-4 text-sm space-y-1 shadow-sm">
              <div>
                公開 URL:{" "}
                <a className="text-orange-600 underline font-medium" href={result.pagesUrl} target="_blank" rel="noreferrer">
                  {result.pagesUrl}
                </a>
              </div>
              <div className="text-xs text-stone-500">
                リポジトリ:{" "}
                <a className="text-violet-600 underline" href={result.repo} target="_blank" rel="noreferrer">
                  {result.repo}
                </a>
              </div>
              {result.note && <div className="text-xs text-amber-600">{result.note}</div>}
            </div>
          )}
        </section>
      )}

      <iframe
        src={`/api/preview/${id}/index.html`}
        className="flex-1 w-full bg-white"
        title="LP Preview"
      />
    </main>
  );
}

type CharSpec = { img: string; text: string };

function CharacterDialog({ ashura, mobuta }: { ashura: CharSpec; mobuta: CharSpec }) {
  return (
    <div className="space-y-5">
      {/* アシュラくん：左から問いかける（cream bubble） */}
      <div className="flex items-end gap-3">
        <img
          src={`/characters/${ashura.img}.png`}
          alt="アシュラくん"
          className="w-16 h-16 md:w-20 md:h-20 object-contain select-none rounded-full bg-amber-100/40 p-1"
          draggable={false}
        />
        <div className="relative max-w-[80%]">
          <div className="rounded-2xl rounded-bl-sm bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 px-5 py-4 text-base leading-relaxed text-stone-800 shadow-sm">
            {ashura.text}
          </div>
        </div>
      </div>
      {/* モブ太：右側でリアクション（purple bubble） */}
      <div className="flex items-end gap-3 flex-row-reverse">
        <img
          src={`/characters/${mobuta.img}.png`}
          alt="モブ太くん"
          className="w-14 h-14 md:w-16 md:h-16 object-contain select-none rounded-full bg-violet-100/40 p-1"
          draggable={false}
        />
        <div className="relative max-w-[70%]">
          <div className="rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-purple-600 px-5 py-3.5 text-base leading-relaxed text-white shadow-md">
            {mobuta.text}
          </div>
        </div>
      </div>
    </div>
  );
}

function kindClass(k: string) {
  switch (k) {
    case "error":
    case "command-err":
    case "stderr":
      return "text-red-400";
    case "done":
      return "text-emerald-400 font-semibold";
    case "info":
    case "thread":
    case "turn":
    case "status":
      return "text-sky-400";
    case "agent":
    case "agent-delta":
      return "text-zinc-100 whitespace-pre-wrap";
    case "command":
    case "command-ok":
      return "text-zinc-300";
    case "cmd-out":
      return "text-zinc-500 whitespace-pre-wrap";
    case "file":
    case "file-ok":
      return "text-purple-300";
    case "reasoning":
    case "reasoning-stream":
      return "text-amber-200/70 italic";
    case "plan":
      return "text-emerald-300";
    case "web":
    case "tool":
      return "text-cyan-300";
    case "heartbeat":
      return "text-zinc-600";
    default:
      return "text-zinc-500";
  }
}
