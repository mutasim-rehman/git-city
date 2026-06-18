import type { BuildingFieldStyle } from "../types";

export interface FieldStyleMeta {
  key: BuildingFieldStyle;
  label: string;
  emoji: string;
  /** Facade tint (hex) — whimsical but readable at city scale. */
  facade: string;
  /** Accent for glowing props / trim. */
  accent: string;
  /** Roof cap color. */
  roof: string;
}

const FIELD_ALIASES: Array<{ match: RegExp; style: BuildingFieldStyle }> = [
  { match: /data\s*scien|analytics|statistic/i, style: "data_science" },
  { match: /full\s*stack|fullstack/i, style: "full_stack" },
  { match: /front\s*end|frontend|react|vue|angular|ui\s*dev/i, style: "frontend" },
  { match: /back\s*end|backend|api|server|database|dba/i, style: "backend" },
  { match: /\bai\b|machine\s*learn|deep\s*learn|\bml\b|nlp|neural/i, style: "ai_ml" },
  { match: /cyber|security|infosec|pentest|ethical\s*hack/i, style: "cybersecurity" },
  { match: /devops|sre|cloud|infra|kubernetes|docker|platform/i, style: "devops" },
  { match: /mobile|android|ios|flutter|react\s*native/i, style: "mobile" },
  { match: /game\s*dev|gamedev|unity|unreal/i, style: "game_dev" },
  { match: /block\s*chain|web\s*3|web3|crypto|solidity|defi/i, style: "blockchain" },
  { match: /ui\/?ux|design|figma|product\s*design|graphic/i, style: "design" },
];

export const FIELD_STYLE_META: Record<BuildingFieldStyle, FieldStyleMeta> = {
  data_science: {
    key: "data_science",
    label: "Data Science",
    emoji: "🔭",
    facade: "#8b9dc3",
    accent: "#7dd3fc",
    roof: "#1e3a5f",
  },
  full_stack: {
    key: "full_stack",
    label: "Full Stack",
    emoji: "🏰",
    facade: "#a8a29e",
    accent: "#fbbf24",
    roof: "#44403c",
  },
  frontend: {
    key: "frontend",
    label: "Frontend",
    emoji: "🎨",
    facade: "#f9a8d4",
    accent: "#fb7185",
    roof: "#831843",
  },
  backend: {
    key: "backend",
    label: "Backend",
    emoji: "🖥️",
    facade: "#64748b",
    accent: "#22d3ee",
    roof: "#0f172a",
  },
  ai_ml: {
    key: "ai_ml",
    label: "AI / ML",
    emoji: "🧠",
    facade: "#a78bfa",
    accent: "#c084fc",
    roof: "#3b0764",
  },
  cybersecurity: {
    key: "cybersecurity",
    label: "Cybersecurity",
    emoji: "🛡️",
    facade: "#4ade80",
    accent: "#34d399",
    roof: "#14532d",
  },
  devops: {
    key: "devops",
    label: "DevOps / Cloud",
    emoji: "☁️",
    facade: "#94a3b8",
    accent: "#38bdf8",
    roof: "#1e293b",
  },
  mobile: {
    key: "mobile",
    label: "Mobile",
    emoji: "📱",
    facade: "#67e8f9",
    accent: "#2dd4bf",
    roof: "#134e4a",
  },
  game_dev: {
    key: "game_dev",
    label: "Game Dev",
    emoji: "🎮",
    facade: "#f472b6",
    accent: "#facc15",
    roof: "#701a75",
  },
  blockchain: {
    key: "blockchain",
    label: "Blockchain / Web3",
    emoji: "⛓️",
    facade: "#fcd34d",
    accent: "#f59e0b",
    roof: "#78350f",
  },
  design: {
    key: "design",
    label: "UI/UX / Design",
    emoji: "✏️",
    facade: "#fbcfe8",
    accent: "#f9a8d4",
    roof: "#9d174d",
  },
  other: {
    key: "other",
    label: "Other",
    emoji: "🏠",
    facade: "#d6d3d1",
    accent: "#a3e635",
    roof: "#57534e",
  },
};

export function normalizeBuildingField(raw: string | null | undefined): {
  style: BuildingFieldStyle;
  label: string;
} {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { style: "other", label: FIELD_STYLE_META.other.label };
  }

  for (const { match, style } of FIELD_ALIASES) {
    if (match.test(trimmed)) {
      return { style, label: FIELD_STYLE_META[style].label };
    }
  }

  return { style: "other", label: trimmed };
}

export function fieldDisplayLabel(building: { field: string; fieldStyle: BuildingFieldStyle }): string {
  if (building.field.trim()) return building.field.trim();
  return FIELD_STYLE_META[building.fieldStyle].label;
}

export function fieldEmoji(fieldStyle: BuildingFieldStyle): string {
  return FIELD_STYLE_META[fieldStyle].emoji;
}
