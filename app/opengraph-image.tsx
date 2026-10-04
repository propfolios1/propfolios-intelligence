import { ImageResponse } from "next/og";

export const alt = "Nakhla: the AI-native operating system for real estate brokerages";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0A1F44", padding: 80, color: "#FFFFFF" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 8, fontWeight: 600 }}>NAKHLA</div>
          <div style={{ width: 120, height: 2, background: "#C9A961", marginTop: 12 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, lineHeight: 1.1, fontFamily: "serif", maxWidth: 900 }}>The operating system for real estate brokerages.</div>
          <div style={{ fontSize: 26, marginTop: 24, color: "#E8EDF5" }}>Leads, listings, research, deals, commissions and client servicing, powered by AI agents. Six markets.</div>
        </div>
      </div>
    ),
    size,
  );
}
