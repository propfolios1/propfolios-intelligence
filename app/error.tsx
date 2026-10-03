"use client";

import * as React from "react";
import { EmptyState } from "@/components/composites/empty-state";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[1440px] items-center px-6 md:px-12 xl:px-20" role="alert">
      <EmptyState
        glyph="documents"
        headline="This page could not be loaded"
        note={`The error has been logged${error.digest ? ` (reference ${error.digest})` : ""}. Retry, or return to the dashboard.`}
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>Retry</Button>
            <Button variant="secondary" asChild>
              <a href="/home">Dashboard</a>
            </Button>
          </div>
        }
      />
    </div>
  );
}
