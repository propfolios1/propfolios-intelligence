import { getDb } from "@/db";
import { audit } from "@/lib/api";
import { createUser, deactivateUser, getUser, listUsers, patchUser, replaceUser, RESOURCE_TYPES, ScimError, serviceProviderConfig, tenantForToken } from "@/lib/enterprise/scim";

export const dynamic = "force-dynamic";

/**
 * SCIM 2.0 endpoint for identity providers: /api/scim/v2/Users,
 * /Users/{id}, /ServiceProviderConfig and /ResourceTypes. Authenticated with
 * a SCIM bearer token from Administration, SCIM; every change is audited.
 */
type Ctx = { params: Promise<{ path?: string[] }> };
const TYPE = "application/scim+json";
const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: status === 204 ? {} : { "content-type": TYPE } });

async function serve(req: Request, ctx: Ctx, run: (a: { db: Awaited<ReturnType<typeof getDb>>; tenantId: string; plan: string; actor: string; base: string; path: string[]; body: () => Promise<Record<string, unknown>> }) => Promise<Response>) {
  try {
    const db = await getDb();
    const auth = await tenantForToken(db, req.headers.get("authorization"));
    if (!auth) throw new ScimError(401, "A valid SCIM bearer token is required.");
    const url = new URL(req.url);
    const base = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? url.origin}/api/scim/v2`;
    const { path = [] } = await ctx.params;
    return await run({
      db,
      tenantId: auth.tenantId,
      plan: auth.plan,
      actor: `SCIM: ${auth.tokenName}`,
      base,
      path,
      body: async () => {
        const b = await req.json().catch(() => null);
        if (!b || typeof b !== "object") throw new ScimError(400, "The body must be a JSON object.", "invalidSyntax");
        return b as Record<string, unknown>;
      },
    });
  } catch (e) {
    if (e instanceof ScimError) return json(e.body(), e.status);
    throw e;
  }
}

const notFound = () => {
  throw new ScimError(404, "Unknown SCIM resource.");
};

export const GET = (req: Request, ctx: Ctx) =>
  serve(req, ctx, async ({ db, tenantId, base, path }) => {
    const [res, id] = path;
    if (res === "ServiceProviderConfig") return json(serviceProviderConfig(base));
    if (res === "ResourceTypes") return json(RESOURCE_TYPES(base));
    if (res !== "Users") return notFound();
    if (id) return json(await getUser(db, tenantId, base, id));
    const q = new URL(req.url).searchParams;
    return json(await listUsers(db, tenantId, base, { filter: q.get("filter"), startIndex: Number(q.get("startIndex") ?? 1) || 1, count: q.has("count") ? Number(q.get("count")) : undefined }));
  });

export const POST = (req: Request, ctx: Ctx) =>
  serve(req, ctx, async ({ db, tenantId, plan, actor, base, path, body }) => {
    if (path[0] !== "Users" || path[1]) return notFound();
    const u = await createUser(db, tenantId, plan, base, await body());
    await audit({ tenantId, name: actor }, `provisioned ${u.userName} over SCIM`, { entityType: "user", entityId: u.id, after: { email: u.userName, role: u.roles[0]?.value, active: u.active } });
    return json(u, 201);
  });

export const PUT = (req: Request, ctx: Ctx) =>
  serve(req, ctx, async ({ db, tenantId, plan, actor, base, path, body }) => {
    if (path[0] !== "Users" || !path[1]) return notFound();
    const u = await replaceUser(db, tenantId, plan, base, path[1], await body());
    await audit({ tenantId, name: actor }, `updated ${u.userName} over SCIM`, { entityType: "user", entityId: u.id, after: { role: u.roles[0]?.value, active: u.active } });
    return json(u);
  });

export const PATCH = (req: Request, ctx: Ctx) =>
  serve(req, ctx, async ({ db, tenantId, plan, actor, base, path, body }) => {
    if (path[0] !== "Users" || !path[1]) return notFound();
    const u = await patchUser(db, tenantId, plan, base, path[1], await body());
    await audit({ tenantId, name: actor }, `${u.active ? "updated" : "deactivated"} ${u.userName} over SCIM`, { entityType: "user", entityId: u.id, after: { role: u.roles[0]?.value, active: u.active } });
    return json(u);
  });

export const DELETE = (req: Request, ctx: Ctx) =>
  serve(req, ctx, async ({ db, tenantId, actor, path }) => {
    if (path[0] !== "Users" || !path[1]) return notFound();
    const u = await deactivateUser(db, tenantId, path[1]);
    await audit({ tenantId, name: actor }, `deactivated ${u.email} over SCIM`, { entityType: "user", entityId: u.id });
    return json(null, 204);
  });
