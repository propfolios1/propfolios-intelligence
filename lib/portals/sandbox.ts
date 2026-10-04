/**
 * The Nakhla portal sandbox: a partner-style listing API that behaves like a
 * portal's (create, update, delete, status with moderation) so a firm can
 * rehearse publishing before its portal credentials arrive. It validates the
 * fields a real portal would reject on, never publishes anywhere, and keeps
 * state in memory per instance.
 */
type Entry = { id: string; payload: Record<string, unknown>; status: "pending_review" | "published" | "rejected"; reason: string | null; created: number };
const g = globalThis as unknown as { __nkSandbox?: Map<string, Map<string, Entry>> };
const stores = (g.__nkSandbox ??= new Map());

export function sandboxStore(portal: string, key: string) {
  const k = `${portal}:${key}`;
  if (!stores.has(k)) stores.set(k, new Map());
  return stores.get(k)!;
}

/** Fields whose absence a portal's moderation rejects, by sandbox portal. */
const REQUIRED: Record<string, string[]> = { bayut: ["Permit_Number", "Images"], dubizzle: ["permit_number", "photos"], propertyfinder: ["permit_number", "photo"], magicbricks: ["reraRegistrationNo"], "99acres": ["rera_registration_number"], housing: ["rera_id"] };

export function moderate(portal: string, payload: Record<string, unknown>): string | null {
  for (const f of REQUIRED[portal] ?? []) {
    const v = payload[f];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return `${f} is required.`;
  }
  const photos = (payload.Images ?? payload.photos ?? payload.photo ?? payload.images) as unknown[] | undefined;
  if (photos && photos.length < 5) return "At least five photographs are required.";
  return null;
}

/** Moderation completes 30 seconds after submission. */
export function view(e: Entry) {
  if (e.status === "pending_review" && Date.now() - e.created > 30_000) e.status = "published";
  return { id: e.id, status: e.status, rejection_reason: e.reason, url: `https://sandbox.nakhla.ai/listings/${e.id}` };
}
