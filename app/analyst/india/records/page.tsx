import { redirect } from "next/navigation";

/** Property files are opened from the Mumbai and Goa desks; the bare path returns to the India overview. */
export default function RecordsIndex() {
  redirect("/analyst/india");
}
