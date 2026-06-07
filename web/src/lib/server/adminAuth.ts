import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ensureEnvLoaded } from "./loadEnv";

export const ADMIN_COOKIE = "gc_admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

function adminCredentials() {
  ensureEnvLoaded();
  return {
    name: process.env.ADMIN_NAME ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
  };
}

export function createAdminSessionToken(): string {
  const { name, password } = adminCredentials();
  if (!name || !password) return "";
  return createHmac("sha256", password).update(`admin:${name}`).digest("hex");
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const creds = adminCredentials();
  if (!creds.name || !creds.password) return false;
  const userOk = username === creds.name;
  const passOk = password === creds.password;
  return userOk && passOk;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = createAdminSessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  try {
    const a = Buffer.from(value, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
