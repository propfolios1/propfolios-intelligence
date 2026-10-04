/**
 * Viewing slots in the firm's time zone. Slots fall inside the agent's working
 * hours on working days, start at least three hours out, sit on the hour, and
 * never overlap a confirmed booking (with a 30-minute travel buffer).
 */

export type Hours = { start: string; end: string; days: number[]; timezone: string };
export type Busy = { startsAt: Date; endsAt: Date };

const MIN = 60_000;
const BUFFER = 30 * MIN;
const LEAD_TIME = 3 * 60 * MIN;

export const MARKET_TZ: Record<string, string> = { AE: "Asia/Dubai", IN: "Asia/Kolkata", GB: "Europe/London", SG: "Asia/Singapore", AU: "Australia/Sydney", US: "America/New_York" };

function parts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { y: Number(g("year")), m: Number(g("month")), d: Number(g("day")), h: Number(g("hour")), mi: Number(g("minute")), s: Number(g("second")), wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")) };
}

function offsetMs(tz: string, d: Date) {
  const q = parts(d, tz);
  return Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi, q.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant at a wall-clock time in a time zone. */
export function zoned(y: number, m: number, d: number, h: number, mi: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(tz, new Date(guess));
  return new Date(guess - offsetMs(tz, new Date(first)));
}

export function slotLabel(d: Date, tz: string) {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day}, ${time}`;
}

export function openSlots(hours: Hours, busy: Busy[], opts: { now: Date; minutes: number; count?: number; maxDays?: number }) {
  const count = opts.count ?? 3;
  const out: Date[] = [];
  const [sh, sm] = hours.start.split(":").map(Number) as [number, number];
  const [eh, em] = hours.end.split(":").map(Number) as [number, number];
  const earliest = opts.now.getTime() + LEAD_TIME;
  const today = parts(opts.now, hours.timezone);
  for (let i = 0; i < (opts.maxDays ?? 14) && out.length < count; i++) {
    const noon = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12));
    const day = parts(noon, hours.timezone);
    if (!hours.days.includes(new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay())) continue;
    const close = zoned(day.y, day.m, day.d, eh, em, hours.timezone).getTime();
    let perDay = 0;
    for (let h = sh + (sm > 0 ? 1 : 0); out.length < count && perDay < 2; h++) {
      const start = zoned(day.y, day.m, day.d, h, 0, hours.timezone);
      const end = start.getTime() + opts.minutes * MIN;
      if (end > close) break;
      if (start.getTime() < earliest) continue;
      const clash = busy.some((b) => start.getTime() < b.endsAt.getTime() + BUFFER && end + BUFFER > b.startsAt.getTime());
      if (clash) continue;
      out.push(start);
      perDay++;
      // Spread the offer: one morning and one afternoon option per day.
      h += 3;
    }
  }
  return out;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** An iCalendar feed a calendar client (Google, Outlook, Apple) can subscribe to. */
export function icsFeed(name: string, events: { id: string; startsAt: Date; endsAt: Date; summary: string; description: string; location: string | null; status: "confirmed" | "cancelled" | "completed"; updatedAt: Date }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nakhla//Viewings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT15M"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@nakhla`, `DTSTAMP:${icsDate(e.updatedAt)}`, `DTSTART:${icsDate(e.startsAt)}`, `DTEND:${icsDate(e.endsAt)}`, `SUMMARY:${esc(e.summary)}`, `DESCRIPTION:${esc(e.description)}`, ...(e.location ? [`LOCATION:${esc(e.location)}`] : []), `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,74}/g)!.join("\r\n ") : l)).join("\r\n") + "\r\n";
}
