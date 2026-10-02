import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Post-sign-in landing: sends each role to its workspace. */
export default async function Home() {
  const s = await getAuthState();
  if (s.status === "signed_out") redirect("/sign-in");
  if (s.status === "needs_onboarding") redirect("/onboarding");
  if (s.status === "suspended") redirect("/suspended");
  const u = s.user;
  redirect(u.role === "platform_admin" ? "/platform/dashboard" : u.role === "client" ? "/client/portfolio" : "/analyst/dashboard");
}
