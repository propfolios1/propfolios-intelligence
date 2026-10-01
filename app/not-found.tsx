import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] items-center px-6 md:px-12 xl:px-20">
      <EmptyState
        glyph="documents"
        headline="This page does not exist."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
        }
      />
    </div>
  );
}
