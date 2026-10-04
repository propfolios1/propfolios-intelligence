import "server-only";
import { runMonitoring } from "@/lib/compliance/service";
import { pollPortals } from "@/lib/portals/service";
import { advanceTrials } from "@/lib/trial/service";
import { dispatchQueued } from "@/lib/whatsapp/service";
import { registerJob } from "./handlers";

/**
 * Feature modules register their scheduled handlers here, so the runner
 * imports one place. Each import is idempotent.
 */
let installed = false;
export function installFeatureJobs() {
  if (installed) return;
  installed = true;
  registerJob("trial-lifecycle", (db) => advanceTrials(db));
  registerJob("portal-publish-poll", (db) => pollPortals(db));
  registerJob("whatsapp-dispatch", (db) => dispatchQueued(db));
  registerJob("compliance-monitoring", (db) => runMonitoring(db));
}
