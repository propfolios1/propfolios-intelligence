import "server-only";

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export interface Viewer {
  name: string;
  role: string;
  email: string;
  imageUrl?: string;
}

const DEMO: Record<"analyst" | "client" | "admin", Viewer> = {
  analyst: { name: "Aisha Rahman", role: "Senior Analyst", email: "aisha@propfolios.com" },
  client: { name: "Al Noor Family Office", role: "Client", email: "office@alnoor.ae" },
  admin: { name: "Claire Dubois", role: "Administrator", email: "claire@propfolios.com" },
};

/** Signed-in user when Clerk is configured; a demo persona otherwise. */
export async function getViewer(area: keyof typeof DEMO): Promise<Viewer> {
  if (!clerkEnabled) return DEMO[area];
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  if (!user) return DEMO[area];
  const role = (user.publicMetadata?.role as string | undefined) ?? DEMO[area].role;
  return {
    name: user.fullName ?? user.username ?? DEMO[area].name,
    role: role.charAt(0).toUpperCase() + role.slice(1),
    email: user.primaryEmailAddress?.emailAddress ?? "",
    imageUrl: user.imageUrl,
  };
}
