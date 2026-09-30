"use client";

import { usePathname } from "next/navigation";
import type { Area } from "./nav-config";

/** The analyst desk changes pages instantly. The client portal fades over 200ms. */
export function PageTransition({ area, children }: { area: Area; children: React.ReactNode }) {
  const pathname = usePathname();
  if (area !== "client") return <>{children}</>;
  return (
    <div key={pathname} className="animate-fade">
      {children}
    </div>
  );
}
