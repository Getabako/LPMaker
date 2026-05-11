#!/usr/bin/env node
/**
 * Codex Runner — local web UI for codex app-server.
 * Boots the bundled Next.js standalone server and opens the browser.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const PKG_ROOT = path.resolve(__dirname, "..");
const STANDALONE = path.join(PKG_ROOT, ".next", "standalone", "server.js");

function check(cmd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, ["--version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

function pickPort(start) {
  return new Promise((resolve, reject) => {
    const try1 = (p) => {
      const srv = net.createServer();
      srv.once("error", () => try1(p + 1));
      srv.listen(p, "127.0.0.1", () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    };
    try1(start);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true, shell: platform === "win32" }).unref();
}

(async () => {
  if (!(await check("codex"))) {
    console.error(
      "✗ `codex` CLI が見つかりません。先に Codex CLI をインストールしてください:\n" +
        "  brew install codex   # macOS\n" +
        "  または https://developers.openai.com/codex を参照",
    );
    process.exit(1);
  }

  if (!fs.existsSync(STANDALONE)) {
    console.error(
      `✗ ビルド成果物が見つかりません: ${STANDALONE}\n` +
        "  リポジトリ直下で `pnpm build` を実行してください。",
    );
    process.exit(1);
  }

  const port = await pickPort(Number(process.env.PORT) || 4567);
  const url = `http://localhost:${port}`;

  // Copy required static assets into standalone dir if not already
  const standaloneDir = path.dirname(STANDALONE);
  const staticSrc = path.join(PKG_ROOT, ".next", "static");
  const staticDst = path.join(standaloneDir, ".next", "static");
  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDst)) {
    fs.mkdirSync(path.dirname(staticDst), { recursive: true });
    fs.cpSync(staticSrc, staticDst, { recursive: true });
  }
  const publicSrc = path.join(PKG_ROOT, "public");
  const publicDst = path.join(standaloneDir, "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDst)) {
    fs.cpSync(publicSrc, publicDst, { recursive: true });
  }

  console.log(`▶ Codex Runner starting at ${url}`);

  const child = spawn(process.execPath, [STANDALONE], {
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: "inherit",
  });

  setTimeout(() => openBrowser(url), 800);

  const shutdown = () => {
    try {
      child.kill("SIGTERM");
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code) => process.exit(code ?? 0));
})();
