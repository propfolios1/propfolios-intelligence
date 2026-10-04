import { ImageResponse } from "next/og";

/** App icons generated at 192 and 512 pixels; maskable icons keep the mark inside the safe zone. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const mark = Math.round(size * (maskable ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1F44", borderRadius: maskable ? 0 : size * 0.22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#FAFAF9" }}>
          <div style={{ fontSize: mark, lineHeight: 1, fontWeight: 600 }}>N</div>
          <div style={{ width: mark * 0.6, height: Math.max(2, size * 0.02), background: "#C9A961", marginTop: size * 0.03 }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=604800, immutable" } },
  );
}
