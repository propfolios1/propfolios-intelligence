import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for any workspace page: header, stat row, content block. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pt-12 pb-24 md:px-12 md:pt-16 xl:px-20" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-5 h-10 w-80 max-w-full" />
      <Skeleton className="mt-4 h-4 w-[28rem] max-w-full" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-hairline bg-surface p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-32" />
            <Skeleton className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-md border border-hairline bg-surface p-6">
        {[100, 92, 96, 80, 88].map((w, i) => (
          <Skeleton key={i} className="mt-4 h-4 first:mt-0" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
