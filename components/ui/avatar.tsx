"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export function Avatar({ name, src, size = 32, className }: { name: string; src?: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <AvatarPrimitive.Root style={{ width: size, height: size }} className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-navy-900", className)}>
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className={cn("flex size-full items-center justify-center font-medium tracking-[0.04em] text-surface", size <= 28 ? "text-hint" : "text-label")} delayMs={src ? 400 : 0}>
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
