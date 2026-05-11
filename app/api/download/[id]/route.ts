import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { paths } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const zip = new AdmZip();

  const indexPath = path.join(projectDir, "index.html");
  if (fs.existsSync(indexPath)) {
    zip.addLocalFile(indexPath);
  }
  const imagesDir = path.join(projectDir, "images");
  if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
    zip.addLocalFolder(imagesDir, "images");
  }

  const buf = zip.toBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lp-${id}.zip"`,
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    },
  });
}
