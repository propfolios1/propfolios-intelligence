import Link from "next/link";
import { PasskeySetup } from "@/components/mobile/passkey";
import { PushToggle } from "@/components/mobile/runtime";
import { MCard, MTitle } from "@/components/mobile/ui";
import { clerkEnabled, requireRole } from "@/lib/auth";
import { vapidPublicKey } from "@/lib/pwa/push";

export default async function MobileMore() {
  await requireRole(["tenant_admin", "analyst"]);
  return (
    <>
      <MTitle>More</MTitle>
      <ul className="space-y-2">
        {[
          ["/m/commissions", "Commissions"],
          ["/m/notifications", "Notifications"],
          ["/analyst/dashboard", "Open the full desk"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link href={href!} className="block rounded-md border border-hairline bg-surface px-4 py-3 text-[15px] text-ink-900">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 mb-3 label-caps">Notifications on this phone</h2>
      <MCard>
        <PushToggle publicKey={vapidPublicKey()} />
      </MCard>
      <h2 className="mt-8 mb-3 label-caps">Biometric sign-in</h2>
      <MCard>{clerkEnabled ? <PasskeySetup /> : <p className="text-[13px] text-ink-500">Passkeys use the sign-in service, which is not configured in demonstration mode.</p>}</MCard>
    </>
  );
}
