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
      const closeStream = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      send("init", {
        id,
        projectDir,
        willGenerateImages: brief.generateImages,
      });

      let threadId: string | null = null;
      let turnId: string | null = null;
      let turnDone = false;
      const startedAt = Date.now();

      // ハートビート（黙りこむのを防ぐ）
      const heartbeat = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        send("heartbeat", { elapsedSec: sec });
      }, 3000);

      const onStderr = (text: string) => {
        const t = text.trim();
        if (t) send("stderr", { text: t.slice(0, 500) });
      };
      srv.on("stderr", onStderr);

      const onNotif = (notif: any) => {
        const { method, params } = notif;
        if (!params) return;

        // すべてのイベントを生で送るのは多すぎるので、見せたいものだけ整形
        switch (method) {
          case "thread/started":
            threadId = params.thread?.id;
            send("step", { kind: "thread", text: `🧵 thread: ${threadId}` });
            return;
          case "turn/started":
            send("step", { kind: "turn", text: `▶ turn 開始` });
            return;
          case "thread/status/changed":
            if (params.status?.type) {
              send("step", {
                kind: params.status.type === "systemError" ? "error" : "status",
                text: `status: ${params.status.type}${
                  params.status.activeFlags?.length
                    ? " " + params.status.activeFlags.join(",")
                    : ""
                }`,
              });
              if (params.status.type === "systemError") {
                // turn/completed が来なくても抜ける
                turnDone = true;
              }
            }
            return;
          case "turn/plan/updated": {
            const plan = (params.plan ?? []) as Array<{
              step: string;
              status: string;
            }>;
            const summary = plan
              .map((p) => `${p.status === "completed" ? "✓" : p.status === "inProgress" ? "▸" : "·"} ${p.step}`)
              .join(" / ");
            if (summary) send("step", { kind: "plan", text: `📋 ${summary}` });
            return;
          }
          case "thread/tokenUsage/updated":
            // 騒がしいので 30 秒ごとに送る
            return;
          case "item/started": {
            const item = params.item;
            if (!item) return;
            if (item.type === "agentMessage") return; // delta で流れる
            if (item.type === "reasoning") {
              send("step", { kind: "reasoning", text: "🧠 思考中…" });
            } else if (item.type === "commandExecution") {
              const cmd = Array.isArray(item.command)
                ? item.command.join(" ")
                : String(item.command ?? "");
              send("step", { kind: "command", text: `$ ${cmd.slice(0, 200)}` });
            } else if (item.type === "fileChange") {
              const files = (item.changes || []).map((c: any) => c.path).join(", ");
              send("step", { kind: "file", text: `📄 編集: ${files}` });
            } else if (item.type === "webSearch") {
              send("step", { kind: "web", text: `🔎 web search: ${item.query ?? ""}` });
            } else if (item.type === "mcpToolCall") {
              send("step", { kind: "tool", text: `🛠 ${item.server}/${item.tool}` });
            } else if (item.type === "dynamicToolCall") {
              send("step", { kind: "tool", text: `🛠 ${item.tool}` });
            } else {
              send("step", { kind: "info", text: `▸ ${item.type}` });
            }
            return;
          }
          case "item/agentMessage/delta":
            send("delta", { text: params.delta ?? "" });
            return;
          case "item/reasoning/summaryTextDelta":
            // 思考の要約は少しずつ見せる
            send("reasoning_delta", { text: params.delta ?? "" });
            return;
          case "item/commandExecution/outputDelta":
            send("cmd_output", { text: String(params.chunk ?? params.output ?? "").slice(0, 200) });
            return;
          case "item/completed": {
            const item = params.item;
            if (!item) return;
            if (item.type === "agentMessage" && item.text) {
              send("agent", { text: item.text });
            } else if (item.type === "commandExecution") {
              send("step", {
                kind: item.exitCode === 0 ? "command-ok" : "command-err",
                text: `↳ exit ${item.exitCode}`,
              });
            } else if (item.type === "fileChange") {
              const files = (item.changes || []).map((c: any) => c.path).join(", ");
              send("step", { kind: "file-ok", text: `✓ 書き込み完了: ${files}` });
            }
            return;
          }
          case "turn/completed":
            turnDone = true;
            return;
        }
      };

      srv.on("notification", onNotif);

      const cleanup = () => {
        clearInterval(heartbeat);
        srv.off("notification", onNotif);
        srv.off("stderr", onStderr);
      };

      req.signal.addEventListener("abort", () => {
        if (threadId && turnId) {
          srv.send("turn/interrupt", { threadId, turnId }).catch(() => {});
        }
        cleanup();
        closeStream();
      });

      try {
        const model = process.env.LPMAKER_MODEL || "gpt-5.5";
        send("step", { kind: "info", text: `thread/start を送信 (model=${model})` });
        const started: any = await srv.send("thread/start", {
          cwd: projectDir,
          model,
          effort: "high",
          sandbox: "workspace-write",
          approvalPolicy: "never",
          serviceName: "lpmaker",
        });
        threadId = started.thread.id;

        send("step", { kind: "info", text: "turn/start を送信" });
        const turn: any = await srv.send("turn/start", {
          threadId,
          input: [{ type: "text", text: prompt }],
          cwd: projectDir,
          model,
          effort: "high",
          sandboxPolicy: {
            type: "workspaceWrite",
            writableRoots: [projectDir],
            networkAccess: true,
          },
          approvalPolicy: "never",
        });
        turnId = turn.turn.id;
        send("step", { kind: "turn", text: `▶ turn: ${turnId}` });

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
          send("error", { message: "index.html が生成されませんでした（Codex の出力を確認してください）" });
          cleanup();
          closeStream();
          return;
        }

        const imagesDir = path.join(projectDir, "images");
        const imageCount = fs.existsSync(imagesDir)
          ? fs.readdirSync(imagesDir).filter((f) =>
              /\.(png|jpe?g|webp|gif|svg)$/i.test(f),
            ).length
          : 0;
        send("step", {
          kind: "done",
          text: `🎉 完成: index.html ${(fs.statSync(indexPath).size / 1024).toFixed(1)} KB, 画像 ${imageCount} 点`,
        });
        send("done", { id, previewUrl: `/api/preview/${id}/index.html` });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        cleanup();
        closeStream();
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
