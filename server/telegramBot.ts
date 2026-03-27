import { config } from 'dotenv';
import TelegramBot from "node-telegram-bot-api";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import si from 'systeminformation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

config({ path: path.join(ROOT_DIR, '.env') });
console.log("TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "✅ " +
  process.env.TELEGRAM_BOT_TOKEN.slice(0, 10) + "..." : "❌ пустой");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:12334');
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
  request: { agent: proxyAgent }
});

function isAdmin(chatId: number): boolean {
  return chatId === ADMIN_ID;
}

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔄 Rebuild сервера", callback_data: "rebuild" }],
      [{ text: "🤖 Restart tg-bot", callback_data: "restart_bot" }],
      [{ text: "📊 Статус процессов", callback_data: "status" }],
      [{ text: "🖥️ Железо сервера", callback_data: "stats" }],
      [{ text: "📋 Последние логи", callback_data: "logs" }],
    ]
  }
};

// ── Флаг-файл хранит chatId + msgId чтобы после рестарта отредактировать то же сообщение
const RESTART_FLAG = path.join(ROOT_DIR, '.bot_restarted');

if (fs.existsSync(RESTART_FLAG)) {
  try {
    const { chatId, msgId, elapsed } = JSON.parse(fs.readFileSync(RESTART_FLAG, 'utf-8'));
    fs.unlinkSync(RESTART_FLAG);
    setTimeout(() => {
      bot.editMessageText(
        `✅ *tg-bot успешно перезапущен!*\n\n⏱ Время: ${elapsed} сек\n🤖 Бот снова в сети.`,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    }, 2000);
  } catch {
    fs.unlinkSync(RESTART_FLAG);
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "⛔ Доступ запрещён");
  bot.sendMessage(chatId,
    `👋 *MoneyCheck Control Panel*\n\nУправляй сервером прямо из Telegram.\nВыбери действие:`,
    { parse_mode: "Markdown", ...mainMenu }
  );
});

function formatStatus(raw: string): string {
  const lines = raw.split('\n').filter(l => l.includes('online') || l.includes('stopped') || l.includes('errored'));
  if (!lines.length) return '❓ Нет данных';
  return lines.map(line => {
    const isOnline = line.includes('online');
    const isErrored = line.includes('errored');
    const icon = isOnline ? '🟢' : isErrored ? '🔴' : '🟡';
    const nameMatch = line.match(/│\s+\d+\s+│\s+(\S+)/);
    const memMatch = line.match(/(\d+(?:\.\d+)?mb)/i);
    const uptimeMatch = line.match(/│\s+(\d+[smhd])\s+│/);
    const name = nameMatch?.[1] ?? 'unknown';
    const mem = memMatch?.[1] ?? '—';
    const uptime = uptimeMatch?.[1] ?? '—';
    return `${icon} *${name}* — ${isOnline ? 'online' : isErrored ? 'error' : 'stopped'}\n   ⏱ uptime: ${uptime} | 💾 mem: ${mem}`;
  }).join('\n\n');
}

bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const msgId = query.message!.message_id;

  if (!isAdmin(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "⛔ Доступ запрещён" });
    return;
  }

  bot.answerCallbackQuery(query.id);

  if (query.data === "restart_bot") {
    const start = Date.now();

    bot.editMessageText(
      `⏳ *Restart tg-bot...*\n\n\`git pull → restart\`\n\nЖди сообщение о завершении...`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
    );

    // git pull перед рестартом
    exec(`cd ${ROOT_DIR} && git pull origin main`, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);

      if (error) {
        bot.editMessageText(
          `❌ *git pull завершился с ошибкой*\n\n\`\`\`\n${(stderr || error.message).slice(-800)}\n\`\`\``,
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
        );
        return;
      }

      // Сохраняем chatId, msgId и elapsed в флаг-файл
      fs.writeFileSync(RESTART_FLAG, JSON.stringify({ chatId, msgId, elapsed }));
      exec('pm2 restart tg-bot'); // бот умирает здесь
    });
    return;
  }

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

  if (query.data === "stats") {
    const [cpu, mem, temp, disk, load] = await Promise.all([
      si.cpu(), si.mem(), si.cpuTemperature(), si.fsSize(), si.currentLoad()
    ]);
    const memUsed = (mem.active / mem.total * 100).toFixed(1);
    const memUsedGb = (mem.active / 1024 / 1024 / 1024).toFixed(1);
    const memTotalGb = (mem.total / 1024 / 1024 / 1024).toFixed(1);
    const diskMain = disk[0];
    const diskUsed = diskMain ? diskMain.use.toFixed(1) : '—';
    const diskFreeGb = diskMain ? (diskMain.available / 1024 / 1024 / 1024).toFixed(1) : '—';
    const tempVal = temp.main > 0 ? `${temp.main}°C` : '—';
    const cpuLoad = load.currentLoad.toFixed(1);
    const time = si.time();
    const uptimeH = Math.floor(time.uptime / 3600);
    const uptimeM = Math.floor((time.uptime % 3600) / 60);
    bot.editMessageText(
      `🖥️ *Состояние сервера*\n\n` +
      `🔲 *CPU:* ${cpu.manufacturer} ${cpu.brand}\n` +
      `   ⚡ Нагрузка: ${cpuLoad}%\n` +
      `   🌡️ Температура: ${tempVal}\n\n` +
      `💾 *RAM:* ${memUsedGb} / ${memTotalGb} GB (${memUsed}%)\n\n` +
      `💿 *Диск:* использовано ${diskUsed}%, свободно ${diskFreeGb} GB\n\n` +
      `⏱️ *Аптайм:* ${uptimeH}ч ${uptimeM}мин`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
    );
  }

  if (query.data === "rebuild") {
    bot.editMessageText(
      `⏳ *Rebuild запущен...*\n\n\`git pull → build → restart\`\n\nЖди сообщение о завершении...`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
    );
    const start = Date.now();
    exec(`cd ${ROOT_DIR} && npm run rebuild`, { maxBuffer: 1024 * 1024 * 10, timeout: 0 }, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (error) {
        bot.sendMessage(chatId,
          `❌ *Rebuild завершился с ошибкой* (${elapsed}s)\n\n\`\`\`\n${(stderr || error.message).slice(-1000)}\n\`\`\``,
          { parse_mode: "Markdown", ...mainMenu }
        );
        return;
      }
      bot.sendMessage(chatId,
        `✅ *Сервер успешно пересобран!*\n\n⏱ Время: ${elapsed} сек\n\nВсе изменения применены и сервер перезапущен.`,
        { parse_mode: "Markdown", ...mainMenu }
      );
    });
  }
});

console.log("🤖 Telegram Bot запущен");
export default bot;
