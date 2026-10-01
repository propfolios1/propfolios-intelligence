import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Post-sign-in landing: sends each role to its workspace. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  redirect(user.role === "client" ? "/client/portfolio" : "/analyst/dashboard");
}
