import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/docs/openapi";

export const revalidate = 3600;

export function GET() {
  return NextResponse.json(openApiDocument(), { headers: { "access-control-allow-origin": "*" } });
}
