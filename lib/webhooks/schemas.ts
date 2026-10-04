import { z } from "zod";

export const endpointBody = z.object({ url: z.string().trim().max(500), description: z.string().max(200).default(""), events: z.array(z.string().max(60)).min(1).max(20) });
export const endpointPatch = z.object({ events: z.array(z.string().max(60)).min(1).max(20).optional(), active: z.boolean().optional(), description: z.string().max(200).optional() });
