import Link from "next/link";
import { MCard, MTitle } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { agentSnapshot } from "@/lib/pwa/snapshot";
import { relativeTime } from "@/lib/utils";

export default async function MobileNotifications() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { notifications } = await agentSnapshot(await getDb(), user);
  return (
    <>
      <MTitle note={`${notifications.filter((n) => !n.readAt).length} unread`}>Notifications</MTitle>
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <MCard className={n.readAt ? "" : "border-navy-300"}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-[15px] text-ink-900">{n.title}</div>
                <span className="shrink-0 text-[11px] text-ink-500">{relativeTime(n.createdAt.toISOString())}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-700">{n.body}</p>
              {n.href && (
                <Link href={n.href} className="mt-2 inline-block text-[13px] text-navy-900">
                  Open
                </Link>
              )}
            </MCard>
          </li>
        ))}
        {!notifications.length && <p className="text-[14px] text-ink-500">No notifications.</p>}
      </ul>
    </>
  );
}
