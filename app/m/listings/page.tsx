import { MCard, MTitle, Pill } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { LISTING_STATUS_LABEL } from "@/lib/brokerage/listings";
import { formatLocal } from "@/lib/format";
import { agentSnapshot } from "@/lib/pwa/snapshot";

export default async function MobileListings() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { listings } = await agentSnapshot(await getDb(), user);
  return (
    <>
      <MTitle note={`${listings.length} listings. Available offline.`}>Listings</MTitle>
      <ul className="space-y-2">
        {listings.map((l) => (
          <li key={l.id}>
            <MCard>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] leading-snug text-ink-900">{l.title}</div>
                  <div className="mt-1 text-[12px] text-ink-500">
                    {l.reference} · {l.community}
                  </div>
                </div>
                <Pill>{LISTING_STATUS_LABEL[l.status]}</Pill>
              </div>
              <div className="num mt-3 text-[18px] text-navy-900">{formatLocal(l.price, l.currency)}</div>
            </MCard>
          </li>
        ))}
      </ul>
    </>
  );
}
