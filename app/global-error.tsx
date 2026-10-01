"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f6f7f8",
          color: "#0b1220",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            FillMate hit a snag
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#4a5566", marginTop: "10px" }}>
            Reload the page and try again. If it keeps happening, your activity data is
            safe.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "20px",
              background: "#0b1220",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}