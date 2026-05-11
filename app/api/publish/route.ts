import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { NextRequest } from "next/server";
import { paths } from "@/lib/paths";
import { slugifyBrand } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id: string; repoName?: string };

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (c) => (stdout += c.toString()));
    p.stderr.on("data", (c) => (stderr += c.toString()));
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    p.on("error", (err) =>
      resolve({ code: -1, stdout, stderr: stderr + (err as Error).message }),
    );
  });
}

export async function POST(req: NextRequest) {
  const { id, repoName: rawName } = (await req.json()) as Body;
  if (!id || !/^[\w-]+$/.test(id)) {
    return new Response("bad id", { status: 400 });
  }
  const projectDir = paths.projectDir(id);
  if (!fs.existsSync(path.join(projectDir, "index.html"))) {
    return new Response("index.html not found in project", { status: 404 });
  }

  // Derive repo name from brief if not given
  let repoName = rawName?.trim();
  if (!repoName) {
    try {
      const brief = JSON.parse(
        fs.readFileSync(path.join(projectDir, "_brief.json"), "utf8"),
      ) as { brand?: string };
      repoName = slugifyBrand(brief.brand ?? "", id);
    } catch {
      repoName = slugifyBrand("", id);
    }
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(repoName)) {
    return new Response("repoName has invalid characters", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {}
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      const fail = (msg: string) => {
        send("error", { message: msg });
        close();
      };

      // 1. gh CLI 存在チェック
      send("step", { text: "🔧 gh CLI を確認中…" });
      const ghCheck = spawnSync("gh", ["--version"], { stdio: "ignore" });
      if (ghCheck.status !== 0) {
        fail(
          "gh コマンドが見つかりません。https://cli.github.com/ からインストール後、`gh auth login` してください。",
        );
        return;
      }

      // 2. gh auth status
      const auth = await runCommand("gh", ["auth", "status"], projectDir);
      if (auth.code !== 0) {
        fail(
          "GitHub に未ログインです。ターミナルで `gh auth login` を 1 回実行してから再試行してください。",
        );
        return;
      }
      send("step", { text: "✓ gh 認証 OK" });

      // 3. owner を取得
      const userRes = await runCommand("gh", ["api", "user", "--jq", ".login"], projectDir);
      if (userRes.code !== 0) {
        fail(`gh api user 失敗: ${userRes.stderr.slice(0, 300)}`);
        return;
      }
      const owner = userRes.stdout.trim();
      send("step", { text: `✓ owner: ${owner}` });

      const fullRepo = `${owner}/${repoName}`;

      // 4. リポジトリ衝突チェック
      const exists = await runCommand("gh", ["repo", "view", fullRepo, "--json", "name"], projectDir);
      if (exists.code === 0) {
        fail(`リポジトリ ${fullRepo} はすでに存在します。別の名前を指定するか、UI で名前を変えてください。`);
        return;
      }

      // 5. git init / add / commit
      send("step", { text: "📦 git init + commit…" });
      // Clean any stale .git
      const gitDir = path.join(projectDir, ".git");
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
      const steps: Array<{ desc: string; cmd: string; args: string[] }> = [
        { desc: "git init", cmd: "git", args: ["init", "-b", "main"] },
        { desc: "git add", cmd: "git", args: ["add", "index.html", "images"] },
        {
          desc: "git commit",
          cmd: "git",
          args: ["-c", "user.name=LP Maker", "-c", "user.email=lpmaker@local", "commit", "-m", `Initial LP: ${repoName}`],
        },
      ];
      for (const s of steps) {
        const r = await runCommand(s.cmd, s.args, projectDir);
        if (r.code !== 0 && !(s.desc === "git add" && r.code === 0)) {
          // commit can succeed with warnings; check actual fail
          if (r.code !== 0) {
            // git add 単体は images が無くてもエラーにならないはず。
            // commit 失敗のみ致命
            if (s.desc === "git commit") {
              fail(`${s.desc} 失敗: ${r.stderr.slice(0, 300)}`);
              return;
            }
          }
        }
      }
      send("step", { text: "✓ ローカルコミット完了" });

      // 6. gh repo create + push
      send("step", { text: `🚀 GitHub にリポジトリ作成中: ${fullRepo}` });
      const create = await runCommand(
        "gh",
        ["repo", "create", repoName, "--public", "--source", ".", "--push", "--description", "Generated by LP Maker"],
        projectDir,
      );
      if (create.code !== 0) {
        fail(`gh repo create 失敗: ${create.stderr.slice(0, 500)}`);
        return;
      }
      send("step", { text: `✓ push 完了: https://github.com/${fullRepo}` });

      // 7. Pages を有効化
      send("step", { text: "🌐 GitHub Pages を有効化中…" });
      const pagesPayload = JSON.stringify({
        source: { branch: "main", path: "/" },
      });
      const pages = await new Promise<{ code: number; stdout: string; stderr: string }>(
        (resolve) => {
          const p = spawn(
            "gh",
            ["api", "-X", "POST", `repos/${fullRepo}/pages`, "--input", "-"],
            { cwd: projectDir, stdio: ["pipe", "pipe", "pipe"] },
          );
          let stdout = "";
          let stderr = "";
          p.stdout.on("data", (c) => (stdout += c.toString()));
          p.stderr.on("data", (c) => (stderr += c.toString()));
          p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
          p.stdin.end(pagesPayload);
        },
      );
      const pagesUrl = `https://${owner}.github.io/${repoName}/`;
      if (pages.code !== 0) {
        // 既に Pages 有効でも 409 が返るのでそれは無視。
        const txt = (pages.stdout + pages.stderr).toLowerCase();
        if (txt.includes("already") || txt.includes("409")) {
          send("step", { text: "・Pages は既に有効でした" });
        } else {
          send("step", { text: `⚠ Pages 有効化失敗: ${(pages.stderr || pages.stdout).slice(0, 300)}（手動で Settings → Pages から有効化してください）` });
        }
      } else {
        send("step", { text: "✓ Pages 有効化完了" });
      }

      send("done", {
        repo: `https://github.com/${fullRepo}`,
        pagesUrl,
        note: "Pages の公開には 1〜2 分かかります。すぐに開いても 404 が出る場合があります。",
      });
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
