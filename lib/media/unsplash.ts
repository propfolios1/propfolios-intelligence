import "server-only";
import { pickIndex, subjectFor, type PhotoInput, type PhotoSubject } from "./subjects";

/**
 * Unsplash photography for properties, listings and holdings.
 *
 * Photographs come from the Unsplash API (search, landscape, high content
 * safety) and are hotlinked from images.unsplash.com as the API guidelines
 * require, with the photographer credited and linked. Each search is cached
 * for a week, so a workspace makes a few dozen API calls a week, well inside
 * the free tier of 50 an hour. Without UNSPLASH_ACCESS_KEY, or when a search
 * fails, the caller draws the property's illustrated skyline instead.
 */

export interface UnsplashPhoto {
  id: string;
  /** Raw image URL including its ixid; sized by the image loader. */
  src: string;
  alt: string;
  /** Dominant colour, painted while the image loads. */
  color: string;
  width: number;
  height: number;
  author: { name: string; profileUrl: string };
  pageUrl: string;
}

/** Referral parameters Unsplash asks every attribution link to carry. */
export const UNSPLASH_UTM = "utm_source=nakhla&utm_medium=referral";
export const UNSPLASH_HOME = `https://unsplash.com/?${UNSPLASH_UTM}`;

export function unsplashConfigured(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

interface ApiPhoto {
  id: string;
  width: number;
  height: number;
  color: string | null;
  alt_description: string | null;
  description: string | null;
  premium?: boolean;
  urls: { raw: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
}

const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;

export function toPhoto(p: ApiPhoto): UnsplashPhoto | null {
  if (!p?.urls?.raw?.startsWith("https://images.unsplash.com/") || p.premium) return null;
  const alt = (p.alt_description || p.description || "").trim();
  return {
    id: p.id,
    src: p.urls.raw,
    alt: alt ? alt.charAt(0).toUpperCase() + alt.slice(1) : "Architectural photograph",
    color: /^#[0-9a-f]{6}$/i.test(p.color ?? "") ? p.color! : "#1A3A6B",
    width: p.width,
    height: p.height,
    author: { name: p.user.name, profileUrl: withUtm(p.user.links.html) },
    pageUrl: withUtm(p.links.html),
  };
}

type Fetcher = (input: string, init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }) => Promise<Response>;

const WEEK = 60 * 60 * 24 * 7;
const memo = new Map<string, { at: number; ttl: number; photos: Promise<UnsplashPhoto[]> }>();

/** One search, cached for a week by the data cache and for six hours in memory; failures are retried after ten minutes. */
export async function searchUnsplash(query: string, opts: { key?: string; fetcher?: Fetcher; now?: number } = {}): Promise<UnsplashPhoto[]> {
  const key = opts.key ?? process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const now = opts.now ?? Date.now();
  const hit = memo.get(query);
  if (hit && now - hit.at < hit.ttl) return hit.photos;
  const fetcher: Fetcher = opts.fetcher ?? ((u, i) => fetch(u, i));
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape&content_filter=high`;
  const entry = { at: now, ttl: 6 * 3600_000, photos: Promise.resolve([] as UnsplashPhoto[]) };
  entry.photos = fetcher(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, next: { revalidate: WEEK, tags: ["unsplash"] }, signal: AbortSignal.timeout(4000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Unsplash ${res.status}`);
      const body = (await res.json()) as { results?: ApiPhoto[] };
      return (body.results ?? []).map(toPhoto).filter((p): p is UnsplashPhoto => p !== null);
    })
    .catch(() => {
      entry.ttl = 10 * 60_000;
      return [];
    });
  memo.set(query, entry);
  return entry.photos;
}

export function clearUnsplashCache() {
  memo.clear();
}

/**
 * Photographs for many subjects at once: one search per distinct query,
 * then a stable pick per subject. Two properties that share a query are
 * given different photographs where the results allow.
 */
export async function photosFor(subjects: PhotoSubject[], opts: Parameters<typeof searchUnsplash>[1] = {}): Promise<Map<string, UnsplashPhoto | null>> {
  const out = new Map<string, UnsplashPhoto | null>();
  const queries = [...new Set(subjects.map((s) => s.query))];
  const results = new Map(await Promise.all(queries.map(async (q) => [q, await searchUnsplash(q, opts)] as const)));
  const taken = new Map<string, Set<string>>();
  for (const s of subjects) {
    if (out.has(s.seed)) continue;
    const pool = results.get(s.query) ?? [];
    if (!pool.length) {
      out.set(s.seed, null);
      continue;
    }
    const used = taken.get(s.query) ?? new Set<string>();
    let i = pickIndex(s.seed, pool.length);
    for (let step = 0; step < pool.length && used.has(pool[i]!.id); step++) i = (i + 1) % pool.length;
    used.add(pool[i]!.id);
    taken.set(s.query, used);
    out.set(s.seed, pool[i]!);
  }
  return out;
}

/** Convenience for pages: resolve photographs straight from property-like rows. */
export async function photosForProperties(rows: PhotoInput[]) {
  const subjects = rows.map(subjectFor);
  const photos = await photosFor(subjects);
  return new Map(subjects.map((s) => [s.seed, { photo: photos.get(s.seed) ?? null, scene: s.scene }]));
}

export type PhotoBundle = { photo: UnsplashPhoto | null; scene: PhotoSubject["scene"] };
