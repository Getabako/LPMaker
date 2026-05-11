import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Search order for an OPENAI_API_KEY that we can use for image generation.
 *  We never log the value, just whether one was found. */
const ENV_FILE_CANDIDATES = [
  path.join(os.homedir(), ".lpmaker-data", "openai-api-key"),
  path.join(os.homedir(), ".env"),
  path.join(os.homedir(), "Desktop/ifJukuManager/仕事管理/VoiceMemory/.env"),
  path.join(os.homedir(), "Desktop/ifJukuManager/Codex/.env"),
  path.join(os.homedir(), ".codex/.env"),
];

function readKeyFromFile(file: string): string | null {
  try {
    const txt = fs.readFileSync(file, "utf8");
    // If file looks like a raw key, return it
    const trimmed = txt.trim();
    if (trimmed.startsWith("sk-")) return trimmed;
    // Otherwise parse .env style
    for (const line of trimmed.split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) {
        return m[1].replace(/^['"]|['"]$/g, "").trim();
      }
    }
  } catch {}
  return null;
}

export function findOpenAIKey(): { key: string | null; source: string | null } {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return { key: process.env.OPENAI_API_KEY.trim(), source: "env:OPENAI_API_KEY" };
  }
  for (const f of ENV_FILE_CANDIDATES) {
    const k = readKeyFromFile(f);
    if (k) return { key: k, source: f };
  }
  // ~/.codex/auth.json (typically null for ChatGPT users, but try)
  try {
    const authPath = path.join(os.homedir(), ".codex/auth.json");
    const j = JSON.parse(fs.readFileSync(authPath, "utf8"));
    if (typeof j.OPENAI_API_KEY === "string" && j.OPENAI_API_KEY.trim()) {
      return { key: j.OPENAI_API_KEY.trim(), source: "~/.codex/auth.json" };
    }
  } catch {}
  return { key: null, source: null };
}
