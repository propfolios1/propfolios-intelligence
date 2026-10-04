import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/brand/auth-frame";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace unavailable" };

export default async function Suspended() {
  const s = await getAuthState();
  if (s.status !== "suspended") redirect("/home");
  return (
    <AuthFrame
      eyebrow="Workspace unavailable"
      title={s.tenantStatus === "deactivated" ? "This account has been deactivated" : s.tenantStatus === "cancelled" ? "This workspace has been closed" : "This workspace is suspended"}
      subtitle={
        s.tenantStatus === "deactivated"
          ? "Your firm's administrator or identity provider has deactivated this account. Your work remains in the firm's records. Ask your administrator to reactivate it."
          : `Access to ${s.tenantName} is paused. Your data is retained. Your firm's administrator can reinstate access with Nakhla at support@nakhla.ai.`
      }
    >
      <a href="mailto:support@nakhla.ai" className="text-ui font-medium text-navy-900 underline decoration-ink-200 underline-offset-4">
        Contact support
      </a>
    </AuthFrame>
  );
}
