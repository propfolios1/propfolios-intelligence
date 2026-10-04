import { HealthView } from "@/components/jobs/health-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "System health" };
export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const user = await requireRole(["tenant_admin"]);
  return <HealthView platformAdmin={user.platformAdmin} eyebrow="Administration" />;
}
