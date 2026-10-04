import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuthFrame, clerkAppearance, DemoPersonas } from "@/components/brand/auth-frame";
import { resolveBrand } from "@/lib/brand";

export const metadata = { title: "Sign in" };

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default async function SignInPage() {
  const brand = await resolveBrand();
  return (
    <AuthFrame eyebrow={brand.config.brand_name} title="Sign in" subtitle={clerkEnabled ? "Clients and the advisory team sign in here." : "Choose a demonstration persona."}>
      {clerkEnabled ? (
        <>
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/home" appearance={clerkAppearance} />
          <p className="mt-6 text-small text-ink-500">
            New to {brand.config.brand_name}?{" "}
            <Link href="/sign-up" className="text-navy-900 underline decoration-ink-200 underline-offset-4">
              Create an account
            </Link>
          </p>
        </>
      ) : (
        <DemoPersonas />
      )}
    </AuthFrame>
  );
}
