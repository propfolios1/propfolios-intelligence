import { NextResponse } from "next/server";
import { getAnalysis, getMandateView } from "@/lib/data/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = getMandateView(id);
  const analysis = getAnalysis(id);
  if (!view || !analysis) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(JSON.stringify({ ...view, analysis }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${id}-analysis.json"` },
  });
}
