import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";

export const alt =
  "AcornArranger – Housekeeping scheduling for vacation rentals";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (hex — must be hardcoded; no Tailwind/CSS vars in ImageResponse)
const TEAL = "#12a1b7";
const TEAL_DARK = "#0d7282";
const DEEP = "#063237";

export default async function Image() {
  const iconData = await readFile(join(process.cwd(), "app/icon.png"));
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, ${DEEP} 0%, ${TEAL} 100%)`,
        padding: "72px 80px",
        position: "relative",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: TEAL_DARK,
          display: "flex",
        }}
      />

      {/* Logo row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          marginBottom: "52px",
        }}
      >
        <img
          src={iconSrc}
          width={100}
          height={100}
          alt=""
          style={{ borderRadius: "12px" }}
        />
        <span
          style={{
            fontSize: "34px",
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.015em",
          }}
        >
          AcornArranger
        </span>
      </div>

      {/* Main headline */}
      <div
        style={{
          display: "flex",
          fontSize: "62px",
          fontWeight: 800,
          color: "white",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          maxWidth: "880px",
        }}
      >
        Smarter scheduling for vacation rental teams
      </div>

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          marginTop: "28px",
          fontSize: "26px",
          color: "rgba(255, 255, 255, 0.72)",
          lineHeight: 1.45,
          maxWidth: "800px",
        }}
      >
        Build daily plans · Align with Homebase · Send to ResortCleaning
      </div>

      {/* Bottom URL badge */}
      <div
        style={{
          position: "absolute",
          bottom: "56px",
          right: "80px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "100px",
          padding: "10px 22px",
        }}
      >
        <span
          style={{
            fontSize: "20px",
            color: "rgba(255, 255, 255, 0.85)",
            fontWeight: 500,
          }}
        >
          acornarranger.com
        </span>
      </div>
    </div>,
    size,
  );
}
