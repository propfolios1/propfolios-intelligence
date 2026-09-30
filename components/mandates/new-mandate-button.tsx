import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NewMandateButton() {
  return (
    <Button asChild>
      <Link href="/analyst/mandates?new=1" scroll={false}>
        <Plus /> New Mandate
      </Link>
    </Button>
  );
}
