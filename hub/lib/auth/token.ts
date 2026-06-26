// Isomorphic signed-token helpers (Web Crypto HMAC-SHA256). Works in BOTH the Edge
// middleware runtime and the Node server runtime, so the middleware and the
// server-side getSession() verify cookies the exact same way.
//
// The token is an opaque, tamper-evident bearer of the user id only — no role or
// permission is encoded, so privileges always derive from server-side profile
// data + policy.ts, never from anything the client can edit.
//
// Format: base64url(payload).base64url(hmac(payload))  where payload = `${userId}.${issuedAtMs}`.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const DEV_SECRET = "gt-hub-dev-only-insecure-secret-do-not-use-in-prod";
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Dev fallback so the app runs out-of-the-box without a configured secret.
  if (process.env.AUTH_DEV_MODE === "true" || process.env.NODE_ENV !== "production") {
    return DEV_SECRET;
  }
  throw new Error(
    "AUTH_SECRET must be set to a value of at least 16 characters in production " +
      "(or enable AUTH_DEV_MODE=true for local dev).",
  );
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function encodeString(value: string): string {
  return bytesToBase64url(encoder.encode(value));
}

function decodeString(value: string): string {
  return decoder.decode(base64urlToBytes(value));
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToBase64url(new Uint8Array(signature));
}

// Constant-time string comparison to avoid leaking the signature via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function signToken(userId: string, issuedAtMs = Date.now()): Promise<string> {
  const payload = encodeString(`${userId}.${issuedAtMs}`);
  const signature = await hmac(payload);
  return `${payload}.${signature}`;
}

/** Returns the userId if the token is well-formed and the signature verifies, else null. */
export async function verifyToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = await hmac(payload);
  } catch {
    return null;
  }
  if (!safeEqual(signature, expected)) return null;

  try {
    const decoded = decodeString(payload);
    const [userId, issuedAtRaw] = decoded.split(".");
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) return null;
    const ageMs = Date.now() - issuedAt;
    if (ageMs < 0 || ageMs > TOKEN_MAX_AGE_MS) return null;
    return userId || null;
  } catch {
    return null;
  }
}
