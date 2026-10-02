import { relativeTime } from "@/lib/utils";

/** "3h ago" with the exact timestamp on hover; tolerant of the seconds between server render and hydration. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })} className={className} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}
