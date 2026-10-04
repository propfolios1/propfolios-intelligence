import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { z } from "zod";
import { getDb } from "@/db";
import { keyErrorResponse, presentsBearer, userFromApiKey } from "@/lib/api-keys";
import { HttpError, requireApiUser, type CurrentUser } from "@/lib/auth";
import { callTool, MCP_TOOLS, TOOL_NAMES } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function caller(req: Request): Promise<(CurrentUser & { apiKey?: boolean }) | null> {
  const keyUser = await userFromApiKey(req, { scope: "mcp", route: "mcp" });
  if (keyUser) return keyUser;
  if (presentsBearer(req)) return null;
  try {
    return await requireApiUser(["tenant_admin", "analyst"]);
  } catch {
    return null;
  }
}

/**
 * Model Context Protocol server (Streamable HTTP, stateless). Authenticate
 * with "Authorization: Bearer nk_live_…" (Administration → Integrations) or
 * a signed-in staff session. Tools act inside the key's tenant only.
 */
async function serve(req: Request) {
  let user: Awaited<ReturnType<typeof caller>>;
  try {
    user = await caller(req);
  } catch (e) {
    const res = keyErrorResponse(e);
    if (res) return res;
    throw e;
  }
  if (!user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorised. Send Authorization: Bearer <Nakhla API key>." }, id: null },
      { status: 401, headers: { "www-authenticate": 'Bearer realm="nakhla-mcp"' } },
    );
  }
  const db = await getDb();
  const server = new McpServer({ name: "nakhla", version: "1.0.0" }, { instructions: "Nakhla: AI operating system for real estate advisory. Tools act within one advisory firm's workspace (UAE and India real estate)." });
  for (const name of TOOL_NAMES) {
    const tool = MCP_TOOLS[name] as { title: string; description: string; input: z.ZodObject };
    server.registerTool(name, { title: tool.title, description: tool.description, inputSchema: tool.input.shape }, async (args: unknown) => {
      try {
        const result = await callTool({ db, user }, name, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        const message = e instanceof HttpError ? e.message : (e as Error).message;
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
