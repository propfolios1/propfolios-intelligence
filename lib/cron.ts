import "server-only";
import { HttpError } from "./auth";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Admins may also trigger manually via ?secret=. */
export function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET is not configured.");
  const header = req.headers.get("authorization");
  const query = new URL(req.url).searchParams.get("secret");
  if (header !== `Bearer ${secret}` && query !== secret) throw new HttpError(401, "Invalid cron secret.");
}
