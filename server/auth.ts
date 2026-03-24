/**
 * Auth utilities: password hashing (pbkdf2), JWT, PAT.
 *
 * Два способа аутентификации:
 *   1. JWT в httpOnly cookie  — браузер / веб-приложение
 *   2. PAT в Bearer-заголовке — iOS Shortcuts, Scriptable, внешние клиенты
 *
 * patOrJwtMiddleware — универсальный guard для всех защищённых эндпоинтов.
 * Порядок проверки:
 *   1. Cookie finwise_token → JWT
 *   2. Authorization: Bearer finwise_pat_* → PAT (запрос в БД)
 *   3. Authorization: Bearer <jwt> → JWT (для совместимости)
 */

import { createHmac, randomBytes, timingSafeEqual, pbkdf2 } from "crypto";
import { eq, and } from "drizzle-orm";

// ─── PASSWORD HASHING (PBKDF2-HMAC-SHA256, 310000 iterations) ─────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
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

// ─── JWT (manual HS256, no external deps) ───────────────────────────────────

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface JwtPayload {
  sub: number;
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
    createHmac("sha256", JWT_SECRET()).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = base64url(
      createHmac("sha256", JWT_SECRET()).update(`${header}.${payload}`).digest()
    );
    if (sig !== expectedSig) return null;
    const decoded: JwtPayload = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── PAT ──────────────────────────────────────────────────────────────────────────────
//
// Формат: finwise_pat_<64 hex-символа> (криптостойкий, 2^256 комбинаций)
// Токен возвращается клиенту один раз в момент создания — далее хранится в БД в открытом виде.
// TODO: если надо будет усилить безопасность — хранить SHA-256 хеш вместо плейнтекста.

/** Генерирует новый PAT. Вызывать только при создании, хранить в БД. */
export function generatePAT(): string {
  return "finwise_pat_" + randomBytes(32).toString("hex");
}

// ─── EXPRESS MIDDLEWARE ────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * Оригинальный middleware для браузерных сессий (JWT в cookie).
 * Оставлен для обратной совместимости. Для защиты эндпоинтов используй patOrJwtMiddleware.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.["finwise_token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
  req.userId = payload.sub;
  next();
}

/**
 * Универсальный guard: принимает JWT-cookie И PAT в Bearer.
 *
 * Порядок проверки:
 *   1. Cookie finwise_token → проверить JWT → если ок → next()
 *   2. Authorization: Bearer finwise_pat_* → проверить PAT в БД → если ок → next()
 *   3. Authorization: Bearer <другое> → попытка JWT из Bearer → если ок → next()
 *   4. Всё провалилось → 401
 *
 * Импортирует db лениво (только если есть PAT в заголовке), чтобы не тянуть БД на жизнь при обычных cookie-запросах.
 */
export function patOrJwtMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // 1. JWT в cookie (браузер) — самый быстрый путь, БД не нужна
  const cookieToken = req.cookies?.["finwise_token"];
  if (cookieToken) {
    const payload = verifyJwt(cookieToken);
    if (payload) {
      req.userId = payload.sub;
      return next();
    }
  }

  // 2. Bearer в Authorization-заголовке
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const bearerToken = authHeader.slice(7);

  // 2a. PAT (начинается с finwise_pat_) — проверка через БД асинхронно
  if (bearerToken.startsWith("finwise_pat_")) {
    import("./db").then(({ db }) => {
      import("@shared/schema").then(({ personalAccessTokens }) => {
        db.select()
          .from(personalAccessTokens)
          .where(eq(personalAccessTokens.token, bearerToken))
          .limit(1)
          .then(rows => {
            if (!rows || rows.length === 0) {
              return res.status(401).json({ error: "Invalid PAT" });
            }
            const pat = rows[0];
            if (pat.revokedAt) {
              return res.status(401).json({ error: "Token has been revoked" });
            }
            if (new Date() > new Date(pat.expiresAt)) {
              return res.status(401).json({ error: "Token has expired" });
            }
            // Обновляем lastUsedAt асинхронно (не блокируем запрос)
            db.update(personalAccessTokens)
              .set({ lastUsedAt: new Date().toISOString() })
              .where(eq(personalAccessTokens.id, pat.id))
              .catch(() => {});
            req.userId = pat.userId;
            next();
          })
          .catch(() => res.status(500).json({ error: "Auth error" }));
      });
    });
    return;
  }

  // 2b. JWT в Bearer (для обратной совместимости)
  const payload = verifyJwt(bearerToken);
  if (payload) {
    req.userId = payload.sub;
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

export function setCookieToken(res: Response, token: string) {
  res.cookie("finwise_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearCookieToken(res: Response) {
  res.clearCookie("finwise_token", { path: "/" });
}
