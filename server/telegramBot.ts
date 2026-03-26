import { config } from 'dotenv';
import TelegramBot from "node-telegram-bot-api";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

config({ path: path.join(ROOT_DIR, '.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function isAdmin(chatId: number): boolean {
  return chatId === ADMIN_ID;
}

// Главное меню с кнопками
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔄 Rebuild сервера", callback_data: "rebuild" }],
      [{ text: "📊 Статус процессов", callback_data: "status" }],
      [{ text: "📋 Последние логи", callback_data: "logs" }],
    ]
  }
};

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "⛔ Доступ запрещён");

  bot.sendMessage(chatId,
    `👋 *MoneyCheck Control Panel*\n\n` +
    `Управляй сервером прямо из Telegram.\n` +
    `Выбери действие:`,
    { parse_mode: "Markdown", ...mainMenu }
  );
});

// Парсим статус PM2 в красивый формат
function formatStatus(raw: string): string {
  const lines = raw.split('\n').filter(l => l.includes('online') || l.includes('stopped') || l.includes('errored'));
  if (!lines.length) return '❓ Нет данных';

  return lines.map(line => {
    const isOnline = line.includes('online');
    const isStopped = line.includes('stopped');
    const isErrored = line.includes('errored');

    const icon = isOnline ? '🟢' : isErrored ? '🔴' : '🟡';
    const nameMatch = line.match(/│\s+\d+\s+│\s+(\S+)/);
    const memMatch = line.match(/(\d+(?:\.\d+)?mb)/i);
    const uptimeMatch = line.match(/│\s+(\d+[smhd])\s+│/);

    const name = nameMatch?.[1] ?? 'unknown';
    const mem = memMatch?.[1] ?? '—';
    const uptime = uptimeMatch?.[1] ?? '—';

    return `${icon} *${name}* — ${isOnline ? 'online' : isStopped ? 'stopped' : 'error'}\n   ⏱ uptime: ${uptime} | 💾 mem: ${mem}`;
  }).join('\n\n');
}

// Обработка inline-кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const msgId = query.message!.message_id;

  if (!isAdmin(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "⛔ Доступ запрещён" });
    return;
  }

  bot.answerCallbackQuery(query.id);

  if (query.data === "status") {
    exec("pm2 list --no-color", (_, stdout) => {
      const formatted = formatStatus(stdout);
      bot.editMessageText(
        `📊 *Статус серверов*\n\n${formatted}\n\n_Обновлено только что_`,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    });
  }

  if (query.data === "logs") {
    exec("pm2 logs moneycheck --nostream --lines 20 --no-color", (_, stdout, stderr) => {
      const output = (stdout || stderr).slice(-1500);
      bot.editMessageText(
        `📋 *Последние логи moneycheck*\n\n\`\`\`\n${output}\n\`\`\``,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    });
  }

  if (query.data === "rebuild") {
    bot.editMessageText(
      `⏳ *Rebuild запущен...*\n\n\`git pull → build → restart\`\n\nЭто займёт ~30-60 секунд`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
    );

    const start = Date.now();
    exec(`cd ${ROOT_DIR} && npm run rebuild`, { timeout: 180000 }, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);

      if (error) {
        bot.editMessageText(
          `❌ *Rebuild завершился с ошибкой* (${elapsed}s)\n\n\`\`\`\n${(stderr || error.message).slice(-1000)}\n\`\`\``,
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
        );
        return;
      }

      bot.editMessageText(
        `✅ *Сервер успешно пересобран!*\n\n⏱ Время: ${elapsed} сек\n\nВсе изменения применены и сервер перезапущен.`,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    });
  }

  if (query.data === "menu") {
    bot.editMessageText(
      `👋 *MoneyCheck Control Panel*\n\nВыбери действие:`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
    );
  }
});

console.log("🤖 Telegram Bot запущен");
export default bot;
