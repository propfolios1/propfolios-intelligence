import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-surface hover:bg-navy-800",
        secondary: "border border-ink-200 bg-surface text-ink-900 shadow-card hover:border-ink-400",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
        outline: "border border-ink-200 bg-transparent text-ink-900 hover:bg-ink-100",
        destructive: "border border-danger/30 bg-surface text-danger hover:bg-danger hover:text-surface",
        link: "h-auto px-0 text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900",
      },
      size: {
        sm: "h-8 px-3 text-ui",
        md: "h-9 px-4 text-ui",
        lg: "h-11 px-5 text-body",
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
