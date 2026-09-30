"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function SignOutItem({ children }: { children: React.ReactNode }) {
  if (clerkEnabled) {
    return (
      <SignOutButton redirectUrl="/">
        <DropdownMenuItem destructive>{children}</DropdownMenuItem>
      </SignOutButton>
    );
  }
  return (
    <DropdownMenuItem destructive asChild>
      <Link href="/">{children}</Link>
    </DropdownMenuItem>
  );
}
