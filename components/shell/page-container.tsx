import { cn } from "@/lib/utils";

/** 1280px measure. 24px padding on mobile, 48px on tablet, 80px on desktop. */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-6 pt-12 pb-24 md:px-12 md:pt-16 xl:px-20", className)} {...props} />;
}
