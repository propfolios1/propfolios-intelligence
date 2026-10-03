"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts, Vercel style: ink-900, white 13px text, 6px radius, no icon, no
 * border, one gold action link. Four seconds, bottom right.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      offset={16}
      gap={8}
      duration={4000}
      icons={{ success: null, error: null, info: null, warning: null, loading: null }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-auto max-w-[360px] items-start gap-4 rounded-sm bg-ink-900 px-4 py-3 shadow-toast font-sans",
          title: "text-meta text-surface",
          description: "mt-0.5 text-meta text-ink-400",
          actionButton: "ml-auto shrink-0 text-meta font-medium text-gold-500 hover:text-gold-100",
          cancelButton: "ml-auto shrink-0 text-meta text-ink-400 hover:text-surface",
          icon: "hidden",
        },
      }}
    />
  );
}

export { toast };
