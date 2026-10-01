import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getProperty } from "@/lib/queries";

/** Property by id or slug, with developer, launches, comparable transactions and market series. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  return NextResponse.json(await getProperty(await getDb(), user, id));
});
