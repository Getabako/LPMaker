"use client";

import { useRef, useState } from "react";

export type RefImage = {
  /** 絶対パス（サーバー上に保存されたファイルの実体パス） */
  path: string;
  /** プレビュー用 Blob URL（クライアント側のみ） */
  previewUrl: string;
  name: string;
};

type Props = {
  /** 現在の絶対パス配列（外部で保持） */
  paths: string[];
  /** 絶対パス配列が変化したときに通知 */
  onChange: (paths: string[]) => void;
  /** アップロード API のパス（既定: /api/upload-refs） */
  uploadEndpoint?: string;
  className?: string;
};

export function RefImagePicker({
  paths,
  onChange,
  uploadEndpoint = "/api/upload-refs",
  className = "",
}: Props) {
  const [items, setItems] = useState<RefImage[]>(() =>
    paths.map((p) => ({ path: p, previewUrl: "", name: p.split("/").pop() ?? p })),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sync = (next: RefImage[]) => {
    setItems(next);
    onChange(next.map((it) => it.path));
  };

  const upload = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of imageFiles) fd.append("files", f, f.name);
      const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const data = (await res.json()) as { paths: string[] };
      const added: RefImage[] = data.paths.map((p, i) => ({
        path: p,
        previewUrl: URL.createObjectURL(imageFiles[i]),
        name: imageFiles[i].name,
      }));
      sync([...items, ...added]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length > 0) upload(list);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length > 0) upload(list);
  };

  const remove = (idx: number) => {
    const next = items.slice();
    const [gone] = next.splice(idx, 1);
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
    sync(next);
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? "border-orange-400 bg-orange-50"
            : "border-stone-300 bg-white/60 hover:bg-stone-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
        />
        <div className="text-sm text-stone-700 font-medium">
          {uploading ? "アップロード中…" : "画像をドラッグ&ドロップ、またはクリックして選択"}
        </div>
        <div className="text-xs text-stone-500 mt-1">
          複数枚 OK / png・jpg・webp 等
        </div>
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}
      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {items.map((it, i) => (
            <div
              key={`${it.path}-${i}`}
              className="relative group rounded-lg overflow-hidden border border-stone-200 bg-white"
            >
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.previewUrl} alt={it.name} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-stone-50 text-stone-400 text-xs px-2 text-center break-all">
                  {it.name}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="absolute top-1 right-1 rounded-full bg-black/70 text-white text-xs w-6 h-6 flex items-center justify-center opacity-90 hover:bg-black"
                title="削除"
              >
                ×
              </button>
              <div className="px-1.5 py-1 text-[10px] text-stone-500 truncate" title={it.path}>
                {it.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
