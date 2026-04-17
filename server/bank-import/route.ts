/**
 * bank-import/route.ts
 *
 * POST /api/import/bank-notification
 *
 * Вызывается из iOS Shortcuts при получении уведомления от Т-Банка или Сбера.
 * Аутентификация: Bearer PAT (Personal Access Token из /api/pat/create).
 *
 * Body:
 * {
 *   "message": "Покупка 450.00 руб. MAGNIT 1234 Карта *5678",
 *   "bank": "tbank",           // опционально: "tbank" | "sber"
 *   "cardLast4": "5678"        // опционально — если Shortcuts умеет извлекать
 * }
 *
 * Response 200:
 * {
 *   "ok": true,
 *   "transactionId": 42,
 *   "matched": {
 *     "merchantName": "Магнит",
 *     "externalCategory": "Продукты",
 *     "categoryId": 3,
 *     "categoryName": "Еда",
 *     "accountId": 1,
 *     "gisFound": true
 *   }
 * }
 */

import { Router } from "express";
import { z } from "zod";
import { patOrJwtMiddleware, type AuthRequest } from "../auth";
import { processNotification } from "./pipeline";

const router = Router();

const bodySchema = z.object({
  message:    z.string().min(1).max(2000),
  bank:       z.enum(["tbank", "sber"]).optional(),
  cardLast4:  z.string().length(4).regex(/^\d{4}$/).optional(),
});

router.post("/", patOrJwtMiddleware, async (req: AuthRequest, res) => {
  // Подключаем хранилище лениво (так же как в routes.ts)
  let pg: import("../storage-pg").PgStorage | null = null;
  if (process.env.DATABASE_URL) {
    try {
      const { pgStorage } = await import("../storage-pg");
      pg = pgStorage;
    } catch {}
  }
  if (!pg) {
    return res.status(503).json({ error: "Database not configured. PostgreSQL required." });
  }

  // Debug: log what actually arrived
  console.log("[bank-import] incoming body:", JSON.stringify(req.body));
  console.log("[bank-import] content-type:", req.headers["content-type"]);

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    console.log("[bank-import] validation failed:", issues);
    return res.status(400).json({ error: issues });
  }

  const { message, bank, cardLast4 } = parsed.data;
  const userId = req.userId!;

  try {
    const result = await processNotification(pg, userId, message, bank, cardLast4);

    if (!result.ok) {
      return res.status(422).json({ error: result.error });
    }

    return res.json({
      ok: true,
      transactionId: (result.transaction as any).id,
      matched: result.matched,
    });
  } catch (e: any) {
    console.error("[bank-import] pipeline error:", e.message);
    return res.status(500).json({ error: "Internal server error", detail: e.message });
  }
});

export default router;
