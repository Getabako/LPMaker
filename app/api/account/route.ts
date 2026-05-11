import { getCodex } from "@/lib/codex/client";

export const runtime = "nodejs";

export async function GET() {
  const srv = await getCodex();
  const result = await srv.send("account/read", { refreshToken: false });
  return Response.json(result);
}
