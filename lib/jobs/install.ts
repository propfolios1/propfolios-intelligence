import "server-only";
import { advanceTrials } from "@/lib/trial/service";
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
}
