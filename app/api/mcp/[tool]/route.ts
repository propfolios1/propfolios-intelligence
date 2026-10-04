import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { presentsBearer, userFromApiKey } from "@/lib/api-keys";
import { HttpError, requireApiUser } from "@/lib/auth";
import { callTool, MCP_TOOLS } from "@/lib/mcp/tools";

export const maxDuration = 300;

type Ctx = { params: Promise<{ tool: string }> };

async function caller(req: Request) {
  const keyUser = await userFromApiKey(req, { scope: "mcp", route: `mcp/${new URL(req.url).pathname.split("/").pop()?.slice(0, 40) ?? "tool"}` });
  if (keyUser) return keyUser;
  if (presentsBearer(req)) throw new HttpError(401, "Invalid or revoked API key.");
  return requireApiUser(["tenant_admin", "analyst"]);
}

/** Tool descriptor: name, description and JSON Schema of its arguments. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  await caller(req);
  const { tool } = await params;
  const t = (MCP_TOOLS as Record<string, { title: string; description: string; input: z.ZodObject }>)[tool];
  if (!t) throw new HttpError(404, `Unknown tool "${tool}".`);
  return NextResponse.json({ name: tool, title: t.title, description: t.description, inputSchema: z.toJSONSchema(t.input) });
});

/** REST mirror of the MCP tools: POST the arguments as JSON, receive the result. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await caller(req);
  const { tool } = await params;
  const args = await req.json().catch(() => ({}));
  return NextResponse.json({ tool, result: await callTool({ db: await getDb(), user }, tool, args) });
});
