// Cross-tenant RLS verification. For every table with a tenant_id column it
// signs in as tenant A through a Clerk-style JWT (role "authenticated",
// claims {sub, org_id}) and proves that tenant B's rows cannot be read,
// updated, deleted or inserted. Everything runs in transactions that are
// rolled back, so the database is left unchanged.
//
// Usage: DATABASE_URL=postgres://... node scripts/verify-rls.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Set DATABASE_URL (the table owner, e.g. the Supabase postgres user).");
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

const tables = (
  await sql`select t.tablename as name from pg_tables t
    where t.schemaname = 'public' and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'tenant_id')
    order by 1`
).map((r) => r.name);
const unprotected = await sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`;
const [{ n: policies }] = await sql`select count(*)::int as n from pg_policies where schemaname in ('public', 'storage')`;
const [a, b] = await sql`select t.id, t.slug from tenants t where exists (select 1 from users u where u.tenant_id = t.id and u.role = 'tenant_admin') order by t.slug = 'nakhla-demo' desc, t.slug = 'gulfrealty' desc, t.created_at limit 2`;
if (!a || !b) throw new Error("Seed at least two tenants with administrators first (/api/setup).");
const [admin] = await sql`select id from users where tenant_id = ${a.id} and role = 'tenant_admin' limit 1`;

class Rollback extends Error {}
const results = [];
for (const table of tables) {
  const r = { table, read: "ok", update: "ok", delete: "ok", insert: "ok", ownRows: 0 };
  try {
    await sql.begin(async (tx) => {
      // Give tenant A a Clerk organisation and its admin a Clerk user for the duration of the test.
      await tx`update tenants set clerk_org_id = 'org_rls_test' where id = ${a.id}`;
      await tx`update users set clerk_user_id = 'user_rls_test' where id = ${admin.id}`;
      const [{ n: foreign }] = await tx.unsafe(`select count(*)::int as n from "${table}" where tenant_id = $1`, [b.id]);
      await tx.unsafe(`create temp table rls_probe on commit drop as select * from "${table}" where tenant_id = $1 limit 1`, [b.id]);
      const hasId = (await tx`select 1 from information_schema.columns where table_schema = 'public' and table_name = ${table} and column_name = 'id'`).length > 0;
      if (hasId) await tx`update rls_probe set id = gen_random_uuid()`;
      await tx`grant select on rls_probe to authenticated`;
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: "user_rls_test", org_id: "org_rls_test", role: "authenticated" })}, true)`;
      await tx`savepoint readprobe`;
      try {
        const [{ n: seen }] = await tx.unsafe(`select count(*)::int as n from "${table}" where tenant_id = $1`, [b.id]);
        const [{ n: own }] = await tx.unsafe(`select count(*)::int as n from "${table}" where tenant_id = $1`, [a.id]);
        r.ownRows = own;
        if (seen > 0) r.read = `LEAK: ${seen} of ${foreign} rows visible`;
      } catch (e) {
        // Tables holding secrets (key hashes, signing and share tokens, outbound email) are not readable by clients at all.
        if (!/permission denied/i.test(e.message)) throw e;
        await tx`rollback to savepoint readprobe`;
        r.read = "ok";
        r.ownRows = "server only";
      }
      // Each write runs in a savepoint: a refusal (RLS or a missing grant) is a pass, an affected row is a leak.
      const attempt = async (label, statement, params) => {
        await tx`savepoint probe`;
        try {
          const res = await tx.unsafe(statement, params);
          await tx`release savepoint probe`;
          return res.count > 0 ? `LEAK: ${res.count} rows ${label}` : "ok";
        } catch (e) {
          await tx`rollback to savepoint probe`;
          return /row-level security|permission denied/i.test(e.message) ? "ok" : `error: ${e.message.slice(0, 80)}`;
        }
      };
      r.update = await attempt("updated", `update "${table}" set tenant_id = tenant_id where tenant_id = $1`, [b.id]);
      r.delete = await attempt("deleted", `delete from "${table}" where tenant_id = $1`, [b.id]);
      r.insert = foreign > 0 ? await attempt("inserted", `insert into "${table}" select * from rls_probe`, []) : "n/a";
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) r.read = `error: ${e.message}`;
  }
  results.push(r);
}

const failed = results.filter((r) => [r.read, r.update, r.delete, r.insert].some((v) => /LEAK|error/.test(v)));
console.log(`Tenant A ${a.slug}, tenant B ${b.slug}. ${tables.length} tenant tables, ${policies} policies, ${unprotected.length} public tables without RLS.`);
for (const r of results) console.log(`${r.table.padEnd(28)} read ${r.read.padEnd(6)} update ${r.update.padEnd(6)} delete ${r.delete.padEnd(6)} insert ${r.insert.padEnd(6)} own rows visible ${r.ownRows}`);
console.log(failed.length ? `FAILED: ${failed.length} tables leak across tenants.` : "PASSED: no table exposes another tenant's rows.");
await sql.end();
process.exit(failed.length || unprotected.length ? 1 : 0);
