"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

/** Backdrop: navy at 40% with an 8px blur, fading over 150ms. */
export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-navy-900/40 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, onInteractOutside, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // A modal closes deliberately: Escape or a button. A stray click outside does not discard work.
      onInteractOutside={(e) => {
        onInteractOutside?.(e);
        e.preventDefault();
      }}
      className={cn(
        "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-surface p-6 shadow-modal outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute top-5 right-5 rounded-xs p-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900">
          <X className="size-4 stroke-[1.5]" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
