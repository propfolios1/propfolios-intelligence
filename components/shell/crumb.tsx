"use client";

import * as React from "react";
import { useUi } from "@/lib/store";

/** Names a dynamic route segment in the top bar breadcrumb (for example an id as MND-0001). */
export function Crumb({ segment, label }: { segment: string; label: string }) {
  const setCrumb = useUi((s) => s.setCrumb);
  React.useEffect(() => setCrumb(segment, label), [segment, label, setCrumb]);
  return null;
}
