import { cn } from "@/lib/utils";

/** 1440px measure. 16px gutter on phones, 48px on tablets, 80px on desktop; 48px above the header, 96px below the page. */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 pt-12 pb-24 md:px-12 xl:px-20", className)} {...props} />;
}
