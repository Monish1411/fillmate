
/** Web app manifest - makes FillMate installable on iOS, Android and desktop. */
export default function manifest() {
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return {
      id: "/app",
      name: "FillMate - Hostel Water Accountability",
      short_name: "FillMate",
      description:
        "Record a hostel water refill with one photo. AI verifies it and your room stays informed.",
      start_url: "/app",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      orientation: "portrait",
      background_color: "#f6f7f8",
      theme_color: "#0b1220",
      categories: ["productivity", "lifestyle", "utilities"],
      lang: "en",
      dir: "ltr",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      shortcuts: [
        {
          name: "Record refill",
          short_name: "Record",
          url: `${origin}/app?record=1`,
        },
        {
          name: "Room activity",
          short_name: "Activity",
          url: `${origin}/app/activity`,
        },
      ],
  };
}