import { ImageResponse } from "next/og";

export const alt = "PropFolios Intelligence: institutional real estate advisory for UAE and India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0A1F44", padding: 80, color: "#FFFFFF" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, letterSpacing: 6, fontWeight: 600 }}>PROPFOLIOS</div>
          <div style={{ width: 120, height: 2, background: "#C9A961", marginTop: 10 }} />
          <div style={{ fontSize: 14, letterSpacing: 10, marginTop: 10, color: "#E8EDF5" }}>INTELLIGENCE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, lineHeight: 1.1, fontFamily: "serif", maxWidth: 900 }}>Institutional intelligence for private capital.</div>
          <div style={{ fontSize: 26, marginTop: 24, color: "#E8EDF5" }}>Research, underwriting and portfolio monitoring for UAE and India real estate.</div>
        </div>
      </div>
    ),
    size,
  );
}
