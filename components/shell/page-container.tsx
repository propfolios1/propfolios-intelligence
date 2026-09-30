import { cn } from "@/lib/utils";

/** Page padding: 32px mobile, 48px tablet, 64px desktop, 80px wide. */
export function PageContainer({ className, dense, ...props }: React.HTMLAttributes<HTMLDivElement> & { dense?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-8 py-8 md:px-12 md:py-12 lg:px-16 2xl:px-20",
        dense && "py-6 md:py-8",
        className,
      )}
      {...props}
    />
  );
}
