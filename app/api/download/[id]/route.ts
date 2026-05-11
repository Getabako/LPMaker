import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);
// archiver is CJS — load via require to dodge ESM default-export quirks in Turbopack.
const archiver: typeof import("archiver") = require("archiver");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const projectDir = paths.projectDir(id);
  if (!fs.existsSync(projectDir)) {
    return new Response("not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      archive.on("end", () => {
        try { controller.close(); } catch {}
      });
      archive.on("error", (err) => {
        try { controller.error(err); } catch {}
      });

      const indexPath = path.join(projectDir, "index.html");
      if (fs.existsSync(indexPath)) {
        archive.file(indexPath, { name: "index.html" });
      }
      const imagesDir = path.join(projectDir, "images");
      if (fs.existsSync(imagesDir)) {
        archive.directory(imagesDir, "images");
      }
      archive.finalize();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lp-${id}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
