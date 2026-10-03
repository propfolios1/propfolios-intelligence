"use client";

import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(({ className, ...props }, ref) => (
  <CommandPrimitive ref={ref} className={cn("flex flex-col", className)} {...props} />
));
Command.displayName = "Command";

export const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input ref={ref} className={cn("h-14 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-400", className)} {...props} />
));
CommandInput.displayName = "CommandInput";

export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;

export const CommandGroup = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Group>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-axis [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.05em] [&_[cmdk-group-heading]]:text-ink-500 [&_[cmdk-group-heading]]:uppercase",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandItem = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item ref={ref} className={cn("flex h-10 cursor-default items-center gap-3 rounded-sm px-3 text-ui text-ink-900 data-[selected=true]:bg-navy-50", className)} {...props} />
));
CommandItem.displayName = "CommandItem";
