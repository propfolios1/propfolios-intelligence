import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={Compass}
        headline="Page not found"
        subtext="The page you’re looking for has moved or never existed."
        action={
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
        }
      />
    </div>
  );
}
