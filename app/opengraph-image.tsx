import { ImageResponse } from "next/og";

export const alt = "Partsaur — Find the part. Sell the dead stock.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#101217",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 900 }}>
          Parts<span style={{ color: "#f97316" }}>aur</span>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 84, fontWeight: 900, lineHeight: 1.05 }}>
          Find the part.
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 900, lineHeight: 1.05, color: "#f97316" }}>
          Sell the dead stock.
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 32, color: "#a1a1aa" }}>
          Overstock, dead stock &amp; obsolete parts — HVAC/R, electrical, plumbing &amp; more.
        </div>
      </div>
    ),
    size,
  );
}
