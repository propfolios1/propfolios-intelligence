import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Sign in" };

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh">
      <section className="flex w-full flex-col px-8 py-10 md:px-12 lg:w-1/2 lg:px-16">
        <Link href="/" aria-label="Home">
          <BrandMark size="sm" />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px] animate-enter">
            <div className="eyebrow">Client portal</div>
            <h1 className="mt-3 font-display text-section font-medium text-navy-900">Welcome back.</h1>
            <p className="mt-2 text-secondary text-ink-600">Sign in to your PropFolios workspace.</p>
            <div className="mt-8">
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
                      formButtonPrimary: "bg-navy-900 hover:opacity-90 shadow-none normal-case text-sm h-10",
                      formFieldInput: "h-10 border-ink-200 shadow-none",
                      footer: "bg-transparent",
                      socialButtonsBlockButton: "border-ink-200 shadow-none",
                    },
                  }}
                />
              ) : (
                <DemoForm />
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-500">Protected by enterprise-grade encryption. Access is by invitation only.</p>
      </section>

      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-900 p-16 text-white lg:flex">
        <svg aria-hidden className="absolute -right-32 -bottom-32 size-[560px] opacity-20" viewBox="0 0 200 200">
          <g fill="none" stroke="var(--color-gold-400)" strokeWidth="0.4">
            <circle cx="100" cy="100" r="98" />
            <circle cx="100" cy="100" r="70" />
            <path d="M2 100 H198 M100 2 V198" />
          </g>
        </svg>
        <BrandMark inverted size="sm" />
        <blockquote className="relative max-w-[520px]">
          <p className="font-display text-[2rem] leading-[1.25] font-normal tracking-[-0.01em]">
            “Ninety percent of all millionaires become so through owning real estate.”
          </p>
          <footer className="mt-6 flex items-center gap-3 text-sm text-white/70">
            <span className="h-px w-8 bg-gold-500" />
            Attributed to Andrew Carnegie
          </footer>
        </blockquote>
        <div className="text-xs text-white/50">UAE · India · Institutional advisory</div>
      </section>
    </div>
  );
}

function DemoForm() {
  return (
    <form action="/client/portfolio" className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Email</span>
        <Input type="email" name="email" defaultValue="office@alnoor.ae" autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800">Password</span>
        <Input type="password" name="password" defaultValue="demo-password" autoComplete="current-password" />
      </label>
      <Button type="submit" className="h-10 w-full">
        Sign in
      </Button>
      <p className="text-center text-xs text-ink-500">Demo mode — set Clerk keys to enable authentication.</p>
    </form>
  );
}
