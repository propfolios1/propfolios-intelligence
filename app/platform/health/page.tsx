import { HealthView } from "@/components/jobs/health-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "System health" };
export const dynamic = "force-dynamic";

export default async function PlatformHealthPage() {
  await requireRole(["platform_admin"]);
  return <HealthView platformAdmin eyebrow="Nakhla platform" />;
}
