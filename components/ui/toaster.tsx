"use client";

import { Toaster as Sonner, toast } from "sonner";

/** Sonner, restyled: white card, 1px rule, float shadow, no icons beyond status. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-[360px] items-start gap-3 rounded-md border border-ink-200 bg-surface px-4 py-3.5 shadow-float font-sans",
          title: "text-ui font-medium text-ink-900",
          description: "mt-0.5 text-ui text-ink-500",
          actionButton: "ml-auto h-7 rounded-sm bg-navy-900 px-2.5 text-[0.75rem] font-medium text-surface",
          cancelButton: "ml-auto h-7 rounded-sm px-2.5 text-[0.75rem] text-ink-700",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
        },
      }}
    />
  );
}

export { toast };
