/**
 * Auth utilities: password hashing (bcrypt), JWT generation/verification.
 * Token is stored in httpOnly cookie — no JS access, safe against XSS.
 */

import { createHmac, randomBytes, timingSafeEqual, pbkdf2 } from "crypto";

// ─── PASSWORD HASHING (pure Node crypto — no bcrypt dep needed) ───────────
// Uses PBKDF2-HMAC-SHA256 with 310000 iterations (NIST recommended)

export async function hashPassword(plaintext: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    // Node built-in pbkdf2
    pbkdf2(plaintext, salt, 310000, 32, "sha256", (err: Error | null, derivedKey: Buffer) => {
      if (err) return reject(err);
      resolve(`pbkdf2:${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(plaintext: string, hashed: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [, salt, keyHex] = hashed.split(":");
    pbkdf2(plaintext, salt, 310000, 32, "sha256", (err: Error | null, derivedKey: Buffer) => {
      if (err) return reject(err);
      try {
        const a = Buffer.from(derivedKey.toString("hex"));
        const b = Buffer.from(keyHex);
        resolve(a.length === b.length && timingSafeEqual(a, b));
      } catch {
        resolve(false);
      }
    });
  });
}

// ─── JWT (manual implementation — no jsonwebtoken dep) ────────────────────

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface JwtPayload {
  sub: number;     // userId
  iat: number;
  exp: number;
}

const JWT_SECRET = (): string => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return process.env.JWT_SECRET;
};

export function signJwt(userId: number, expiresInSeconds = 60 * 60 * 24 * 7): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: userId, iat: now, exp: now + expiresInSeconds }));
  const sig = base64url(
    createHmac("sha256", JWT_SECRET())
      .update(`${header}.${payload}`)
      .digest()
  );
  return `${header}.${payload}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = base64url(
      createHmac("sha256", JWT_SECRET())
        .update(`${header}.${payload}`)
        .digest()
    );
    if (sig !== expectedSig) return null;
    const decoded: JwtPayload = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── EXPRESS MIDDLEWARE ────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.["finwise_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  req.userId = payload.sub;
  next();
}

export function setCookieToken(res: Response, token: string) {
  res.cookie("finwise_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export function clearCookieToken(res: Response) {
  res.clearCookie("finwise_token", { path: "/" });
}
