import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Sign-in and sign-up: a 55/45 split. The form sits on white in a 380px
 * column with no card; the right panel is navy-900 with a single Playfair
 * line and the wordmark. No gradient, no imagery.
 */
export function AuthFrame({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-surface lg:grid-cols-[55fr_45fr]">
      <section className="flex flex-col px-4 py-6 md:px-12">
        <Link href="/" aria-label="Home" className="self-start rounded-xs">
          <span className="flex items-baseline gap-2 text-meta font-semibold tracking-[0.1em] text-ink-900 uppercase">
            Nakhla <span className="text-gold-500">OS</span>
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-[380px]">
            <div className="label-caps">{eyebrow}</div>
            <h1 className="mt-3 font-display text-page-sm font-medium text-navy-900">{title}</h1>
            <p className="mt-2 text-ui text-ink-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <p className="text-axis text-ink-500">Each firm&apos;s workspace is isolated at the application, database and storage layers. Client data is never used to train models.</p>
      </section>
      <section className="hidden flex-col justify-between bg-navy-900 px-12 py-8 lg:flex xl:px-20">
        <span className="label-caps text-ink-400">UAE · India</span>
        <blockquote className="max-w-[520px]">
          <p className="font-display text-title font-medium tracking-[-0.02em] text-surface">Every figure sourced. Every recommendation argued before it reaches a client.</p>
        </blockquote>
        <span className="flex items-baseline gap-2 text-meta font-semibold tracking-[0.1em] text-surface uppercase">
          Nakhla <span className="text-gold-500">OS</span>
        </span>
      </section>
    </div>
  );
}

export const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0",
    card: "shadow-none border-0 p-0 bg-transparent",
    header: "hidden",
    formButtonPrimary: "bg-navy-900 hover:bg-navy-800 shadow-none normal-case text-ui h-9 rounded-sm",
    formFieldInput: "h-9 border-hairline shadow-none rounded-sm bg-surface",
    formFieldLabel: "text-label uppercase tracking-[0.08em] text-ink-500 font-medium",
    footer: "bg-transparent",
    socialButtonsBlockButton: "border-hairline shadow-none rounded-sm",
  },
};

export function DemoPersonas() {
  const personas = [
    ["admin", "Amol Bandekar", "Demonstration firm, tenant administrator"],
    ["analyst", "Aisha Rahman", "Demonstration firm, senior analyst"],
    ["client", "Ahmed Al Mansoori", "Client of the demonstration firm"],
    ["platform", "Nakhla Operations", "Platform administrator, all tenants"],
  ] as const;
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {personas.map(([as, name, role]) => (
          <li key={as}>
            <a href={`/api/demo/persona?as=${as}`} className="group flex h-14 items-center justify-between rounded-md border border-hairline bg-surface px-4 transition-colors duration-150 hover:bg-ink-50">
              <span>
                <span className="block text-ui font-medium text-ink-900">{name}</span>
                <span className="block text-meta text-ink-500">{role}</span>
              </span>
              <ArrowRight className="size-3.5 stroke-[1.5] text-ink-400 transition-colors group-hover:text-ink-900" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-small text-ink-500">
        Demonstration mode. Add Clerk keys in Vercel to require real accounts, or{" "}
        <a href="/onboarding" className="text-navy-900 underline decoration-ink-200 underline-offset-4">
          create a new workspace
        </a>
        .
      </p>
    </div>
  );
}
