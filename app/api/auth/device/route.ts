import { getCodex } from "@/lib/codex/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const srv = await getCodex();

  const start = (await srv.send("account/login/start", {
    type: "chatgptDeviceCode",
  })) as {
    type: string;
    loginId: string;
    verificationUrl: string;
    userCode: string;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {}
      };

      send("deviceCode", start);

      const onLoginDone = (params: unknown) => send("loginCompleted", params);
      const onAccountUpdated = (params: unknown) => {
        send("accountUpdated", params);
        cleanup();
        try {
          controller.close();
        } catch {}
      };

      srv.on("notify:account/login/completed", onLoginDone);
      srv.on("notify:account/updated", onAccountUpdated);

      const cleanup = () => {
        srv.off("notify:account/login/completed", onLoginDone);
        srv.off("notify:account/updated", onAccountUpdated);
      };

      req.signal.addEventListener("abort", () => {
        srv
          .send("account/login/cancel", { loginId: start.loginId })
          .catch(() => {});
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function DELETE() {
  const srv = await getCodex();
  await srv.send("account/logout").catch(() => {});
  return Response.json({ ok: true });
}
