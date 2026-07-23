import { ImageResponse } from "next/og";

export const alt = "Ping250 - Send a test. Get a 250.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0a0e12";
const PHOSPHOR = "#1fe07a";
const PAPER = "#e8f0ec";
const MUTED = "#7d8a83";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          padding: "72px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 12,
              border: `2px solid ${PHOSPHOR}55`,
              backgroundColor: `${PHOSPHOR}18`,
              color: PHOSPHOR,
              fontSize: 30,
            }}
          >
            {">_"}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
            SMTP · Nodemailer · test client
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 132, fontWeight: 700, color: PAPER, lineHeight: 1 }}>
            Ping<span style={{ color: PHOSPHOR }}>250</span>
          </div>
          <div style={{ display: "flex", fontSize: 40, color: MUTED, marginTop: 16 }}>
            Send a test. Get a 250.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: `1px solid ${PHOSPHOR}33`,
            borderRadius: 12,
            backgroundColor: "#0d1319",
            padding: "28px 32px",
            fontSize: 30,
          }}
        >
          <div style={{ display: "flex", color: MUTED }}>
            <span style={{ color: PHOSPHOR }}>›</span>&nbsp;verify smtp.gmail.com:465
          </div>
          <div style={{ display: "flex", color: PHOSPHOR }}>✓ 250 2.0.0 OK - connection verified</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
