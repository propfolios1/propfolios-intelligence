import { z } from "zod";

export const automationBody = z.object({
  name: z.string().min(3).max(120),
  trigger: z.enum(["deal.stage_changed", "mandate.created", "invoice.paid", "kyc.expired", "deal.closed", "commission.computed"]),
  conditions: z.array(z.object({ field: z.enum(["jurisdiction", "deal_value_aed", "client_residency", "stage", "deal_type"]), op: z.enum(["eq", "gt", "lt", "contains"]), value: z.union([z.string().max(60), z.number()]) })).max(6).default([]),
  actions: z.array(z.object({ type: z.enum(["send_email", "create_task", "generate_report", "notify_slack", "notify_team"]), to: z.string().max(120).optional(), subject: z.string().max(200).optional(), message: z.string().max(1000).optional(), dueInDays: z.number().int().min(0).max(90).optional(), webhookUrl: z.string().url().startsWith("https://hooks.slack.com/").optional() })).min(1).max(5),
  enabled: z.boolean().default(true),
});
