"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[180px] overflow-hidden rounded-card border border-ink-200 bg-surface p-1 shadow-float animate-fade-in",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-sm text-ink-800 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-ink-100 [&_svg]:size-4 [&_svg]:text-ink-500",
      destructive && "text-negative data-[highlighted]:bg-negative-soft [&_svg]:text-negative",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default items-center rounded-[4px] py-1.5 pr-2.5 pl-8 text-sm text-ink-800 outline-none select-none data-[highlighted]:bg-ink-100",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-4 items-center justify-center rounded-[3px] border border-ink-300 data-[state=checked]:border-navy-900">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-3 text-navy-900" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("eyebrow px-2.5 pt-2 pb-1", className)} {...props} />;
}

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-ink-200", className)} {...props} />);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
