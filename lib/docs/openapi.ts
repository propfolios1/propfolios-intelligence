import { z } from "zod";
import { LEAD_SOURCES } from "@/lib/markets";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/service";

/**
 * The OpenAPI 3.1 description of Nakhla's public interfaces, generated from
 * the same definitions the handlers use: MCP tool inputs come from their Zod
 * schemas, lead sources from the market registry, webhook events from the
 * webhook service. Served at /api/openapi.json and rendered at /docs/api.
 */

type Json = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const err = { description: "Error", content: { "application/json": { schema: ref("Error") } } };

export function openApiDocument(baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nakhla.ai") {
  const tools = MCP_TOOLS as Record<string, { title: string; description: string; input: z.ZodObject }>;
  const toolPaths: Json = {};
  for (const [name, t] of Object.entries(tools)) {
    const { $schema: _omit, ...schema } = z.toJSONSchema(t.input) as Json;
    void _omit;
    toolPaths[`/api/mcp/${name}`] = {
      post: {
        operationId: `mcp_${name}`,
        tags: ["MCP tools"],
        summary: t.title,
        description: `${t.description} Requires the mcp scope.`,
        security: [{ apiKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema } } },
        responses: { "200": { description: "The tool's result.", content: { "application/json": { schema: { type: "object" } } } }, "401": err, "403": err, "422": err, "429": { ...err, headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds until the key's window resets." } } } },
      },
    };
  }
  const webhooks: Json = {};
  for (const [event, description] of Object.entries(WEBHOOK_EVENTS)) {
    webhooks[event] = {
      post: {
        summary: description,
        description: "Sent to every endpoint subscribed to this event. Verify the Nakhla-Signature header before trusting the body.",
        parameters: [
          { name: "Nakhla-Signature", in: "header", required: true, schema: { type: "string", example: "t=1790000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd" } },
          { name: "Nakhla-Event", in: "header", required: true, schema: { type: "string", const: event } },
          { name: "Nakhla-Delivery", in: "header", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: { content: { "application/json": { schema: { allOf: [ref("WebhookEvent"), { properties: { type: { const: event } } }] } } } },
        responses: { "2XX": { description: "Received. Any other status, or no answer within ten seconds, is retried." } },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Nakhla API",
      version: "2026-10-01",
      description: "Programmatic access to a brokerage's Nakhla workspace: inbound leads, the MCP tools, SCIM provisioning and webhooks. Every call acts inside one firm's workspace and is recorded in its audit log.",
      contact: { name: "Nakhla developer support", email: "developers@nakhla.ai" },
    },
    servers: [{ url: baseUrl.replace(/\/$/, "") }],
    tags: [
      { name: "Leads", description: "Post enquiries from portals, websites and forms." },
      { name: "MCP tools", description: "The Model Context Protocol tools, also callable over plain HTTP." },
      { name: "SCIM", description: "User provisioning for identity providers (RFC 7643, 7644)." },
      { name: "Platform", description: "Public platform information." },
    ],
    components: {
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer", bearerFormat: "nk_live_…", description: "An API key from Administration, API. Keys carry scopes and a per-minute limit." },
        scimToken: { type: "http", scheme: "bearer", bearerFormat: "nk_scim_…", description: "A SCIM token from Administration, SCIM provisioning." },
      },
      schemas: {
        Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
        InboundLead: {
          type: "object",
          description: "Field names are matched loosely: the common spellings each portal uses are accepted (for example full_name, first_name and last_name, or contact_email).",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string", description: "International format preferred, for example +971501234567." },
            message: { type: "string" },
            listing_reference: { type: "string", description: "The firm's listing reference; the lead is linked to that listing." },
            budget: { type: "number", description: "Maximum budget in the market's currency." },
            intent: { type: "string", description: "Words such as rent, let or lease mark a tenant; anything else is a buyer." },
            lead_id: { type: "string", description: "The portal's own enquiry ID, kept for de-duplication." },
          },
          anyOf: [{ required: ["email"] }, { required: ["phone"] }],
        },
        CreatedLead: { type: "object", properties: { id: { type: "string", format: "uuid" }, reference: { type: "string", example: "LD-0412" }, matchedListing: { type: "boolean" } } },
        ScimUser: {
          type: "object",
          properties: {
            schemas: { type: "array", items: { type: "string" } },
            id: { type: "string", format: "uuid" },
            externalId: { type: "string" },
            userName: { type: "string", format: "email" },
            name: { type: "object", properties: { givenName: { type: "string" }, familyName: { type: "string" }, formatted: { type: "string" } } },
            title: { type: "string" },
            active: { type: "boolean" },
            roles: { type: "array", items: { type: "object", properties: { value: { type: "string", description: "tenant_admin, analyst or a custom role key." } } } },
          },
        },
        WebhookEvent: {
          type: "object",
          required: ["id", "type", "created", "tenant_id", "data"],
          properties: { id: { type: "string", example: "evt_3f2a9c0d1e4b5a6c7d8e9f00" }, type: { type: "string" }, created: { type: "string", format: "date-time" }, tenant_id: { type: "string", format: "uuid" }, data: { type: "object" } },
        },
      },
    },
    paths: {
      "/api/leads/inbound/{source}": {
        post: {
          operationId: "createInboundLead",
          tags: ["Leads"],
          summary: "Post an enquiry",
          description: "Creates a lead, links it to the listing by reference, assigns and scores it, and starts the AI lead response. Requires the leads:write scope.",
          security: [{ apiKey: [] }],
          parameters: [{ name: "source", in: "path", required: true, schema: { type: "string", enum: LEAD_SOURCES.map((s) => s.key) }, description: "Where the enquiry came from: a portal key or a direct source." }],
          requestBody: { required: true, content: { "application/json": { schema: ref("InboundLead") } } },
          responses: { "201": { description: "Created.", content: { "application/json": { schema: ref("CreatedLead") } } }, "401": err, "403": err, "404": err, "422": err, "429": err },
        },
      },
      "/api/mcp": {
        post: {
          operationId: "mcpStreamableHttp",
          tags: ["MCP tools"],
          summary: "Model Context Protocol endpoint",
          description: "Streamable HTTP transport (stateless). Send JSON-RPC 2.0 requests such as initialize, tools/list and tools/call. Requires the mcp scope.",
          security: [{ apiKey: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["jsonrpc", "method"], properties: { jsonrpc: { const: "2.0" }, id: { type: ["string", "integer"] }, method: { type: "string" }, params: { type: "object" } } } } } },
          responses: { "200": { description: "JSON-RPC response, or an event stream when the client accepts text/event-stream." }, "401": err, "429": err },
        },
      },
      ...toolPaths,
      "/api/scim/v2/Users": {
        get: { operationId: "scimListUsers", tags: ["SCIM"], summary: "List or find users", security: [{ scimToken: [] }], parameters: [{ name: "filter", in: "query", schema: { type: "string", example: 'userName eq "aisha@yourfirm.ae"' } }, { name: "startIndex", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "count", in: "query", schema: { type: "integer", maximum: 200 } }], responses: { "200": { description: "A SCIM ListResponse." }, "400": err, "401": err } },
        post: { operationId: "scimCreateUser", tags: ["SCIM"], summary: "Provision a user", security: [{ scimToken: [] }], requestBody: { content: { "application/scim+json": { schema: ref("ScimUser") } } }, responses: { "201": { description: "Created.", content: { "application/scim+json": { schema: ref("ScimUser") } } }, "403": { description: "No seat available on the plan." }, "409": { description: "The userName already exists." } } },
      },
      "/api/scim/v2/Users/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { operationId: "scimGetUser", tags: ["SCIM"], summary: "Read a user", security: [{ scimToken: [] }], responses: { "200": { description: "The user.", content: { "application/scim+json": { schema: ref("ScimUser") } } }, "404": { description: "Not found." } } },
        put: { operationId: "scimReplaceUser", tags: ["SCIM"], summary: "Replace a user", security: [{ scimToken: [] }], requestBody: { content: { "application/scim+json": { schema: ref("ScimUser") } } }, responses: { "200": { description: "Updated." } } },
        patch: { operationId: "scimPatchUser", tags: ["SCIM"], summary: "Update a user (PatchOp)", description: "replace and add operations on active, name, title, externalId, userName and roles.", security: [{ scimToken: [] }], responses: { "200": { description: "Updated." } } },
        delete: { operationId: "scimDeleteUser", tags: ["SCIM"], summary: "Deactivate a user", description: "The account can no longer sign in; its history is kept.", security: [{ scimToken: [] }], responses: { "204": { description: "Deactivated." } } },
      },
      "/api/scim/v2/ServiceProviderConfig": { get: { operationId: "scimConfig", tags: ["SCIM"], summary: "Supported SCIM features", security: [{ scimToken: [] }], responses: { "200": { description: "ServiceProviderConfig." } } } },
      "/api/stats": { get: { operationId: "platformStats", tags: ["Platform"], summary: "Row-level security coverage", description: "Counts read from the live database catalogue.", responses: { "200": { description: "Statistics.", content: { "application/json": { schema: { type: "object", properties: { rlsPolicies: { type: "integer" }, rlsTables: { type: "integer" }, publicTables: { type: "integer" }, generatedAt: { type: "string", format: "date-time" } } } } } } } } },
    },
    webhooks,
  };
}
