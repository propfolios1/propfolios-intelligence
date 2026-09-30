import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/primitives/button";
import { Field, Input } from "@/components/primitives/field";

export const metadata = { title: "Sign in" };

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignInPage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-12">
      <section className="flex flex-col px-6 py-8 md:px-12 lg:col-span-6 xl:px-20">
        <Link href="/" aria-label="Home" className="self-start">
          <BrandMark />
        </Link>
        <div className="flex flex-1 items-center py-16">
          <div className="w-full max-w-[400px] animate-hero">
            <div className="eyebrow">Client portal</div>
            <h1 className="mt-6 font-display text-title text-navy">Sign in.</h1>
            <p className="mt-4 text-ui text-ink-2">Access is by invitation from your relationship lead.</p>
            <div className="mt-12">
              {clerkEnabled ? (
                <SignIn
                  routing="path"
                  path="/sign-in"
                  fallbackRedirectUrl="/client/portfolio"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      cardBox: "w-full shadow-none border-0",
                      card: "shadow-none border-0 p-0 bg-transparent",
                      header: "hidden",
                      formButtonPrimary: "bg-navy hover:bg-ink shadow-none normal-case text-small h-11 rounded-sm",
                      formFieldInput: "h-10 border-rule shadow-none rounded-sm bg-paper",
                      formFieldLabel: "eyebrow",
                      footer: "bg-transparent",
                      socialButtonsBlockButton: "border-rule shadow-none rounded-sm",
                    },
                  }}
                />
              ) : (
                <form action="/client/portfolio" className="flex flex-col gap-6">
                  <Field label="Email">
                    <Input type="email" name="email" defaultValue="office@alnoor.ae" autoComplete="email" />
                  </Field>
                  <Field label="Password">
                    <Input type="password" name="password" defaultValue="demo-password" autoComplete="current-password" />
                  </Field>
                  <Button type="submit" size="lg" className="mt-2 w-full">
                    Sign in
                  </Button>
                  <p className="text-small text-ink-3">Demo mode. Set Clerk keys to require real accounts.</p>
                </form>
              )}
            </div>
          </div>
        </div>
        <p className="text-small text-ink-3">Sessions expire after 30 minutes of inactivity.</p>
      </section>

      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy px-16 py-8 lg:col-span-6 lg:flex xl:px-20">
        <div className="flex h-12 items-center justify-end">
          <span className="eyebrow text-paper/60">Dubai · Mumbai · London</span>
        </div>
        <blockquote className="max-w-[560px]">
          <p className="font-display text-[3.5rem] leading-[1.05] tracking-[-0.03em] text-paper">
            Buy land. They are not making it <em className="italic">anymore</em>.
          </p>
          <footer className="mt-10 flex items-center gap-4 text-small text-paper/60">
            <span className="h-px w-8 bg-gold" />
            Attributed to Mark Twain
          </footer>
        </blockquote>
        <BrandMark inverted size="sm" className="self-start" />
      </section>
    </div>
  );
}
