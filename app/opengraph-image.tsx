import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "FillMate - Never argue about who filled the bottles";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AQUA = "#1aa6b7";
const SOFT = "#3fc3d0";
const MUTED = "#6c7a8d";
const LINE = "#1e2632";

type Style = Record<string, string | number>;

/** Satori requires an explicit display on any element with >1 child. */
const box = (style: Style) => ({ display: "flex" as const, ...style });

function Bottle({ filled }: { filled: boolean }) {
  return (
    <svg width={50} height={108} viewBox="0 0 24 60" fill="none">
      <path
        d="M9 2h6v7l4.2 7.4A6 6 0 0 1 20.4 22v30a6 6 0 0 1-6 6H9.6a6 6 0 0 1-6-6V22a6 6 0 0 1 1.2-5.6L9 9V2Z"
        fill={filled ? SOFT : "none"}
        stroke={filled ? SOFT : "#3b4653"}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={box({
          width: "100%",
          height: "100%",
          background: "#0b1220",
          color: "#f6f7f8",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        })}
      >
        <div
          style={box({
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, #0d8f9e 0%, transparent 46%)",
            opacity: 0.32,
          })}
        />
        <div
          style={box({ position: "absolute", left: 0, bottom: 0, width: "100%", height: 7, background: AQUA })}
        />

        <div style={box({ flexDirection: "column", justifyContent: "center", padding: "66px 74px", width: 690 })}>
          <div style={box({ alignItems: "center", gap: 14 })}>
            <Bottle filled />
            <span style={box({ fontSize: 32, fontWeight: 600, letterSpacing: "-0.5px" })}>
              FillMate
            </span>
          </div>
          <div
            style={box({
              flexDirection: "column",
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-2px",
              marginTop: 34,
            })}
          >
            Never argue about who filled the bottles.
          </div>
          <div style={box({ fontSize: 22, color: "#9fadbf", marginTop: 22, lineHeight: 1.4 })}>
            One photo. AI verifies it. Everyone stays informed.
          </div>
        </div>

        <div style={box({ alignItems: "center", justifyContent: "center", width: 510 })}>
          <div
            style={box({
              flexDirection: "column",
              gap: 20,
              width: 340,
              background: "#121a24",
              border: `1px solid ${LINE}`,
              borderRadius: 20,
              padding: 30,
            })}
          >
            <div
              style={box({
                justifyContent: "space-between",
                fontSize: 14,
                color: "#9fadbf",
                textTransform: "uppercase",
                letterSpacing: 1.4,
              })}
            >
              <span style={box({})}>Water status</span>
              <span style={box({ color: "#e8b44f", letterSpacing: 0, textTransform: "none" })}>
                Refill needed
              </span>
            </div>

            <div style={box({ alignItems: "flex-end", justifyContent: "space-between" })}>
              <div style={box({ flexDirection: "column" })}>
                <div style={box({ alignItems: "baseline", fontSize: 58, fontWeight: 600, letterSpacing: "-2px" })}>
                  <span style={box({ fontSize: 58, fontWeight: 600 })}>3</span>
                  <span style={box({ fontSize: 26, color: MUTED })}>/ 4</span>
                </div>
                <span style={box({ fontSize: 16, color: MUTED, marginTop: 8 })}>
                  75% of today&apos;s target
                </span>
              </div>
              <div style={box({ gap: 6, alignItems: "flex-end" })}>
                <Bottle filled />
                <Bottle filled />
                <Bottle filled />
                <Bottle filled={false} />
              </div>
            </div>

            <div style={box({ height: 8, borderRadius: 999, background: LINE, marginTop: 24 })}>
              <div style={box({ width: "75%", height: "100%", background: SOFT, borderRadius: 999 })} />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}