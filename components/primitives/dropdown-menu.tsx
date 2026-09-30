"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/** Menus are bordered sheets of paper. No shadow. */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("z-50 min-w-[200px] overflow-hidden rounded-sm border border-rule bg-paper py-1 data-[state=open]:animate-menu-in", className)}
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
      "flex h-9 cursor-default items-center gap-2.5 px-3 text-small text-ink outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-paper-2 [&_svg]:size-3.5 [&_svg]:stroke-[1.5] [&_svg]:text-ink-2",
      destructive && "text-red [&_svg]:text-red",
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
    className={cn("group relative flex h-9 cursor-default items-center pr-3 pl-9 text-small text-ink outline-none select-none data-[highlighted]:bg-paper-2", className)}
    {...props}
  >
    <span className="absolute left-3 size-3 rounded-xs border border-ink-3 group-data-[state=checked]:border-navy group-data-[state=checked]:bg-navy" aria-hidden />
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("eyebrow px-3 pt-2.5 pb-1.5 text-ink-3", className)} {...props} />;
}

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-rule", className)} {...props} />);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
