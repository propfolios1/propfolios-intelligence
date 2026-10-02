import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell area="platform">{children}</AppShell>;
}
