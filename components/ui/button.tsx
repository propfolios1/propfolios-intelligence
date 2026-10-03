import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Four variants, one geometry: 6px radius, Inter 500 at 14px, 36px tall
 * (9px by 14px padding). Press settles to 98% for 80ms. Never a pill.
 */
const buttonVariants = cva(
  "press inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-surface hover:bg-navy-800",
        secondary: "border border-hairline bg-surface text-ink-700 hover:bg-ink-50 hover:text-ink-900",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
        outline: "border border-hairline bg-transparent text-ink-700 hover:bg-ink-50 hover:text-ink-900",
        destructive: "bg-danger text-surface hover:bg-[color-mix(in_oklab,var(--danger)_88%,var(--ink-900))]",
        link: "h-auto px-0 text-navy-900 underline decoration-ink-300 underline-offset-4 hover:decoration-navy-900 active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-ui",
        md: "h-9 px-3.5 text-ui",
        lg: "h-10 px-4 text-ui",
        icon: "size-9",
        "icon-sm": "size-8",
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
