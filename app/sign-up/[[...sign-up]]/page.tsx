import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { AuthFrame, clerkAppearance, DemoPersonas } from "@/components/brand/auth-frame";
import { resolveBrand } from "@/lib/brand";

export const metadata = { title: "Create account" };

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default async function SignUpPage() {
  const brand = await resolveBrand();
  return (
    <AuthFrame eyebrow={brand.config.brand_name} title="Create account" subtitle="Clients: use the email address your relationship manager holds on file, and your portfolio is linked automatically.">
      {clerkEnabled ? (
        <>
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/home" appearance={clerkAppearance} />
          <p className="mt-6 text-small text-ink-500">
            Already registered?{" "}
            <Link href="/sign-in" className="text-navy-900 underline decoration-ink-200 underline-offset-4">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <DemoPersonas />
      )}
    </AuthFrame>
  );
}
