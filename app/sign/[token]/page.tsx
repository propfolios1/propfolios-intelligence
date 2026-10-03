import { SignForm } from "@/components/deals/sign-form";
import { getDb } from "@/db";
import { signatureByToken } from "@/lib/deals/service";

export const metadata = { title: "Sign document", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = token.length > 20 ? await signatureByToken(await getDb(), token) : null;
  return (
    <main className="min-h-screen bg-canvas px-6 py-12 md:py-20">
      <div className="mx-auto max-w-[760px]">
        {!found || found.contract.status !== "out_for_signature" ? (
          <div className="rounded-md border border-ink-200 bg-surface p-8 shadow-card">
            <div className="eyebrow">Signature</div>
            <h1 className="mt-3 font-display text-[28px] text-navy-900">This link is no longer valid</h1>
            <p className="mt-3 text-small text-ink-700">Signing links are single-use. If you have not signed yet, ask your adviser to send a new request.</p>
          </div>
        ) : (
          <>
            <div className="eyebrow">{found.firm} · {found.deal.reference}</div>
            <h1 className="mt-3 font-display text-[32px] text-navy-900">{found.contract.title}</h1>
            <p className="mt-2 text-small text-ink-700">For signature by {found.sig.signerName} as {found.sig.party}. Document fingerprint <span className="num break-all">{found.contract.contentHash.slice(0, 16)}</span>.</p>
            <article className="prose-pf mt-8 max-h-[60vh] overflow-y-auto rounded-md border border-ink-200 bg-surface p-6 text-small shadow-card" dangerouslySetInnerHTML={{ __html: found.contract.contentHtml }} />
            <div className="mt-6">
              <SignForm token={token} signerName={found.sig.signerName} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
