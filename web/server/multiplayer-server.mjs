import { WebSocketServer } from "ws";

const PORT = 8787;
const MAX_HUMAN_PLAYERS = 10;
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
 */

/** @type {Map<string, Map<string, PlayerState>>} */
const sessions = new Map();
/** @type {Map<import("ws").WebSocket, { id: string; city: string }>} */
const sockets = new Map();

function ensureSession(city) {
  if (!sessions.has(city)) sessions.set(city, new Map());
  return sessions.get(city);
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
        if (players.size >= MAX_HUMAN_PLAYERS) {
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
    broadcastCity(city);
  }
}, 90);

console.log(`Multiplayer server running on ws://localhost:${PORT}`);
