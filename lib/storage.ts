import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

export const BUCKETS = ["documents", "memos", "branding", "avatars"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** True when uploads are persisted (Supabase Storage or the Vercel Blob fallback). */
export const storageConfigured = () => Boolean(supabaseAdmin()) || Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export type StoredObject = { provider: "supabase" | "blob" | "none"; storagePath: string | null; url: string | null };

/** Private buckets, created on first setup when the service role key is present. */
export async function ensureBuckets() {
  const sb = supabaseAdmin();
  if (!sb) return { created: [] as string[], provider: "none" as const };
  const { data } = await sb.storage.listBuckets();
  const existing = new Set((data ?? []).map((b) => b.id));
  const created: string[] = [];
  for (const b of BUCKETS) {
    if (existing.has(b)) continue;
    const { error } = await sb.storage.createBucket(b, { public: false, fileSizeLimit: b === "documents" ? "10MB" : "5MB" });
    if (!error) created.push(b);
  }
  return { created, provider: "supabase" as const };
}

const safe = (name: string) => name.replace(/[^\w.-]+/g, "_").slice(-120);

/**
 * Stores a file under {tenantId}/{folder}/… in a private bucket. Supabase
 * Storage when configured, Vercel Blob as a fallback, otherwise nothing is
 * stored and only the record is kept.
 */
export async function putObject(opts: { bucket: Bucket; tenantId: string; folder: string; name: string; body: Blob | Buffer | Uint8Array; contentType: string }): Promise<StoredObject> {
  const path = `${opts.tenantId}/${opts.folder}/${Date.now()}-${safe(opts.name)}`;
  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.storage.from(opts.bucket).upload(path, opts.body, { contentType: opts.contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return { provider: "supabase", storagePath: `${opts.bucket}/${path}`, url: null };
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(path, opts.body instanceof Uint8Array && !(opts.body instanceof Buffer) ? Buffer.from(opts.body) : opts.body, { access: "public", contentType: opts.contentType, addRandomSuffix: true });
    return { provider: "blob", storagePath: null, url: blob.url };
  }
  return { provider: "none", storagePath: null, url: null };
}

function split(storagePath: string) {
  const i = storagePath.indexOf("/");
  return { bucket: storagePath.slice(0, i) as Bucket, path: storagePath.slice(i + 1) };
}

/** Short-lived signed URL for a stored object (default 60 seconds). */
export async function signedUrl(storagePath: string, seconds = 60, download?: string) {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const { bucket, path } = split(storagePath);
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, seconds, download ? { download } : undefined);
  return error ? null : data.signedUrl;
}

/** Downloads an object's bytes (used to serve tenant logos without exposing the bucket). */
export async function readObject(storagePath: string) {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const { bucket, path } = split(storagePath);
  const { data, error } = await sb.storage.from(bucket).download(path);
  return error ? null : data;
}

export async function removeObject(storagePath: string) {
  const sb = supabaseAdmin();
  if (!sb) return;
  const { bucket, path } = split(storagePath);
  await sb.storage.from(bucket).remove([path]);
}

/** True when the path belongs to the tenant (defence in depth before signing). */
export const ownsPath = (storagePath: string, tenantId: string) => split(storagePath).path.startsWith(`${tenantId}/`);
