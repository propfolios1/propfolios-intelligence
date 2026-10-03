import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Notifications belong to every tenant role; the surrounding shell follows the signed-in person's workspace. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  return <AppShell area={user.role === "client" ? "client" : "analyst"}>{children}</AppShell>;
}
