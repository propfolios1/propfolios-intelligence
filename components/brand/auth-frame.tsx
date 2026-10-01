import Link from "next/link";
import { BrandMark } from "./brand-mark";

/** Two-column frame for sign-in and sign-up: form on the left, navy panel on the right. */
export function AuthFrame({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-12">
      <section className="flex flex-col px-6 py-8 md:px-12 lg:col-span-6 xl:px-20">
        <Link href="/" aria-label="Home" className="self-start">
          <BrandMark />
        </Link>
        <div className="flex flex-1 items-center py-16">
          <div className="w-full max-w-[420px] animate-hero">
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="mt-5 font-display text-title text-navy-900">{title}</h1>
            <p className="mt-3 text-ui text-ink-700">{subtitle}</p>
            <div className="mt-10">{children}</div>
          </div>
        </div>
        <p className="text-small text-ink-500">PropFolios is an advisory firm based in Dubai. Your data is held in the UAE and never used to train models.</p>
      </section>
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 px-16 py-8 lg:col-span-6 lg:flex xl:px-20">
        <div className="flex h-12 items-center justify-end">
          <span className="eyebrow text-surface/60">UAE · India</span>
        </div>
        <blockquote className="max-w-[560px]">
          <p className="font-display text-[3rem] leading-[1.08] tracking-[-0.02em] text-surface">Every figure sourced. Every recommendation argued before it reaches you.</p>
          <footer className="mt-10 flex items-center gap-4 text-small text-surface/60">
            <span className="h-px w-8 bg-gold-500" />
            The PropFolios investment committee
          </footer>
        </blockquote>
        <BrandMark inverted size="sm" className="self-start" />
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
    formButtonPrimary: "bg-navy-900 hover:bg-navy-800 shadow-none normal-case text-ui h-11 rounded-sm",
    formFieldInput: "h-10 border-ink-200 shadow-none rounded-sm bg-surface",
    footer: "bg-transparent",
    socialButtonsBlockButton: "border-ink-200 shadow-none rounded-sm",
  },
};

export function DemoPersonas() {
  const personas = [
    ["admin", "Amol Bandekar", "Founder and administrator"],
    ["analyst", "Aisha Rahman", "Senior analyst, UAE"],
    ["client", "Ahmed Al Mansoori", "Client, AED 25M under advice"],
  ] as const;
  return (
    <div>
      <ul className="flex flex-col gap-3">
        {personas.map(([as, name, role]) => (
          <li key={as}>
            <a href={`/api/demo/persona?as=${as}`} className="flex items-center justify-between rounded-md border border-ink-200 bg-surface px-4 py-3.5 shadow-card transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ink-400">
              <span>
                <span className="block text-ui font-medium text-ink-900">{name}</span>
                <span className="block text-small text-ink-500">{role}</span>
              </span>
              <span aria-hidden className="text-ink-500">→</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-small text-ink-500">Demonstration mode. Add Clerk keys in Vercel to require real accounts.</p>
    </div>
  );
}
