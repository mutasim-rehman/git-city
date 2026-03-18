/**
 * Shared UI theme: black, pink, purple, baby blue
 */
export const THEME = {
  bg: {
    base: "#0a0a0f",
    dark: "#050508",
    card: "rgba(0,0,0,0.55)",
    cardHover: "rgba(168,85,247,0.08)",
  },
  accent: {
    pink: "#ec4899",
    pinkLight: "#f472b6",
    pinkMuted: "#f9a8d4",
    purple: "#a855f7",
    purpleLight: "#c084fc",
    purpleMuted: "#d8b4fe",
    blue: "#7dd3fc",
    blueMid: "#38bdf8",
    blueBright: "#0ea5e9",
  },
  text: {
    primary: "#f8fafc",
    secondary: "rgba(248,250,252,0.8)",
    muted: "rgba(248,250,252,0.6)",
    label: "rgba(236,72,153,0.9)",
    labelMuted: "rgba(168,85,247,0.7)",
  },
  border: {
    default: "rgba(168,85,247,0.35)",
    subtle: "rgba(168,85,247,0.25)",
    glow: "rgba(236,72,153,0.4)",
  },
  gradient: {
    bg: "from-black via-purple-950/40 to-pink-950/50",
    glow: "rgba(236,72,153,0.2)",
    glowPurple: "rgba(168,85,247,0.25)",
  },
} as const;
