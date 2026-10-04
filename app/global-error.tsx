"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAFAF9", color: "#0A0A0A", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6B7280" }}>Nakhla</p>
          <h1 style={{ fontSize: 24, color: "#0A1F44", fontWeight: 500 }}>The application could not start.</h1>
          <p style={{ fontSize: 14, color: "#374151" }}>The error has been logged. Retry in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 36, padding: "0 16px", borderRadius: 6, border: 0, background: "#0A1F44", color: "#fff", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
