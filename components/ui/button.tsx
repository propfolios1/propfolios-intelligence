import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[opacity,background-color,border-color] duration-150 ease-brand disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-white hover:opacity-90",
        secondary: "border border-ink-200 bg-surface text-ink-900 hover:bg-ink-50",
        ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
        outline: "border border-ink-300 bg-transparent text-ink-900 hover:bg-ink-100/60",
        danger: "bg-negative text-white hover:opacity-90",
        link: "h-auto px-0 text-navy-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
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
