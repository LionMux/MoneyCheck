/**
 * Background scheduler — runs periodic checks for:
 *  1. Budget overruns
 *  2. Credit card due date reminders
 *  3. Inactivity alerts (no transactions in 7+ days)
 *
 * Runs every hour in production, skipped in memory-only mode.
 */

import { format, differenceInDays } from "date-fns";
import type { PgStorage } from "./storage-pg";

const log = (msg: string) => console.log(`[scheduler] ${msg}`);

export async function runNotificationChecks(storage: PgStorage): Promise<void> {
  log("Running notification checks...");

  let users: Awaited<ReturnType<PgStorage["getAllUsersForCron"]>>;
  try {
    users = await storage.getAllUsersForCron();
  } catch (e) {
    log("DB not available, skipping");
    return;
  }

  for (const user of users) {
    try {
      await checkInactivity(storage, user.id, user.notifyInactivity);
      await checkCreditDue(storage, user.id, user.notifyCredit);
    } catch (e) {
      log(`Error for user ${user.id}: ${(e as Error).message}`);
    }
  }

  log("Notification checks complete");
}

async function checkInactivity(storage: PgStorage, userId: number, enabled: boolean): Promise<void> {
  if (!enabled) return;
  const lastTx = await storage.getUserLastTransaction(userId);
  if (!lastTx) return;
  const daysSince = differenceInDays(new Date(), new Date(lastTx.date));
  if (daysSince >= 7) {
    const existing = await storage.getNotifications(userId);
    const recentInactivity = existing.find(
      n => n.type === "inactivity" && differenceInDays(new Date(), new Date(n.sentAt)) < 1
    );
    if (!recentInactivity) {
      await storage.addNotification(
        userId,
        "inactivity",
        "push",
        `Вы не добавляли операции ${daysSince} дней. Не забудьте записать расходы!`
      );
    }
  }
}

async function checkCreditDue(storage: PgStorage, userId: number, enabled: boolean): Promise<void> {
  if (!enabled) return;
  const accounts = await storage.getAccounts(userId);
  const creditAccounts = accounts.filter(a => a.type === "credit" && a.dueDay);

  for (const acc of creditAccounts) {
    const today = new Date();
    const dueDay = acc.dueDay!;
    const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
    const daysUntilDue = differenceInDays(thisMonthDue, today);

    if (daysUntilDue === 3 || daysUntilDue === 1) {
      const debt = await storage.getCreditDebt(acc.id);
      if (debt < 0) { // has outstanding debt
        const existing = await storage.getNotifications(userId);
        const recent = existing.find(
          n => n.type === "credit_due" &&
               n.message.includes(acc.name) &&
               differenceInDays(new Date(), new Date(n.sentAt)) < 1
        );
        if (!recent) {
          await storage.addNotification(
            userId,
            "credit_due",
            "push",
            `Через ${daysUntilDue} ${daysUntilDue === 1 ? "день" : "дня"} платёж по кредитной карте «${acc.name}». Задолженность: ${Math.abs(debt).toLocaleString("ru-RU")} ₽`
          );
        }
      }
    }
  }
}

/** Start hourly interval. Call once on server start. */
export function startScheduler(storage: PgStorage): void {
  // Run immediately on start
  setTimeout(() => runNotificationChecks(storage), 5000);
  // Then every hour
  setInterval(() => runNotificationChecks(storage), 60 * 60 * 1000);
  log("Scheduler started (hourly)");
}
