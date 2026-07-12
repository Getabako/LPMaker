"use client";

import { useEffect, useRef, useState } from "react";
import { RefImagePicker } from "./components/RefImagePicker";

type HeroMode = "static" | "slider" | "video" | "gradient";

type Brief = {
  brand: string;
  headline: string;
  description: string;
  audience: string;
  primaryColor: string;
  accentColor: string;
  style: string;
  styleCustom: string;
  sections: string[];
  sectionsCustom: string;
  ctaLabel: string;
  ctaHref: string;
  generateImages: boolean;
  customInstructions: string;
  characterRefPaths: string[];
  heroMode: HeroMode;
  heroVideoUrl: string;
  heroSliderUrls: string;
  embedMapUrl: string;
  embedVideoUrls: string;
  embedSocialUrls: string;
  embedCustomHtml: string;
};

type StyleSpec = { name: string; texture: string; textTone: "light" | "dark" };
const STYLES: StyleSpec[] = [
  { name: "モダン", texture: "modern", textTone: "light" },
  { name: "ポップ", texture: "pop", textTone: "light" },
  { name: "ラグジュアリー", texture: "luxury", textTone: "light" },
  { name: "ミニマル", texture: "minimal", textTone: "dark" },
  { name: "和風", texture: "japanese", textTone: "light" },
  { name: "サイバー", texture: "cyber", textTone: "light" },
  { name: "ナチュラル", texture: "natural", textTone: "light" },
  { name: "レトロ", texture: "retro", textTone: "dark" },
  { name: "ブルータリスト", texture: "brutalist", textTone: "dark" },
  { name: "グラスモーフィズム", texture: "glass", textTone: "dark" },
  { name: "ニューモーフィズム", texture: "neumorphism", textTone: "dark" },
  { name: "ダークモード", texture: "dark", textTone: "light" },
  { name: "パステル", texture: "pastel", textTone: "dark" },
  { name: "コーポレート", texture: "corporate", textTone: "light" },
  { name: "手書き / ZINE", texture: "handwritten", textTone: "dark" },
  { name: "エディトリアル雑誌風", texture: "editorial", textTone: "dark" },
];

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
  "ギャラリー / 写真一覧",
  "ニュース / 更新情報",
  "メンバー / 講師紹介",
  "比較表",
  "導入事例 / 制作実績",
  "ロードマップ / 開発予定",
  "メディア掲載",
  "受賞歴 / 認定",
  "ダウンロード資料",
  "アクセス / 地図",
  "イベント / セミナー予定",
  "採用情報",
  "メルマガ / LINE 登録",
  "SNS フィード",
  "動画埋め込み（YouTube 等）",
  "ブログ / コラム一覧",
  "パートナー / スポンサー",
];

const INITIAL: Brief = {
  brand: "",
  headline: "",
  description: "",
  audience: "",
  primaryColor: "#0ea5e9",
  accentColor: "#f59e0b",
  style: "モダン",
  styleCustom: "",
  sections: ["ヒーロー（ファーストビュー）", "サービスの特徴・強み", "料金プラン", "お問い合わせフォーム"],
  sectionsCustom: "",
  ctaLabel: "今すぐ申し込む",
  ctaHref: "mailto:info@example.com",
  generateImages: true,
  customInstructions: "",
  characterRefPaths: [],
  heroMode: "static",
  heroVideoUrl: "",
  heroSliderUrls: "",
  embedMapUrl: "",
  embedVideoUrls: "",
  embedSocialUrls: "",
  embedCustomHtml: "",
};

type Log = { kind: string; text: string; ts: number };
type Phase = "wizard" | "generating" | "done";

export default function Home() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<Brief>(INITIAL);
  const [refPaths, setRefPaths] = useState<string[]>([]);
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
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
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
            refPaths={refPaths}
            setRefPaths={setRefPaths}
          />
        )}

        <div className="flex justify-between pt-4">
          <button
            disabled={step === 0}
            onClick={prev}
            className="px-7 py-3.5 rounded-full text-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            戻る
          </button>
          {step < 2 ? (
            <button
              onClick={next}
              disabled={step === 0 && (!brief.brand.trim() || !brief.headline.trim())}
              className="px-8 py-3.5 rounded-full text-lg font-medium text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
            >
              次へ
            </button>
          ) : (
            <button
              onClick={startGenerate}
              disabled={brief.sections.length === 0}
              className="px-8 py-3.5 rounded-full text-lg font-medium text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-stone-500 shadow-md"
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
      <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
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
        <h1 className="text-3xl font-bold tracking-wide text-orange-600">
          {title}
        </h1>
        <p className="text-base text-stone-500 leading-relaxed">{subtitle}</p>
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
          <span className={`text-lg font-medium ${i === step ? "text-stone-800" : "text-stone-400"}`}>
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
      <span className="block text-lg font-semibold tracking-wide text-stone-800">{label}</span>
      {hint && <span className="block text-base text-stone-500 leading-relaxed">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3.5 text-lg leading-relaxed tracking-wide text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 shadow-sm";

type Accent = "sky" | "rose" | "emerald" | "violet" | "amber" | "indigo" | "teal";

const ACCENT: Record<Accent, { border: string; bg: string; ring: string; ico: string; tag: string; iconBg: string }> = {
  sky:     { border: "border-sky-300",     bg: "bg-sky-50/60",     ring: "focus:ring-sky-300 focus:border-sky-400",     ico: "text-sky-600",     tag: "bg-sky-100 text-sky-700",     iconBg: "bg-sky-100" },
  rose:    { border: "border-rose-300",    bg: "bg-rose-50/60",    ring: "focus:ring-rose-300 focus:border-rose-400",    ico: "text-rose-600",    tag: "bg-rose-100 text-rose-700",    iconBg: "bg-rose-100" },
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50/60", ring: "focus:ring-emerald-300 focus:border-emerald-400", ico: "text-emerald-600", tag: "bg-emerald-100 text-emerald-700", iconBg: "bg-emerald-100" },
  violet:  { border: "border-violet-300",  bg: "bg-violet-50/60",  ring: "focus:ring-violet-300 focus:border-violet-400",  ico: "text-violet-600",  tag: "bg-violet-100 text-violet-700",  iconBg: "bg-violet-100" },
  amber:   { border: "border-amber-300",   bg: "bg-amber-50/60",   ring: "focus:ring-amber-300 focus:border-amber-400",   ico: "text-amber-600",   tag: "bg-amber-100 text-amber-700",   iconBg: "bg-amber-100" },
  indigo:  { border: "border-indigo-300",  bg: "bg-indigo-50/60",  ring: "focus:ring-indigo-300 focus:border-indigo-400",  ico: "text-indigo-600",  tag: "bg-indigo-100 text-indigo-700",  iconBg: "bg-indigo-100" },
  teal:    { border: "border-teal-300",    bg: "bg-teal-50/60",    ring: "focus:ring-teal-300 focus:border-teal-400",    ico: "text-teal-600",    tag: "bg-teal-100 text-teal-700",    iconBg: "bg-teal-100" },
};

function tinted(accent: Accent, mono = false) {
  const a = ACCENT[accent];
  return `w-full bg-white border-2 ${a.border} rounded-xl px-4 py-3.5 text-lg leading-relaxed tracking-wide text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 ${a.ring} shadow-sm ${mono ? "font-mono text-sm" : ""}`;
}

function ColoredField({
  accent,
  icon,
  label,
  hint,
  badge,
  children,
}: {
  accent: Accent;
  icon: string;
  label: string;
  hint?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`rounded-2xl ${a.bg} border-2 ${a.border} p-4 md:p-5 space-y-3 shadow-sm`}>
      <div className="flex items-start gap-4">
        <span className={`w-14 h-14 rounded-2xl ${a.iconBg} ${a.ico} flex items-center justify-center text-3xl shrink-0 shadow-sm`}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold text-stone-800 tracking-wide leading-snug">{label}</span>
            {badge && (
              <span className={`text-sm font-bold tracking-widest uppercase px-3 py-1 rounded-full ${a.tag}`}>
                {badge}
              </span>
            )}
          </div>
          {hint && <p className="text-base text-stone-600 leading-relaxed mt-1.5">{hint}</p>}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

type SuggestField = "brand" | "headline" | "description" | "audience" | "ctaLabel" | "customInstructions";

function SuggestBox({
  field,
  brief,
  value,
  onPick,
  accent,
}: {
  field: SuggestField;
  brief: Brief;
  value: string;
  onPick: (v: string) => void;
  accent: Accent;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const a = ACCENT[accent];

  const run = async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setOpen(true);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, brief, current: value }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
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
            const obj = JSON.parse(data);
            if (ev === "done") setItems(obj.suggestions || []);
            else if (ev === "error") setError(obj.message || "失敗");
          } catch {}
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-lg font-bold ${a.tag} hover:brightness-95 disabled:opacity-50 shadow-sm`}
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              アシュラ思考中…
            </>
          ) : value.trim() ? (
            <>✨ 上の「{value.trim().slice(0, 14)}{value.trim().length > 14 ? "…" : ""}」を活かして AI に案を出してもらう</>
          ) : (
            <>✨ 他の入力欄も読んで AI に案を出してもらう（空欄でも OK）</>
          )}
        </button>
        {open && !loading && (items.length > 0 || error) && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-stone-500 underline"
          >
            閉じる
          </button>
        )}
      </div>
      {open && (loading || items.length > 0 || error) && (
        <div className={`rounded-xl border-2 border-dashed ${a.border} bg-white/80 p-3 space-y-2`}>
          {error && <div className="text-base text-red-600">エラー: {error}</div>}
          {loading && items.length === 0 && (
            <div className="text-base text-stone-600">候補を考えてもらってます…（10〜30 秒）</div>
          )}
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl bg-white border-2 ${a.border} hover:${a.bg} text-stone-800 text-lg leading-relaxed shadow-sm`}
            >
              {s}
            </button>
          ))}
          {items.length > 0 && (
            <p className="text-sm text-stone-500 leading-relaxed">
              クリックで上の欄に入れます。入れた後そのまま手で書き換え OK。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Card({
  badge,
  title,
  subtitle,
  children,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-3xl bg-white/85 backdrop-blur border border-stone-200 shadow-md overflow-hidden">
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 to-red-500"
      />
      <div className="p-6 md:p-8 pl-7 md:pl-9 space-y-6">
        <SectionHead badge={badge} title={title} subtitle={subtitle} />
        <div className="space-y-5">{children}</div>
      </div>
    </section>
  );
}

function SectionHead({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2 pb-4 border-b-2 border-dashed border-orange-200">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-[0.18em] uppercase text-white bg-gradient-to-r from-orange-500 to-red-500 shadow-sm">
          {badge}
        </span>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide text-stone-900 leading-tight">
          <span className="bg-gradient-to-r from-stone-900 via-orange-700 to-red-600 bg-clip-text text-transparent">
            {title}
          </span>
        </h2>
      </div>
      {subtitle && (
        <p className="text-base text-stone-500 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function SubHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="block w-1.5 h-5 rounded-sm bg-orange-500" />
      <h3 className="text-lg md:text-xl font-bold text-stone-800 tracking-wide">
        {title}
      </h3>
      {hint && <span className="text-sm text-stone-500">— {hint}</span>}
    </div>
  );
}

function Step1({
  brief,
  setBrief,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
}) {
  return (
    <Card
      badge="Step 01"
      title="ブランドの基本情報"
      subtitle="ざっくり単語を入れるだけで OK。入力した単語があれば、その雰囲気・キーワードを尊重して ✨ボタンでアシュラが複数案を提案します。空欄なら他の項目から推測します。"
    >
      <ColoredField
        accent="sky"
        icon="🏷️"
        label="ブランド名 / サービス名"
        badge="Brand"
        hint="ページのタイトルに使います。思いつかなければ ✨ で複数案を出します。"
      >
        <input
          className={tinted("sky")}
          value={brief.brand}
          onChange={(e) => setBrief({ ...brief, brand: e.target.value })}
          placeholder="例: SunRise Coffee（適当な単語でも OK）"
        />
        <div className="pt-2">
          <SuggestBox field="brand" brief={brief} value={brief.brand} accent="sky" onPick={(v) => setBrief({ ...brief, brand: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="rose"
        icon="💬"
        label="キャッチコピー（1 行）"
        badge="Headline"
        hint="ファーストビューに大きく出ます。雑な単語でも、他の入力から判断してアシュラが整えます。"
      >
        <input
          className={tinted("rose")}
          value={brief.headline}
          onChange={(e) => setBrief({ ...brief, headline: e.target.value })}
          placeholder="例: 朝の 15 分を、最高の一杯から（or「速い 安い 旨い」など単語列でも OK）"
        />
        <div className="pt-2">
          <SuggestBox field="headline" brief={brief} value={brief.headline} accent="rose" onPick={(v) => setBrief({ ...brief, headline: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="emerald"
        icon="📝"
        label="サービス・商品の説明"
        badge="Description"
        hint="数行で OK。読者に何を提供するか。書きづらければ ✨ で叩き台を出します。"
      >
        <textarea
          className={tinted("emerald")}
          rows={4}
          value={brief.description}
          onChange={(e) => setBrief({ ...brief, description: e.target.value })}
          placeholder="例: 産地直送のスペシャルティ豆を、自宅でハンドドリップ品質で淹れられるサブスクリプションサービスです。"
        />
        <div className="pt-2">
          <SuggestBox field="description" brief={brief} value={brief.description} accent="emerald" onPick={(v) => setBrief({ ...brief, description: v })} />
        </div>
      </ColoredField>

      <ColoredField
        accent="violet"
        icon="🎯"
        label="ターゲット（誰に向けたページ？）"
        badge="Audience"
        hint="読み手のペルソナ。ざっくり「30 代女性」だけでも、他の入力から具体化します。"
      >
        <input
          className={tinted("violet")}
          value={brief.audience}
          onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
          placeholder="例: 自宅で本格コーヒーを楽しみたい 30 代会社員"
        />
        <div className="pt-2">
          <SuggestBox field="audience" brief={brief} value={brief.audience} accent="violet" onPick={(v) => setBrief({ ...brief, audience: v })} />
        </div>
      </ColoredField>
    </Card>
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
    <div className="space-y-8">
    <Card
      badge="Step 02 - A"
      title="カラー & デザインスタイル"
      subtitle="LP の世界観を決める色と雰囲気を選んでください"
    >
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

      <Field label="デザインスタイル" hint="近い雰囲気のものを選んでくれぬか。複数当てはまる場合は自由記述欄で重ねて指定できる">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {STYLES.map((s) => {
            const selected = brief.style === s.name;
            const isLight = s.textTone === "light";
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => setBrief({ ...brief, style: s.name })}
                style={{
                  backgroundImage: `url(/textures/${s.texture}.svg)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                className={`relative h-24 px-3 rounded-2xl overflow-hidden border-2 font-bold tracking-wide shadow-md transition-transform hover:scale-[1.02] focus:outline-none ${
                  selected
                    ? "border-orange-500 ring-4 ring-orange-200"
                    : "border-stone-200"
                }`}
              >
                <span
                  className={`absolute inset-0 ${
                    isLight
                      ? "bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                      : "bg-gradient-to-t from-white/55 via-white/10 to-transparent"
                  }`}
                />
                <span
                  className={`relative z-10 text-lg drop-shadow-sm ${
                    isLight ? "text-white" : "text-stone-900"
                  }`}
                >
                  {s.name}
                </span>
                {selected && (
                  <span className="absolute top-1.5 right-1.5 z-10 bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                    選択中
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="スタイルの自由記述"
        hint="参考サイト URL、雑誌名、配色イメージ、フォント雰囲気など何でも"
      >
        <textarea
          className={inputCls}
          rows={3}
          value={brief.styleCustom}
          onChange={(e) => setBrief({ ...brief, styleCustom: e.target.value })}
          placeholder={"例:\n・Apple の製品ページのような余白多めの上品な雰囲気\n・参考: https://stripe.com/jp\n・フォントは明朝寄り、写真はモノクロ気味"}
        />
      </Field>
    </Card>

    <Card
      badge="Step 02 - B"
      title="ファーストビュー演出"
      subtitle="LP のトップを静止画 / スライダー / 動画 などで切り替えます"
    >
      <Field
        label="トップ（ファーストビュー）の見せ方"
        hint="ヒーロー部分にスライダーや動画背景を使うか"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(
            [
              { v: "static", label: "静止画 1 枚" },
              { v: "slider", label: "画像スライダー" },
              { v: "video", label: "動画背景" },
              { v: "gradient", label: "グラデのみ" },
            ] as { v: HeroMode; label: string }[]
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setBrief({ ...brief, heroMode: v })}
              className={`text-base px-4 py-3 rounded-xl border-2 font-medium shadow-sm transition-colors ${
                brief.heroMode === v
                  ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white"
                  : "bg-white border-stone-300 text-stone-700 hover:bg-amber-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      {brief.heroMode === "slider" && (
        <Field
          label="スライダー用画像 URL（複数）"
          hint="1 行 1 URL。画像生成で作る場合は空欄でも OK。"
        >
          <textarea
            className={`${inputCls} font-mono text-sm`}
            rows={4}
            value={brief.heroSliderUrls}
            onChange={(e) => setBrief({ ...brief, heroSliderUrls: e.target.value })}
            placeholder={"https://example.com/img1.jpg\nhttps://example.com/img2.jpg"}
          />
        </Field>
      )}

      {brief.heroMode === "video" && (
        <Field
          label="背景動画 URL"
          hint="YouTube / Vimeo / 直接 mp4 URL でも OK"
        >
          <input
            className={`${inputCls} font-mono text-sm`}
            value={brief.heroVideoUrl}
            onChange={(e) => setBrief({ ...brief, heroVideoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Field>
      )}
    </Card>

    <Card
      badge="Step 02 - C"
      title="セクション構成"
      subtitle="LP に含めるブロックを選んでください"
    >
      <Field
        label="掲載するセクション"
        hint="チェックを入れた順番ではなく、デザインに合った順序で生成されます"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                className="accent-orange-500 scale-125"
              />
              {s}
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="その他のセクション（自由記述）"
        hint="1 行 1 セクション。例: 「導入の流れを動画で解説」「監修者からのメッセージ」など"
      >
        <textarea
          className={inputCls}
          rows={3}
          value={brief.sectionsCustom}
          onChange={(e) => setBrief({ ...brief, sectionsCustom: e.target.value })}
          placeholder={"例:\n講師陣の対談動画\n卒業生の進路一覧\n体験会の予約カレンダー"}
        />
      </Field>
    </Card>

    <Card
      badge="Step 02 - D"
      title="外部の埋め込みパーツ"
      subtitle="一般的な LP の上から下までの順番で並んでいます。空欄でも LP は完成します。"
    >
        <ColoredField
          accent="rose"
          icon="🎬"
          label="① トップに流す紹介動画（YouTube/Vimeo）"
          badge="Top Video"
          hint="ファーストビュー（ページ最上部）の主役動画の URL。1 本だけ。Step 02-B で「動画背景」を選んでなくても、トップ付近に大きく埋め込まれます。"
        >
          <input
            className={tinted("rose", true)}
            value={brief.embedVideoUrls}
            onChange={(e) => setBrief({ ...brief, embedVideoUrls: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=xxxxxxxx"
          />
        </ColoredField>

        <ColoredField
          accent="indigo"
          icon="📋"
          label="② Google フォームの埋め込みコード（お問い合わせ／申込）"
          badge="Google Form"
          hint={'Google フォーム →「送信」→「< >（埋め込み）」タブ → <iframe ...></iframe> をそのままコピペ。LP 下部のお問い合わせセクションに組み込まれます。'}
        >
          <textarea
            className={tinted("indigo", true)}
            rows={4}
            value={brief.embedCustomHtml}
            onChange={(e) => setBrief({ ...brief, embedCustomHtml: e.target.value })}
            placeholder={'<iframe src="https://docs.google.com/forms/d/e/.../viewform?embedded=true" width="640" height="800"></iframe>'}
          />
        </ColoredField>

        <ColoredField
          accent="teal"
          icon="🗺️"
          label="③ Google マップ（店舗/教室のアクセス用）"
          badge="Google Maps"
          hint={'Google マップで店舗を表示 →「共有」→「地図を埋め込む」→ HTML をコピー。その中の src="..." の URL（または共有リンク）を貼り付け。アクセス／会社情報セクションに表示されます。'}
        >
          <input
            className={tinted("teal", true)}
            value={brief.embedMapUrl}
            onChange={(e) => setBrief({ ...brief, embedMapUrl: e.target.value })}
            placeholder="https://www.google.com/maps/embed?pb=..."
          />
        </ColoredField>

        <ColoredField
          accent="violet"
          icon="🔗"
          label="④ SNS / 外部リンク（複数可）"
          badge="Social"
          hint="1 行 1 URL。Instagram / X / LINE / TikTok などをフッター付近にアイコンで表示します。"
        >
          <textarea
            className={tinted("violet", true)}
            rows={3}
            value={brief.embedSocialUrls}
            onChange={(e) => setBrief({ ...brief, embedSocialUrls: e.target.value })}
            placeholder={"https://instagram.com/...\nhttps://x.com/...\nhttps://lin.ee/..."}
          />
        </ColoredField>
    </Card>
    </div>
  );
}

function Step3({
  brief,
  setBrief,
  refPaths,
  setRefPaths,
}: {
  brief: Brief;
  setBrief: React.Dispatch<React.SetStateAction<Brief>>;
  refPaths: string[];
  setRefPaths: (v: string[]) => void;
}) {
  return (
    <div className="space-y-8">
    <Card
      badge="Step 03 - A"
      title="コンバージョン設定"
      subtitle="LP のゴールとなる CTA を決めましょう"
    >
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

    </Card>

    <Card
      badge="Step 03 - B"
      title="画像生成と追加指示"
      subtitle="AI 画像と、自由記述による細かい指定"
    >
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

    </Card>

    <Card
      badge="Step 03 - C"
      title="キャラクター参照（任意）"
      subtitle="同じキャラを毎セクションに登場させたい場合は画像パスを指定"
    >
      <Field
        label="キャラクター参照画像（任意）"
        hint="image_gen の image-to-image 機能で、ヒーロー画像や各セクションに同じキャラを登場させたい場合のみ。画像を直接ドラッグ&ドロップ、またはクリックして選択。"
      >
        <RefImagePicker paths={refPaths} onChange={setRefPaths} />
      </Field>
    </Card>
    </div>
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
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-6">
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
          <div className="rounded-2xl rounded-bl-sm bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 px-6 py-4 text-lg leading-relaxed text-stone-800 shadow-sm">
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
          <div className="rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-purple-600 px-6 py-3.5 text-lg leading-relaxed text-white shadow-md">
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
