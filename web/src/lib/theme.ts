/**
 * Shared UI theme: blocky black & green (Git City)
 */
export const THEME = {
  bg: {
    base: "#0d1117",
    dark: "#010409",
    card: "#161b22",
    cardHover: "#21262d",
  },
  accent: {
    green: "#22c55e",
    greenLight: "#7ee787",
    greenMuted: "#238636",
    greenDark: "#14532d",
    slate: "#30363d",
    slateLight: "#484f58",
  },
  text: {
    primary: "#e6edf3",
    secondary: "#c9d1d9",
    muted: "#484f58",
    label: "#7ee787",
    labelMuted: "#238636",
  },
  border: {
    default: "#238636",
    subtle: "#30363d",
    active: "#7ee787",
  },
  shadow: {
    block: "4px 4px 0 #010409",
    blockSm: "3px 3px 0 #010409",
  },
} as const;
