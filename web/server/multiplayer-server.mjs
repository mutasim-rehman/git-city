import { WebSocketServer } from "ws";

const PORT = 8787;
const MAX_HUMAN_PLAYERS = 10;
const NPC_NAME = "mutasim";
const PLAYER_COLORS = [
  "#f43f5e",
  "#22d3ee",
  "#facc15",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#f59e0b",
  "#2dd4bf",
  "#e879f9",
];
const CITIES = ["lahore", "karachi", "islamabad"];
const CAR_VARIANTS = ["cm1", "cm2", "cm3", "cm4", "cm5", "cm6", "cm7"];

/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {string} city
 * @property {string} carVariant
 * @property {string} color
 * @property {number} x
 * @property {number} z
 * @property {number} yaw
 * @property {number} speed
 * @property {boolean=} isNpc
 */

/** @type {Map<string, Map<string, PlayerState>>} */
const sessions = new Map();
/** @type {Map<import("ws").WebSocket, { id: string; city: string }>} */
const sockets = new Map();

function ensureSession(city) {
  if (!sessions.has(city)) sessions.set(city, new Map());
  const players = sessions.get(city);
  const npcId = `npc-${city}`;
  if (!players.has(npcId)) {
    const npcAngle = Math.random() * Math.PI * 2;
    const npcRadius = 280 + Math.random() * 160;
    players.set(npcId, {
      id: npcId,
      name: NPC_NAME,
      city,
      carVariant: CAR_VARIANTS[Math.floor(Math.random() * CAR_VARIANTS.length)],
      color: "#f97316",
      x: Math.cos(npcAngle) * npcRadius,
      z: Math.sin(npcAngle) * npcRadius,
      yaw: npcAngle + Math.PI / 2,
      speed: 28,
      isNpc: true,
    });
  }
  return players;
}

function pickColor(players) {
  const used = new Set(Array.from(players.values()).map((p) => p.color));
  const free = PLAYER_COLORS.find((c) => !used.has(c));
  return free ?? PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

function broadcastCity(city) {
  const players = Array.from(ensureSession(city).values());
  const payload = JSON.stringify({ type: "state", players });
  for (const [ws, info] of sockets.entries()) {
    if (info.city !== city || ws.readyState !== ws.OPEN) continue;
    ws.send(payload);
  }
}

function removeSocket(ws) {
  const info = sockets.get(ws);
  if (!info) return;
  sockets.delete(ws);
  const session = sessions.get(info.city);
  if (session) {
    session.delete(info.id);
    broadcastCity(info.city);
  }
}

const wss = new WebSocketServer({ port: PORT });
for (const city of CITIES) ensureSession(city);

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "join") {
        const city = CITIES.includes(msg.city) ? msg.city : "islamabad";
        const name = String(msg.name || "guest").trim().slice(0, 24) || "guest";
        const carVariant = CAR_VARIANTS.includes(msg.carVariant) ? msg.carVariant : "cm1";
        const players = ensureSession(city);
        const humanCount = Array.from(players.values()).filter((p) => !p.isNpc).length;
        if (humanCount >= MAX_HUMAN_PLAYERS) {
          ws.send(JSON.stringify({ type: "error", message: "Session full (10 players max)." }));
          return;
        }
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + Math.random() * 140;
        players.set(id, {
          id,
          name,
          city,
          carVariant,
          color: pickColor(players),
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          yaw: angle + Math.PI,
          speed: 0,
        });
        sockets.set(ws, { id, city });
        ws.send(
          JSON.stringify({
            type: "welcome",
            selfId: id,
            players: Array.from(players.values()),
          }),
        );
        broadcastCity(city);
        return;
      }
      if (msg.type === "pose") {
        const info = sockets.get(ws);
        if (!info) return;
        const players = sessions.get(info.city);
        if (!players) return;
        const p = players.get(info.id);
        if (!p) return;
        p.x = Number(msg.x) || 0;
        p.z = Number(msg.z) || 0;
        p.yaw = Number(msg.yaw) || 0;
        p.speed = Number(msg.speed) || 0;
      }
    } catch {
      // ignore malformed messages
    }
  });
  ws.on("close", () => removeSocket(ws));
  ws.on("error", () => removeSocket(ws));
});

setInterval(() => {
  for (const city of CITIES) {
    const players = ensureSession(city);
    const npc = players.get(`npc-${city}`);
    if (!npc) continue;
    const radius = Math.max(150, Math.hypot(npc.x, npc.z));
    const angle = Math.atan2(npc.z, npc.x) + 0.0085;
    npc.x = Math.cos(angle) * radius;
    npc.z = Math.sin(angle) * radius;
    npc.yaw = angle + Math.PI / 2;
    npc.speed = 26;
    broadcastCity(city);
  }
}, 90);

console.log(`Multiplayer server running on ws://localhost:${PORT}`);
