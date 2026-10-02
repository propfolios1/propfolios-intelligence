import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";

const INR_PER_AED = 22.6;

/**
 * The k projects most similar to a property, by cosine distance between the
 * pgvector embeddings of their property profiles (HNSW index). Scoped to the
 * tenant's catalogue.
 */
export async function similarProperties(db: DB, tenantId: string, propertyId: string, k = 10) {
  const [subject] = await db
    .select({ id: s.documents.id })
    .from(s.documents)
    .where(scope(s.documents, tenantId, eq(s.documents.propertyId, propertyId), eq(s.documents.type, "property_profile")))
    .limit(1);
  if (!subject) return [];
  const distance = sql<number>`${s.documents.embedding} <=> (select d2.embedding from documents d2 where d2.id = ${subject.id})`;
  const rows = await db
    .select({ p: s.properties, developer: s.developers.name, distance })
    .from(s.documents)
    .innerJoin(s.properties, eq(s.properties.id, s.documents.propertyId))
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(scope(s.documents, tenantId, eq(s.documents.type, "property_profile"), ne(s.documents.propertyId, propertyId)))
    .orderBy(distance)
    .limit(k);
  return rows.map((r) => ({
    propertyId: r.p.id,
    slug: r.p.slug,
    name: r.p.name,
    community: r.p.community,
    city: r.p.city,
    status: r.p.status,
    currency: r.p.currency,
    pricePerSqft: r.p.pricePerSqft,
    pricePerSqftAed: r.p.currency === "INR" ? r.p.pricePerSqft / INR_PER_AED : r.p.pricePerSqft,
    grossYield: r.p.grossYield,
    developer: r.developer,
    similarity: +Math.max(0, 1 - Number(r.distance)).toFixed(3),
  }));
}
export type SimilarProperty = Awaited<ReturnType<typeof similarProperties>>[number];

/** Ensures every property in the tenant has a profile embedding (properties created after seeding). */
export async function propertyHasProfile(db: DB, tenantId: string, propertyId: string) {
  const [row] = await db.select({ id: s.documents.id }).from(s.documents).where(and(eq(s.documents.tenantId, tenantId), eq(s.documents.propertyId, propertyId), eq(s.documents.type, "property_profile")));
  return Boolean(row);
}
