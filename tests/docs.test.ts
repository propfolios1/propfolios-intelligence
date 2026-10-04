import { describe, expect, it } from "vitest";
import { DOCS, docBySlug } from "@/lib/docs/content";
import { openApiDocument } from "@/lib/docs/openapi";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/service";

describe("documentation", () => {
  it("has unique slugs and the pages other parts of the product link to", () => {
    expect(new Set(DOCS.map((d) => d.slug)).size).toBe(DOCS.length);
    for (const s of ["getting-started", "migration", "portals", "api/authentication", "mcp", "webhooks", "compliance", "enterprise/scim"]) expect(docBySlug(s), s).not.toBeNull();
    for (const d of DOCS) for (const b of d.blocks) if ("p" in b) expect(b.p).not.toMatch(/!|revolutionary|cutting-edge|seamless|next-generation/i);
  });
  it("names the right authority for each AML regime", () => {
    const table = docBySlug("compliance")!.blocks.find((b) => "table" in b) as { table: { rows: string[][] } };
    const rows = Object.fromEntries(table.table.rows.map((r) => [r[0], r]));
    expect(rows["India"]![1]).toMatch(/FIU-IND/);
    expect(rows["United Kingdom"]![2]).toMatch(/National Crime Agency/);
    expect(rows["Singapore"]![2]).toMatch(/STRO/);
  });
});

describe("OpenAPI description", () => {
  const doc = openApiDocument("https://app.example.com/");
  it("is OpenAPI 3.1 with every MCP tool, SCIM and the lead endpoint", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]!.url).toBe("https://app.example.com");
    const paths = Object.keys(doc.paths);
    for (const t of Object.keys(MCP_TOOLS)) expect(paths).toContain(`/api/mcp/${t}`);
    expect(paths).toEqual(expect.arrayContaining(["/api/leads/inbound/{source}", "/api/scim/v2/Users", "/api/scim/v2/Users/{id}", "/api/stats"]));
    expect(Object.keys(doc.webhooks).sort()).toEqual(Object.keys(WEBHOOK_EVENTS).sort());
  });
  it("has unique operation IDs and resolvable references", () => {
    const ids: string[] = [];
    for (const item of Object.values(doc.paths as Record<string, Record<string, { operationId?: string }>>)) for (const [m, op] of Object.entries(item)) if (m !== "parameters") ids.push(op.operationId!);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/(\w+)/g) ?? [];
    for (const r of refs) expect(doc.components.schemas).toHaveProperty(r.split("/").pop()!);
    const body = (doc.paths as unknown as Record<string, { post: { requestBody: { content: Record<string, { schema: Record<string, unknown> }> } } }>)["/api/mcp/list_properties"]!.post.requestBody.content["application/json"]!.schema;
    expect(body.type).toBe("object");
    expect(body).not.toHaveProperty("$schema");
  });
});
