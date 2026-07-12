import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { paths, ensureDir } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return new Response(JSON.stringify({ paths: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const uploadDir = path.join(paths.root, "uploads");
  ensureDir(uploadDir);

  const stamp = () =>
    new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-") +
    "-" + Math.random().toString(36).slice(2, 6);

  const saved: string[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const safeBase = (file.name || "image.png").replace(/[^\w.\-]+/g, "_");
    const name = `${stamp()}-${safeBase}`;
    const abs = path.join(uploadDir, name);
    fs.writeFileSync(abs, buf);
    saved.push(abs);
  }

  return new Response(JSON.stringify({ paths: saved }), {
    headers: { "Content-Type": "application/json" },
  });
}
