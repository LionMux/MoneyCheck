import { config } from 'dotenv';
import TelegramBot from "node-telegram-bot-api";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { exec, spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import si from 'systeminformation';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, userProgress } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

config({ path: path.join(ROOT_DIR, '.env') });
console.log("TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "✅ " +
  process.env.TELEGRAM_BOT_TOKEN.slice(0, 10) + "..." : "❌ пустой");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID!);

// ── DB connection ─────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:12334');
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
  request: { agent: proxyAgent }
});

function isAdmin(chatId: number): boolean {
  return chatId === ADMIN_ID;
}

// ── Date formatter: any string/date → "DD.MM.YY HH:MM" ──────────────────────
function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} ${hh}:${min}`;
}

// ── Terminal state per chat ──────────────────────────────────────────────────
interface TerminalSession {
  cwd: string;
  history: string[];
  historyIndex: number;
  activeProcess: ChildProcess | null;
  activeMsgId: number | null;
  mode: 'terminal' | null;
}

const sessions = new Map<number, TerminalSession>();

function getSession(chatId: number): TerminalSession {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      cwd: ROOT_DIR,
      history: [],
      historyIndex: -1,
      activeProcess: null,
      activeMsgId: null,
      mode: null,
    });
  }
  return sessions.get(chatId)!;
}

function formatPrompt(cwd: string): string {
  const parts = cwd.replace(/\\/g, '/').split('/');
  const short = parts.slice(-2).join('/');
  return `PS ${short}>`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[`]/g, "'");
}

function buildTerminalMessage(session: TerminalSession, output?: string, isError = false): string {
  const prompt = formatPrompt(session.cwd);
  const historyLines = session.history.slice(-5).map(h => `  ${h}`).join('\n');
  const historyBlock = historyLines ? `📜 *История (последние 5):*\n\`\`\`\n${historyLines}\n\`\`\`\n` : '';
  const outputBlock = output
    ? `${isError ? '❌' : '✅'} *Вывод:*\n\`\`\`\n${escapeMarkdown(output.slice(-1800))}\n\`\`\`\n`
    : '';
  return (
    `🖥️ *PowerShell Terminal*\n\n` +
    historyBlock +
    outputBlock +
    `\`\`\`\n${prompt}\n\`\`\`` +
    `\n\n_Введи команду следующим сообщением_`
  );
}

const terminalControlMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "⬆️ История ↑", callback_data: "term_hist_up" },
        { text: "⬇️ История ↓", callback_data: "term_hist_down" },
      ],
      [
        { text: "🔴 Ctrl+C (прервать)", callback_data: "term_ctrlc" },
        { text: "🧹 Очистить историю", callback_data: "term_clear" },
      ],
      [
        { text: "📂 ls (список файлов)", callback_data: "term_ls" },
        { text: "📊 pm2 list", callback_data: "term_pm2" },
      ],
      [{ text: "❌ Закрыть терминал", callback_data: "term_exit" }],
    ]
  }
};

// ── Main menu ────────────────────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔄 Rebuild сервера", callback_data: "rebuild" }],
      [{ text: "🤖 Restart tg-bot", callback_data: "restart_bot" }],
      [{ text: "📊 Статус процессов", callback_data: "status" }],
      [{ text: "🖥️ Железо сервера", callback_data: "stats" }],
      [{ text: "👥 Пользователи", callback_data: "users" }],
      [{ text: "📋 Последние логи", callback_data: "logs" }],
      [{ text: "💻 Terminal", callback_data: "terminal" }],
    ]
  }
};

// ── Restart flag ─────────────────────────────────────────────────────────────
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

// ── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, "⛔ Доступ запрещён");
  bot.sendMessage(chatId,
    `👋 *MoneyCheck Control Panel*\n\nУправляй сервером прямо из Telegram.\nВыбери действие:`,
    { parse_mode: "Markdown", ...mainMenu }
  );
});

// ── Terminal: handle text input ───────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const session = getSession(chatId);
  if (session.mode !== 'terminal') return;

  const input = msg.text.trim();

  bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  if (input.startsWith('cd ') || input === 'cd') {
    const target = input === 'cd' ? ROOT_DIR : input.slice(3).trim();
    const newPath = path.isAbsolute(target) ? target : path.resolve(session.cwd, target);
    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      session.cwd = newPath;
      session.history.push(input);
      session.historyIndex = session.history.length;
      const text = buildTerminalMessage(session);
      if (session.activeMsgId) {
        bot.editMessageText(text, {
          chat_id: chatId, message_id: session.activeMsgId,
          parse_mode: "Markdown", ...terminalControlMenu
        }).catch(() => {});
      }
    } else {
      const text = buildTerminalMessage(session, `cd: путь не найден: ${newPath}`, true);
      if (session.activeMsgId) {
        bot.editMessageText(text, {
          chat_id: chatId, message_id: session.activeMsgId,
          parse_mode: "Markdown", ...terminalControlMenu
        }).catch(() => {});
      }
    }
    return;
  }

  if (input === 'clear' || input === 'cls') {
    session.history = [];
    const text = buildTerminalMessage(session);
    if (session.activeMsgId) {
      bot.editMessageText(text, {
        chat_id: chatId, message_id: session.activeMsgId,
        parse_mode: "Markdown", ...terminalControlMenu
      }).catch(() => {});
    }
    return;
  }

  if (input === 'exit') {
    session.mode = null;
    if (session.activeMsgId) {
      bot.editMessageText(
        `👋 *Терминал закрыт*\n\nВозвращаемся в главное меню.`,
        { chat_id: chatId, message_id: session.activeMsgId, parse_mode: "Markdown", ...mainMenu }
      ).catch(() => {});
    }
    return;
  }

  session.history.push(input);
  session.historyIndex = session.history.length;

  if (session.activeMsgId) {
    bot.editMessageText(
      `🖥️ *PowerShell Terminal*\n\n⏳ Выполняется...\n\`\`\`\n${formatPrompt(session.cwd)} ${input}\n\`\`\``,
      { chat_id: chatId, message_id: session.activeMsgId, parse_mode: "Markdown" }
    ).catch(() => {});
  }

  const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', input], {
    cwd: session.cwd,
    windowsHide: true,
  });

  session.activeProcess = proc;
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  proc.on('close', (code) => {
    session.activeProcess = null;
    const output = (stdout + stderr).trim() || '(нет вывода)';
    const isError = code !== 0;
    const text = buildTerminalMessage(session, output, isError);
    if (session.activeMsgId) {
      bot.editMessageText(text, {
        chat_id: chatId, message_id: session.activeMsgId,
        parse_mode: "Markdown", ...terminalControlMenu
      }).catch(() => {});
    }
  });

  proc.on('error', (err) => {
    session.activeProcess = null;
    const text = buildTerminalMessage(session, `Ошибка запуска: ${err.message}`, true);
    if (session.activeMsgId) {
      bot.editMessageText(text, {
        chat_id: chatId, message_id: session.activeMsgId,
        parse_mode: "Markdown", ...terminalControlMenu
      }).catch(() => {});
    }
  });
});

// ── formatStatus ─────────────────────────────────────────────────────────────
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

// ── callback_query ────────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const msgId = query.message!.message_id;

  if (!isAdmin(chatId)) {
    bot.answerCallbackQuery(query.id, { text: "⛔ Доступ запрещён" });
    return;
  }

  bot.answerCallbackQuery(query.id);
  const session = getSession(chatId);

  // ── Terminal callbacks ───────────────────────────────────────────────────
  if (query.data === "terminal") {
    session.mode = 'terminal';
    session.activeMsgId = msgId;
    const text = buildTerminalMessage(session);
    bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: "Markdown", ...terminalControlMenu
    });
    return;
  }

  if (query.data === "term_exit") {
    session.mode = null;
    session.activeMsgId = null;
    bot.editMessageText(
      `👋 *Терминал закрыт*`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
    );
    return;
  }

  if (query.data === "term_ctrlc") {
    if (session.activeProcess) {
      session.activeProcess.kill('SIGTERM');
      session.activeProcess = null;
      const text = buildTerminalMessage(session, '^C — процесс прерван', true);
      bot.editMessageText(text, {
        chat_id: chatId, message_id: msgId,
        parse_mode: "Markdown", ...terminalControlMenu
      });
    } else {
      bot.answerCallbackQuery(query.id, { text: "Нет активного процесса" });
    }
    return;
  }

  if (query.data === "term_clear") {
    session.history = [];
    const text = buildTerminalMessage(session);
    bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: "Markdown", ...terminalControlMenu
    });
    return;
  }

  if (query.data === "term_hist_up") {
    if (session.history.length === 0) {
      bot.answerCallbackQuery(query.id, { text: "История пуста" });
      return;
    }
    session.historyIndex = Math.max(0, session.historyIndex - 1);
    const cmd = session.history[session.historyIndex];
    bot.answerCallbackQuery(query.id, { text: `↑ ${cmd}` });
    return;
  }

  if (query.data === "term_hist_down") {
    if (session.history.length === 0) {
      bot.answerCallbackQuery(query.id, { text: "История пуста" });
      return;
    }
    session.historyIndex = Math.min(session.history.length - 1, session.historyIndex + 1);
    const cmd = session.history[session.historyIndex];
    bot.answerCallbackQuery(query.id, { text: `↓ ${cmd}` });
    return;
  }

  if (query.data === "term_ls") {
    session.mode = 'terminal';
    session.activeMsgId = msgId;
    const items = fs.readdirSync(session.cwd).map(f => {
      const full = path.join(session.cwd, f);
      const isDir = fs.statSync(full).isDirectory();
      return isDir ? `📁 ${f}` : `📄 ${f}`;
    }).join('\n');
    const text = buildTerminalMessage(session, items || '(пусто)');
    bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: "Markdown", ...terminalControlMenu
    });
    return;
  }

  if (query.data === "term_pm2") {
    session.mode = 'terminal';
    session.activeMsgId = msgId;
    exec('pm2 list --no-color', (_, stdout, stderr) => {
      const text = buildTerminalMessage(session, (stdout || stderr).trim());
      bot.editMessageText(text, {
        chat_id: chatId, message_id: msgId,
        parse_mode: "Markdown", ...terminalControlMenu
      });
    });
    return;
  }

  // ── Restart bot ───────────────────────────────────────────────────────────
  if (query.data === "restart_bot") {
    const start = Date.now();
    bot.editMessageText(
      `⏳ *Restart tg-bot...*\n\n\`git pull → restart\`\n\nЖди сообщение о завершении...`,
      { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
    );
    exec(`cd ${ROOT_DIR} && git pull origin main`, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (error) {
        bot.editMessageText(
          `❌ *git pull завершился с ошибкой*\n\n\`\`\`\n${(stderr || error.message).slice(-800)}\n\`\`\``,
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
        );
        return;
      }
      fs.writeFileSync(RESTART_FLAG, JSON.stringify({ chatId, msgId, elapsed }));
      exec('pm2 restart tg-bot');
    });
    return;
  }

  // ── Status ────────────────────────────────────────────────────────────────
  if (query.data === "status") {
    exec("pm2 list --no-color", (_, stdout) => {
      const formatted = formatStatus(stdout);
      bot.editMessageText(
        `📊 *Статус серверов*\n\n${formatted}\n\n_Обновлено только что_`,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    });
  }

  // ── Logs ──────────────────────────────────────────────────────────────────
  if (query.data === "logs") {
    exec("pm2 logs moneycheck --nostream --lines 20 --no-color", (_, stdout, stderr) => {
      const output = (stdout || stderr).slice(-1500);
      bot.editMessageText(
        `📋 *Последние логи moneycheck*\n\n\`\`\`\n${output}\n\`\`\``,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
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

  // ── Users ─────────────────────────────────────────────────────────────────
  if (query.data === "users") {
    try {
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          lastActive: userProgress.lastActiveDate,
        })
        .from(users)
        .leftJoin(userProgress, eq(users.id, userProgress.userId))
        .orderBy(users.id);

      if (!result.length) {
        bot.editMessageText(
          `👥 *Пользователи*\n\nПока никто не зарегистрирован.`,
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
        );
        return;
      }

      const lines = result.map((u, i) => {
        const created = formatDate(u.createdAt);
        const lastSeen = u.lastActive ? formatDate(u.lastActive) : 'никогда';
        const name = u.name?.trim() || 'Без имени';
        const status = u.lastActive ? '🟢' : '⚪️';
        return `${status} *${i + 1}. ${name}*\n` +
               `   📧 \`${u.email}\`\n` +
               `   📅 Регис႐рация: ${created}\n` +
               `   🕐 Последний заход: ${lastSeen}`;
      });

      const header = `👥 *Пользова႐ели MoneyCheck*\n_Всего: ${result.length}_\n\n`;
      let chunks: string[] = [];
      let current = header;

      for (const line of lines) {
        if ((current + line + '\n\n').length > 3800) {
          chunks.push(current);
          current = line + '\n\n';
        } else {
          current += line + '\n\n';
        }
      }
      chunks.push(current);

      await bot.editMessageText(chunks[0], {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: "Markdown",
        ...(chunks.length === 1 ? mainMenu : {})
      });

      for (let i = 1; i < chunks.length; i++) {
        await bot.sendMessage(chatId, chunks[i], {
          parse_mode: "Markdown",
          ...(i === chunks.length - 1 ? mainMenu : {})
        });
      }
    } catch (e: any) {
      bot.editMessageText(
        `❌ *Ошибка запроса к БД:*\n\`${e.message}\``,
        { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", ...mainMenu }
      );
    }
  }

  // ── Rebuild ───────────────────────────────────────────────────────────────
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
        `✅ *Сеႈвеႈ успешно пеႈесобႈан!*\n\n⏱ Вႈемя: ${elapsed} сек\n\nВсе изменения пႈименены и сеႈвеႈ пеႈезапущен.`,
        { parse_mode: "Markdown", ...mainMenu }
      );
    });
  }
});

console.log("🤖 Telegram Bot запущен");
export default bot;
