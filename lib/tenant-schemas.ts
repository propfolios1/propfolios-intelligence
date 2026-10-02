import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour, for example #0A1F44.");
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter a domain such as intelligence.yourfirm.ae.");

export const brandingInput = z.object({
  brand_name: z.string().trim().min(2).max(60),
  logo_url: z.union([z.url(), z.string().regex(/^\/api\/branding\/[0-9a-f-]{36}\/logo(\?v=\d+)?$/), z.literal("")]).nullable().optional(),
  primary_color: hex,
  accent_color: hex,
  font_display: z.enum(["Playfair Display", "Inter"]),
  custom_domain: z.union([domain, z.literal("")]).nullable().optional(),
  memo_style: z.object({ tone: z.string().trim().min(10).max(400), signoff: z.string().trim().min(3).max(120), disclaimer: z.string().trim().min(10).max(800) }).optional(),
  features: z.object({ assistant: z.boolean(), clientPortal: z.boolean(), marketTiming: z.boolean(), crossBorder: z.boolean() }).optional(),
});
export type BrandingInput = z.infer<typeof brandingInput>;

export const planInput = z.enum(["starter", "professional", "enterprise", "white_label"]);

export const provisionInput = z.object({
  name: z.string().trim().min(2).max(80),
  brand: brandingInput.partial().default({}),
  plan: planInput,
  admin: z.object({ name: z.string().trim().min(2).max(120), email: z.email() }).optional(),
  invites: z.array(z.object({ email: z.email(), role: z.enum(["tenant_admin", "analyst"]) })).max(50).default([]),
  seedDemo: z.boolean().default(true),
});
