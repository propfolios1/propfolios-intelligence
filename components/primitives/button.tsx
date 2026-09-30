import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primary hover goes darker (navy → ink), never lighter. Background swaps on a
 * 120ms linear curve; press sinks half a pixel.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium tracking-[0.01em] transition-[background-color,border-color,color] duration-120 ease-linear active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        primary: "bg-navy text-paper hover:bg-ink",
        secondary: "border border-rule bg-transparent text-ink hover:border-ink",
        ghost: "text-ink-2 hover:text-ink",
        destructive: "border border-red bg-transparent text-red hover:bg-red hover:text-paper",
        link: "h-auto px-0 text-ink underline decoration-rule underline-offset-4 hover:decoration-ink",
      },
      size: {
        sm: "h-8 px-3 text-small",
        md: "h-10 px-4 text-small",
        lg: "h-13 px-6 text-ui",
        icon: "size-9",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export { buttonVariants };
