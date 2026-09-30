"use client";

import { usePathname } from "next/navigation";

/** 200ms fade + 4px upward slide on route change. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
