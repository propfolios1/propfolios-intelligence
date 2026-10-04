import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { moderate, sandboxStore, view } from "@/lib/portals/sandbox";

type Ctx = { params: Promise<{ portal: string; path?: string[] }> };

function key(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-api-key") ?? "";
  return auth.length >= 8 ? auth : null;
}

async function handler(req: Request, { params }: Ctx) {
  const { portal, path = [] } = await params;
  if (path[0] === "oauth" && path[1] === "token") return NextResponse.json({ access_token: `sandbox_${randomUUID()}`, expires_in: 3600 });
  const k = key(req);
  if (!k) return NextResponse.json({ message: "Missing or short API key." }, { status: 401 });
  // OAuth sandbox tokens rotate; their listings share one store per portal.
  const store = sandboxStore(portal, k.startsWith("sandbox_") ? "oauth" : k);
  if (path[0] !== "listings") return NextResponse.json({ message: "Not found." }, { status: 404 });
  const id = path[1];
  if (req.method === "GET" && !id) return NextResponse.json({ data: [...store.values()].map(view) });
  if (req.method === "POST" && !id) {
    const payload = (await req.json()) as Record<string, unknown>;
    const reason = moderate(portal, payload);
    if (reason) return NextResponse.json({ message: reason }, { status: 422 });
    const e = { id: `SBX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, payload, status: "pending_review" as const, reason: null, created: Date.now() };
    store.set(e.id, e);
    return NextResponse.json(view(e), { status: 201 });
  }
  const e = id ? store.get(id) : undefined;
  if (!e) return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  if (req.method === "GET") return NextResponse.json(view(e));
  if (req.method === "PUT") {
    const payload = (await req.json()) as Record<string, unknown>;
    const reason = moderate(portal, payload);
    if (reason) return NextResponse.json({ message: reason }, { status: 422 });
    e.payload = payload;
    return NextResponse.json(view(e));
  }
  if (req.method === "DELETE") {
    store.delete(e.id);
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
