import { EmptyState } from "@/components/composites/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <EmptyState
        glyph="documents"
        headline="This page does not exist"
        note="The link may be out of date, or the record may have been removed from this workspace. Search finds any mandate, deal, client or property by name or reference."
        primary={{ label: "Go to dashboard", href: "/analyst/dashboard" }}
        secondary={{ label: "Return to the home page", href: "/" }}
        compact
      />
    </div>
  );
}
