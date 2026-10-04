import { z } from "zod";

const url = z.string().trim().url().max(500).nullable().optional();

export const ssoBody = z.object({
  protocol: z.enum(["saml", "oidc"]),
  provider: z.enum(["okta", "entra_id", "google_workspace", "onelogin", "jumpcloud", "custom"]),
  metadataXml: z.string().max(200_000).nullable().optional(),
  idpMetadataUrl: url,
  idpEntityId: z.string().trim().max(500).nullable().optional(),
  idpSsoUrl: url,
  idpCertificate: z.string().max(20_000).nullable().optional(),
  oidcIssuer: url,
  oidcClientId: z.string().trim().max(300).nullable().optional(),
  oidcClientSecret: z.string().max(500).nullable().optional(),
  domains: z.array(z.string().max(253)).max(20),
  enforce: z.boolean(),
  jitProvisioning: z.boolean(),
  defaultRole: z.enum(["analyst", "tenant_admin"]),
});

export const roleBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  baseRole: z.enum(["tenant_admin", "analyst", "client"]),
  permissions: z.array(z.string().max(60)).max(80),
  scimGroups: z.array(z.string().max(120)).max(20).default([]),
  copyFrom: z.string().max(40).nullable().optional(),
});

export const apiKeyBody = z.object({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(z.enum(["mcp", "leads:write"])).min(1).default(["mcp", "leads:write"]),
  rateLimitPerMinute: z.number().int().min(1).max(6000).default(60),
  expiresInDays: z.number().int().min(1).max(730).nullable().default(null),
});

export const apiKeyPatch = z.object({ scopes: z.array(z.enum(["mcp", "leads:write"])).min(1).optional(), rateLimitPerMinute: z.number().int().min(1).max(6000).optional() });

export const auditExportQuery = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  format: z.enum(["csv", "jsonl"]).default("csv"),
  actorType: z.enum(["user", "agent", "system"]).nullable().optional(),
  entityType: z.string().max(60).nullable().optional(),
});
