import { StatusPill, type PillTone } from "@/components/ui/status-pill";

const RERA: Record<string, PillTone> = { registered: "complete", completed: "complete", extended: "progress", lapsed: "error", revoked: "error" };
const COMPLAINT: Record<string, PillTone> = { pending: "progress", hearing: "progress", order_passed: "error", disposed: "neutral", withdrawn: "neutral" };

export const ReraStatus = ({ status }: { status: string }) => <StatusPill tone={RERA[status] ?? "neutral"}>{status}</StatusPill>;
export const ComplaintStatus = ({ status }: { status: string }) => <StatusPill tone={COMPLAINT[status] ?? "neutral"}>{status.replace("_", " ")}</StatusPill>;
export const Flag = ({ tone, children }: { tone: PillTone; children: React.ReactNode }) => <StatusPill tone={tone}>{children}</StatusPill>;

export function Severity({ level }: { level: string }) {
  const tone: PillTone = level === "CRITICAL" || level === "HIGH" ? "error" : level === "MEDIUM" ? "progress" : "neutral";
  return <StatusPill tone={tone}>{level}</StatusPill>;
}
