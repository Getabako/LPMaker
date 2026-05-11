import fs from "node:fs";
import path from "node:path";

export type ImageSpec = {
  filename: string;
  prompt: string;
  /** "1024x1024" | "1536x1024" | "1024x1536" | "auto" */
  size?: string;
  /** "low" | "medium" | "high" | "auto" */
  quality?: string;
  background?: "transparent" | "opaque" | "auto";
};

export type ImagesManifest = {
  model?: string;
  images: ImageSpec[];
};

const DEFAULT_MODEL = process.env.LPMAKER_IMAGE_MODEL || "gpt-image-2";
const ENDPOINT = "https://api.openai.com/v1/images/generations";

export type GenProgress =
  | { type: "start"; total: number; model: string }
  | {
      type: "image";
      index: number;
      filename: string;
      status: "ok" | "error";
      error?: string;
    }
  | { type: "done"; ok: number; failed: number };

export async function generateImages(
  projectDir: string,
  manifest: ImagesManifest,
  apiKey: string,
  onProgress: (p: GenProgress) => void,
): Promise<{ ok: number; failed: number }> {
  const imagesDir = path.join(projectDir, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  const model = manifest.model || DEFAULT_MODEL;
  const total = manifest.images.length;
  onProgress({ type: "start", total, model });

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < manifest.images.length; i++) {
    const spec = manifest.images[i];
    try {
      const body: Record<string, unknown> = {
        model,
        prompt: spec.prompt,
        n: 1,
        size: spec.size || "1024x1024",
      };
      if (spec.quality) body.quality = spec.quality;
      if (spec.background) body.background = spec.background;

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        data: Array<{ b64_json?: string; url?: string }>;
      };
      const first = json.data?.[0];
      if (!first) throw new Error("no image returned");

      const outPath = path.join(imagesDir, spec.filename);
      if (first.b64_json) {
        fs.writeFileSync(outPath, Buffer.from(first.b64_json, "base64"));
      } else if (first.url) {
        const imgRes = await fetch(first.url);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(outPath, buf);
      } else {
        throw new Error("no b64 or url in response");
      }

      ok++;
      onProgress({ type: "image", index: i, filename: spec.filename, status: "ok" });
    } catch (err) {
      failed++;
      onProgress({
        type: "image",
        index: i,
        filename: spec.filename,
        status: "error",
        error: (err as Error).message,
      });
    }
  }

  onProgress({ type: "done", ok, failed });
  return { ok, failed };
}
