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
};

type Log = { kind: string; text: string; ts: number };
type Phase = "wizard" | "generating" | "done";

export default function Home() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>(INITIAL);
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
    append("info", "▶ Codex に LP 生成を依頼…");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief }),
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
            text: `⏱ Codex 稼働中… ${data.elapsedSec} 秒経過`,
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
        if (data.text) append("agent", `🤖 ${data.text}`);
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
          return [...p, { kind: "reasoning-stream", text: "🧠 " + (data.text ?? ""), ts: Date.now() }];
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
        append("done", "🎉 LP 完成！");
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
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            ✨ LP Maker
          </h1>
          <p className="text-zinc-400 text-sm">
            いくつかの質問に答えると、Codex がリッチな LP を作って画像まで差し込みます。
          </p>
        </header>

        <Stepper step={step} />

        {step === 0 && <Step1 brief={brief} setBrief={setBrief} />}
        {step === 1 && (
          <Step2 brief={brief} setBrief={setBrief} toggleSection={toggleSection} />
        )}
        {step === 2 && <Step3 brief={brief} setBrief={setBrief} />}

        <div className="flex justify-between pt-4">
          <button
            disabled={step === 0}
            onClick={prev}
            className="px-4 py-2 rounded-md text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← 戻る
          </button>
          {step < 2 ? (
            <button
              onClick={next}
              disabled={step === 0 && (!brief.brand.trim() || !brief.headline.trim())}
              className="px-5 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              次へ →
            </button>
          ) : (
            <button
              onClick={startGenerate}
              disabled={brief.sections.length === 0}
              className="px-5 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              ▶ LP を生成する
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["基本情報", "デザイン・構成", "CTA・画像生成"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border ${
              i <= step
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "border-zinc-700 text-zinc-500"
            }`}
          >
            {i + 1}
          </div>
          <span className={i === step ? "text-zinc-100" : "text-zinc-500"}>
            {l}
          </span>
          {i < labels.length - 1 && (
            <div className="flex-1 h-px bg-zinc-800" />
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
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500";

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
              className="h-10 w-12 rounded border border-zinc-800 bg-zinc-900"
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
              className="h-10 w-12 rounded border border-zinc-800 bg-zinc-900"
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
              className={`text-sm px-3 py-2 rounded-md border ${
                brief.style === s
                  ? "bg-emerald-600 border-emerald-500"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
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
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md border cursor-pointer ${
                brief.sections.includes(s)
                  ? "bg-emerald-900/30 border-emerald-700"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
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
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
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
        <label className="flex items-center gap-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 cursor-pointer">
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          生成中…
        </h1>
        <p className="text-sm text-zinc-400">
          Codex が HTML を書いてから、画像を差し込みます。1〜3 分かかります。
        </p>
        <div className="bg-black border border-zinc-800 rounded-md p-4 h-[500px] overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((l, i) => (
            <div key={i} className={kindClass(l.kind)}>
              <span className="text-zinc-600">
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold">🎉 LP 完成</h1>
        <div className="flex gap-2">
          <a
            href={`/api/download/${id}`}
            className="text-sm bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded"
          >
            ⬇ ZIP ダウンロード
          </a>
          <button
            onClick={() => setPublishOpen((v) => !v)}
            className="text-sm bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded"
          >
            🌐 GitHub Pages に公開
          </button>
          <a
            href={`/api/preview/${id}/index.html`}
            target="_blank"
            rel="noreferrer"
            className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded"
          >
            ↗ 新しいタブで開く
          </a>
          <button
            onClick={onReset}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded"
          >
            もう一度作る
          </button>
        </div>
      </header>

      {publishOpen && (
        <section className="border-b border-zinc-800 px-6 py-4 bg-zinc-900/60 space-y-3">
          {!result && !publishing && (
            <div className="flex items-end gap-2 max-w-2xl">
              <label className="flex-1 space-y-1">
                <span className="text-xs text-zinc-400">リポジトリ名（空欄でブランド名から自動）</span>
                <input
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm font-mono"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="例: lp-cafe-lumiere"
                />
              </label>
              <button
                onClick={publish}
                className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded text-sm font-medium"
              >
                ▶ 公開する
              </button>
            </div>
          )}
          {(publishing || publishLogs.length > 0) && (
            <div className="bg-black border border-zinc-800 rounded-md p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
              {publishLogs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.kind === "error"
                      ? "text-red-400"
                      : l.kind === "done"
                      ? "text-emerald-400 font-semibold"
                      : "text-zinc-300"
                  }
                >
                  {l.text}
                </div>
              ))}
            </div>
          )}
          {result && (
            <div className="bg-emerald-950/40 border border-emerald-700 rounded-md p-3 text-sm space-y-1">
              <div>
                🌐 公開 URL:{" "}
                <a className="text-emerald-300 underline" href={result.pagesUrl} target="_blank" rel="noreferrer">
                  {result.pagesUrl}
                </a>
              </div>
              <div className="text-xs text-zinc-400">
                📦 リポジトリ:{" "}
                <a className="text-sky-300 underline" href={result.repo} target="_blank" rel="noreferrer">
                  {result.repo}
                </a>
              </div>
              {result.note && <div className="text-xs text-amber-300">{result.note}</div>}
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
