import fs from "node:fs";
import path from "node:path";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; filepath: string[] }> },
) {
  const { id, filepath } = await ctx.params;

  if (!id || !/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }

  const projectDir = paths.projectDir(id);
  const rel = (filepath ?? []).join("/");
  const abs = path.resolve(projectDir, rel);

  if (!abs.startsWith(projectDir + path.sep) && abs !== projectDir) {
    return new Response("forbidden", { status: 403 });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("not found", { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const data = fs.readFileSync(abs);
  return new Response(data, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    },
  });
}
