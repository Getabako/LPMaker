import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const ROOT =
  process.env.LPMAKER_DATA_ROOT ?? path.join(os.homedir(), ".lpmaker-data");

export const paths = {
  root: ROOT,
  generated: path.join(ROOT, "generated"),
  projectDir(id: string) {
    return path.join(ROOT, "generated", id);
  },
};

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function newId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rnd}`;
}
