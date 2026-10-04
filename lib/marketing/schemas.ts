import { z } from "zod";
import { SOCIAL_NETWORKS } from "@/db/schema-production";

export const audienceFilterSchema = z.object({
  intents: z.array(z.enum(["buy", "rent", "sell", "let", "invest"])).optional(),
  stages: z.array(z.enum(["new", "contacted", "qualified", "viewing", "offer"])).optional(),
  sources: z.array(z.string().max(40)).max(20).optional(),
  markets: z.array(z.string().length(2)).max(6).optional(),
  locations: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
  scoreMin: z.number().int().min(0).max(100).nullable().optional(),
  budgetMin: z.number().min(0).nullable().optional(),
  budgetMax: z.number().min(0).nullable().optional(),
  createdWithinDays: z.number().int().min(1).max(3650).nullable().optional(),
  noContactForDays: z.number().int().min(1).max(3650).nullable().optional(),
  require: z.array(z.enum(["email", "phone"])).optional(),
});

export const stepSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  delayHours: z.number().int().min(0).max(24 * 90),
  subject: z.string().trim().max(150).nullable().optional(),
  body: z.string().max(10_000).default(""),
  whatsappTemplateId: z.string().uuid().nullable().optional(),
  whatsappVariables: z.array(z.string().max(200)).max(10).optional(),
  stopOnReply: z.boolean().optional(),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(3).max(120),
  kind: z.enum(["one_off", "sequence", "auto_promote"]),
  audienceId: z.string().uuid().nullable().optional(),
  audienceFilter: audienceFilterSchema.nullable().optional(),
  trigger: z.enum(["manual", "lead_created", "listing_published"]).optional(),
  networks: z.array(z.enum(SOCIAL_NETWORKS)).max(5).optional(),
  steps: z.array(stepSchema).min(1).max(8),
  activate: z.boolean().optional(),
});
