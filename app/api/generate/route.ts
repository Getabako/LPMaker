import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { getCodex } from "@/lib/codex/client";
import { paths, ensureDir, newId } from "@/lib/paths";
import { buildCodexPrompt, LpBrief } from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { brief: LpBrief };

export async function POST(req: NextRequest) {
  const { brief } = (await req.json()) as Body;
  if (!brief || !brief.brand?.trim()) {
    return new Response("brief.brand required", { status: 400 });
  }

  const id = newId();
  const projectDir = paths.projectDir(id);
  ensureDir(projectDir);

  const prompt = buildCodexPrompt(brief);
  const srv = await getCodex();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {}
      };

      send("init", { id, projectDir });

      let threadId: string | null = null;
      let turnId: string | null = null;
      let turnDone = false;

      const onNotif = (notif: any) => {
        const { method, params } = notif;
        if (!params) return;

        if (method === "thread/started") {
          threadId = params.thread?.id;
          send("phase", { message: "Codex が制作を開始しました" });
          return;
        }
        if (method === "item/started") {
          const item = params.item;
          if (!item) return;
          if (item.type === "agentMessage") {
            // delta が流れてくる
          } else if (item.type === "commandExecution") {
            const cmd = Array.isArray(item.command)
              ? item.command.join(" ")
              : String(item.command ?? "");
            send("step", { kind: "command", text: `$ ${cmd.slice(0, 200)}` });
          } else if (item.type === "fileChange") {
            const files = (item.changes || []).map((c: any) => c.path).join(", ");
            send("step", { kind: "file", text: `📄 ${files}` });
          } else if (item.type === "reasoning") {
            // 騒がしいのでスキップ
          } else {
            send("step", { kind: "info", text: `▸ ${item.type}` });
          }
          return;
        }
        if (method === "item/agentMessage/delta") {
          send("delta", { text: params.delta ?? "" });
          return;
        }
        if (method === "item/completed") {
          const item = params.item;
          if (item?.type === "agentMessage" && item.text) {
            send("agent", { text: item.text });
          } else if (item?.type === "commandExecution") {
            send("step", {
              kind: item.exitCode === 0 ? "command-ok" : "command-err",
              text: `↳ exit ${item.exitCode}`,
            });
          }
          return;
        }
        if (method === "turn/completed") {
          turnDone = true;
        }
      };

      srv.on("notification", onNotif);
      const cleanup = () => srv.off("notification", onNotif);

      req.signal.addEventListener("abort", () => {
        if (threadId && turnId) {
          srv.send("turn/interrupt", { threadId, turnId }).catch(() => {});
        }
        cleanup();
        try { controller.close(); } catch {}
      });

      try {
        const started: any = await srv.send("thread/start", {
          cwd: projectDir,
          sandbox: "workspace-write",
          approvalPolicy: "never",
          serviceName: "lpmaker",
        });
        threadId = started.thread.id;

        const turn: any = await srv.send("turn/start", {
          threadId,
          input: [{ type: "text", text: prompt }],
          cwd: projectDir,
          sandboxPolicy: {
            type: "workspace-write",
            writableRoots: [projectDir],
            networkAccess: true,
          },
          approvalPolicy: "never",
        });
        turnId = turn.turn.id;
        send("turn_started", { threadId, turnId });

        await new Promise<void>((resolve) => {
          const tick = setInterval(() => {
            if (turnDone) {
              clearInterval(tick);
              resolve();
            }
          }, 200);
          req.signal.addEventListener("abort", () => {
            clearInterval(tick);
            resolve();
          });
        });

        const indexPath = path.join(projectDir, "index.html");
        if (!fs.existsSync(indexPath)) {
          send("error", { message: "index.html が生成されませんでした" });
          cleanup();
          try { controller.close(); } catch {}
          return;
        }

        // 画像枚数のレポート
        const imagesDir = path.join(projectDir, "images");
        const imageCount = fs.existsSync(imagesDir)
          ? fs.readdirSync(imagesDir).filter((f) =>
              /\.(png|jpe?g|webp|gif|svg)$/i.test(f),
            ).length
          : 0;
        send("phase", {
          message: `✅ 完成（画像 ${imageCount} 点）`,
        });

        send("done", { id, previewUrl: `/api/preview/${id}/index.html` });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        cleanup();
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
