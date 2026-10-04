import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

/**
 * Data residency. A Supabase project lives in one cloud region, so a firm's
 * records sit wherever the project serving it was created. Moving a firm
 * means placing it on a project in another region: an Enterprise service the
 * platform team schedules and runs, not a switch. This module records where
 * a firm's data is, lists every sub-processor with its processing location,
 * and takes requests to move.
 */

export type Region = { key: string; label: string; location: string; provider: string; available: boolean; note: string; suits: string[] };

export const REGIONS: Region[] = [
  { key: "ap-south-1", label: "Mumbai", location: "India", provider: "Supabase on AWS ap-south-1", available: true, note: "Keeps Indian clients' records in India, which DPDP Act rules on cross-border transfer and RBI expectations for financial data favour.", suits: ["IN"] },
  { key: "eu-central-1", label: "Frankfurt", location: "Germany, European Union", provider: "Supabase on AWS eu-central-1", available: true, note: "EU storage for firms subject to the GDPR. Also the nearest standard region to the Gulf by latency.", suits: ["EU", "AE"] },
  { key: "eu-west-2", label: "London", location: "United Kingdom", provider: "Supabase on AWS eu-west-2", available: true, note: "UK storage for firms under the UK GDPR and Data Protection Act 2018.", suits: ["GB"] },
  { key: "ap-southeast-1", label: "Singapore", location: "Singapore", provider: "Supabase on AWS ap-southeast-1", available: true, note: "Singapore storage for firms under the PDPA.", suits: ["SG"] },
  { key: "ap-southeast-2", label: "Sydney", location: "Australia", provider: "Supabase on AWS ap-southeast-2", available: true, note: "Australian storage for firms under the Privacy Act 1988.", suits: ["AU"] },
  { key: "us-east-1", label: "North Virginia", location: "United States", provider: "Supabase on AWS us-east-1", available: true, note: "United States storage.", suits: ["US"] },
  {
    key: "uae-dedicated",
    label: "UAE (dedicated)",
    location: "United Arab Emirates",
    provider: "Dedicated deployment on a UAE cloud region (AWS me-central-1, Azure UAE North or Core42)",
    available: false,
    note: "Supabase's hosted service does not offer a UAE region today. In-country storage, which some DIFC, ADGM and government-linked clients require, is delivered as a dedicated deployment under an Enterprise agreement.",
    suits: ["AE"],
  },
];

export const regionByKey = (k: string) => REGIONS.find((r) => r.key === k) ?? null;

/** The region this deployment runs in, from NAKHLA_DATA_REGION (set it to the Supabase project's region). */
export function deploymentRegion() {
  const key = process.env.NAKHLA_DATA_REGION?.trim();
  return key ? (regionByKey(key) ?? { key, label: key, location: key, provider: "Supabase", available: true, note: "", suits: [] }) : null;
}

/** Every service that processes the firm's data, and where. */
export function subprocessors() {
  const region = deploymentRegion();
  return [
    { name: "Supabase", purpose: "Database, file storage, realtime and scheduled jobs", location: region ? `${region.label}, ${region.location}` : "The Supabase project's region", data: "All firm records and documents" },
    { name: "Vercel", purpose: "Application hosting and server functions", location: process.env.VERCEL_REGION ? `Function region ${process.env.VERCEL_REGION}` : "Function region set in the Vercel project", data: "Requests in transit; nothing stored" },
    { name: "Anthropic", purpose: "AI agents (research, underwriting, drafting, replies)", location: "United States", data: "The text of each agent request; not used for model training under Anthropic's commercial terms" },
    { name: "Clerk", purpose: "Sign-in, sessions and single sign-on", location: "United States", data: "Staff and client names, email addresses and sign-in events" },
    { name: "Resend", purpose: "Transactional email", location: "United States", data: "Recipient address and message body" },
    { name: "Stripe", purpose: "Subscription billing", location: "United States and Ireland", data: "Billing contact and payment method; card data never reaches Nakhla" },
    { name: "Meta (WhatsApp Business Platform)", purpose: "WhatsApp messaging, when connected", location: "Meta data centres", data: "Messages exchanged with leads and clients" },
  ];
}

export async function residency(db: DB, tenantId: string) {
  const [row] = await db.select().from(s.dataResidencyConfigs).where(scope(s.dataResidencyConfigs, tenantId));
  if (row) return row;
  const [created] = await db.insert(s.dataResidencyConfigs).values({ tenantId, region: deploymentRegion()?.key ?? "unspecified" }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(s.dataResidencyConfigs).where(scope(s.dataResidencyConfigs, tenantId)))[0]!;
}

export async function requestMove(db: DB, tenantId: string, b: { region: string; reason: string }, userId: string, now = new Date()) {
  const target = regionByKey(b.region);
  if (!target) throw new HttpError(422, "Unknown region.");
  const cur = await residency(db, tenantId);
  if (cur.region === target.key) throw new HttpError(422, `Your data is already stored in ${target.label}.`);
  if (cur.status === "scheduled" || cur.status === "migrating") throw new HttpError(409, "A move is already scheduled. The platform team will contact you before it starts.");
  const [t] = await db.select({ plan: s.tenants.plan }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (t!.plan !== "enterprise" && t!.plan !== "white_label") throw new HttpError(402, "Choosing a data region is available on the Enterprise and White-label plans.");
  const [row] = await db.update(s.dataResidencyConfigs).set({ requestedRegion: target.key, status: "requested", requestedAt: now, requestedBy: userId, reason: b.reason.trim() || null }).where(eq(s.dataResidencyConfigs.id, cur.id)).returning();
  return { row: row!, target };
}

export async function cancelMove(db: DB, tenantId: string) {
  const cur = await residency(db, tenantId);
  if (cur.status !== "requested") throw new HttpError(409, "Only a request that has not been scheduled can be withdrawn.");
  const [row] = await db.update(s.dataResidencyConfigs).set({ requestedRegion: null, status: "current", requestedAt: null, requestedBy: null, reason: null }).where(eq(s.dataResidencyConfigs.id, cur.id)).returning();
  return row!;
}

export async function acknowledgeSubprocessors(db: DB, tenantId: string, now = new Date()) {
  const cur = await residency(db, tenantId);
  const [row] = await db.update(s.dataResidencyConfigs).set({ subprocessorsAcknowledgedAt: now }).where(eq(s.dataResidencyConfigs.id, cur.id)).returning();
  return row!;
}
