import { describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { commandFor, cronJobs, ensureCron, httpCommand } from "@/lib/jobs/cron";
import { HANDLERS, registerJob } from "@/lib/jobs/handlers";
import { JOB_BY_FN, JOB_INDEX, JOBS } from "@/lib/jobs/registry";
import { runJob } from "@/lib/jobs/runner";
import { testDb } from "./helpers/pglite";

describe("job registry", () => {
  it("schedules the seven platform jobs on Supabase Cron", () => {
    expect(Object.fromEntries(JOBS.slice(0, 7).map((j) => [j.name, j.schedule]))).toEqual({
      "keep-alive": "0 */6 * * *",
      "trial-lifecycle": "0 * * * *",
      "developer-sync": "0 */6 * * *",
      "portal-publish-poll": "*/15 * * * *",
      "proactive-insights": "0 * * * *",
      "federation-aggregate": "0 2 * * *",
      "job-run-details-cleanup": "0 0 * * *",
    });
    expect(JOB_BY_FN["insight-agent"]!.name).toBe("proactive-insights");
  });
  it("builds pg_net calls that read the URL and key from Vault", () => {
    const cmd = httpCommand("trial-lifecycle");
    expect(cmd).toContain("net.http_post");
    expect(cmd).toContain("vault.decrypted_secrets where name = 'project_url'");
    expect(cmd).toContain("'/functions/v1/trial-lifecycle'");
    expect(cmd).toContain("name = 'service_role_key'");
    expect(commandFor(JOB_INDEX["keep-alive"]!)).toBe("SELECT 1");
  });
});

describe("job runner", () => {
  it("records runs, replays an idempotency key, skips overlaps and records failures", async () => {
    const { db } = await testDb();
    let calls = 0;
    // Install the real handlers first so the stub below is not replaced when the runner installs them.
    (await import("@/lib/jobs/install")).installFeatureJobs();
    registerJob("developer-sync", async () => ({ synced: ++calls }));
    const first = await runJob(db, "developer-sync", { trigger: "cron", idempotencyKey: "developer-sync:2026-10-04T12:00" });
    expect(first.run).toMatchObject({ status: "succeeded", result: { synced: 1 } });
    const retry = await runJob(db, "developer-sync", { trigger: "cron", idempotencyKey: "developer-sync:2026-10-04T12:00" });
    expect(retry.replayed).toBe(true);
    expect(calls).toBe(1);

    await db.insert(s.jobRuns).values({ job: "developer-sync", status: "running" });
    const overlap = await runJob(db, "developer-sync", { trigger: "manual" });
    expect(overlap.run.status).toBe("skipped");

    registerJob("portal-publish-poll", async () => {
      throw new Error("Portal unreachable");
    });
    const failed = await runJob(db, "portal-publish-poll", { trigger: "cron" });
    expect(failed.run).toMatchObject({ status: "failed", error: "Portal unreachable" });
    const sqlJob = await runJob(db, "keep-alive", { trigger: "cron" });
    expect(sqlJob.run.status).toBe("succeeded");
    await expect(runJob(db, "no-such-job", { trigger: "cron" })).rejects.toThrow(/No job named/);
    delete HANDLERS["portal-publish-poll"];
  }, 120_000);

  it("reports, without changing anything, when pg_cron is not available", async () => {
    const { db } = await testDb();
    const status = await ensureCron(db);
    expect(status.available).toBe(false);
    expect(status.reason).toMatch(/pg_cron/);
    expect(await cronJobs(db)).toBeNull();
  }, 120_000);
});
