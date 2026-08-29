import { ImageResponse } from "next/og";

export const runtime = "edge";

const buildings = [
  [48, 180], [74, 250], [52, 205], [88, 325], [60, 230], [96, 390],
  [62, 280], [82, 350], [56, 245], [104, 415], [72, 305], [90, 365],
];

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #07090b 0%, #0b0e11 52%, #050607 100%)",
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.18, backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)", backgroundSize: "4px 4px" }} />

      <div style={{ position: "absolute", right: 38, bottom: 80, height: 420, width: 610, display: "flex", alignItems: "flex-end", gap: 8, opacity: 0.33 }}>
        {buildings.map(([w, h], i) => (
          <div key={i} style={{ width: w, height: h, display: "flex", background: i % 3 === 0 ? "#1a1d20" : "#14171a", borderTop: "1px solid #2a2e32", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.018)" }} />
        ))}
      </div>

      <div style={{ position: "absolute", left: -100, top: 115, width: 410, height: 2, display: "flex", background: "#b10d12", transform: "rotate(-50deg)", opacity: 0.9 }} />
      <div style={{ position: "absolute", right: -120, top: 105, width: 430, height: 2, display: "flex", background: "#8e1116", transform: "rotate(-48deg)", opacity: 0.7 }} />
      <div style={{ position: "absolute", right: -30, bottom: 108, width: 440, height: 5, display: "flex", background: "linear-gradient(90deg, rgba(192,13,18,0), #d51218 48%, #ff2b32 100%)", transform: "rotate(-19deg)", boxShadow: "0 0 18px rgba(255,26,32,.65)" }} />
      <div style={{ position: "absolute", right: -5, bottom: 72, width: 350, height: 2, display: "flex", background: "linear-gradient(90deg, rgba(192,13,18,0), #a50e13 60%, #e62026 100%)", transform: "rotate(-17deg)" }} />

      <div style={{ position: "absolute", left: 38, top: 30, width: 78, display: "flex", gap: 12 }}>
        {[0, 1, 2, 3].map((n) => <div key={n} style={{ width: 3, height: 3, display: "flex", background: "#c51016" }} />)}
      </div>

      <div style={{ position: "relative", marginTop: -8, width: 1040, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", letterSpacing: "-8px", lineHeight: 1 }}>
          <span style={{ fontSize: 138, fontWeight: 900, color: "#f1f1ef", textShadow: "0 4px 0 rgba(0,0,0,.5)" }}>Street</span>
          <span style={{ fontSize: 138, fontWeight: 900, color: "#d10f16", textShadow: "0 4px 0 rgba(0,0,0,.5)" }}>Scope</span>
        </div>

        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 95, height: 2, display: "flex", background: "#bd1117" }} />
          <div style={{ fontSize: 31, fontWeight: 700, letterSpacing: "9px", color: "#ededeb", whiteSpace: "nowrap" }}>NEWS THAT HITS HOME</div>
          <div style={{ width: 95, height: 2, display: "flex", background: "#bd1117" }} />
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", boxShadow: "inset 0 0 150px rgba(0,0,0,.72)" }} />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
