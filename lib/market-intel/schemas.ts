import { z } from "zod";

const money = z.number().nonnegative().max(1e12).nullable();

export const subscriptionFilters = z.object({
  markets: z.array(z.string().length(2)).max(6),
  areas: z.array(z.string().min(1).max(80)).max(20),
  propertyTypes: z.array(z.string().min(1).max(40)).max(10),
  bedrooms: z.array(z.number().int().min(0).max(5)).max(6),
  budgetMin: money,
  budgetMax: money,
  currency: z.string().length(3),
  purpose: z.enum(["sale", "rent"]),
});

export const subscriptionBody = z.object({
  name: z.string().trim().min(2).max(80),
  filters: subscriptionFilters,
  frequency: z.enum(["weekly", "fortnightly", "monthly"]),
  channels: z.array(z.enum(["portal", "email"])).min(1).max(2),
  includeInventory: z.boolean(),
  active: z.boolean().optional(),
});
