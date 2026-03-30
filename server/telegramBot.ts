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

// ── Terminal session ──────────────────────────────────────────────────────────
interface TerminalSession {
  cwd: string;
  mode: 'terminal' | null;
  activeMsgId: number | null;
  activeProcess: ChildProcess | null;
  // scrollback: каждая запись = одна строка буфера
  scrollback: string[];
  // дебаунс-таймер для обновления сообщения
  updateTimer: ReturnType<typeof setTimeout> | null;
  // флаг что процесс завершён (чтобы финальный рендер отличался)
  running: boolean;
  // последний отправленный текст (чтобы не делать edit если ничего не изменилось)
  lastSentText: string;
}

const sessions = new Map<number, TerminalSession>();

function getSession(chatId: number): TerminalSession {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      cwd: ROOT_DIR,
      mode: null,
      activeMsgId: null,
      activeProcess: null,
      scrollback: [],
      updateTimer: null,
      running: false,
      lastSentText: '',
    });
  }
  return sessions.get(chatId)!;
}

function formatPrompt(cwd: string): string {
  const parts = cwd.replace(/\\/g, '/').split('/');
  return 'PS ' + parts.slice(-2).join('/') + '>';
}

// Убираем backtick чтобы не ломать code block, заменяем на '
function sanitize(text: string): string {
  return text.replace(/`/g, "'");
}

// ── Ядро рендера ─────────────────────────────────────────────────────────────
// Берём строки scrollback снизу вверх пока влезают в MAX_BODY символов.
// Если не влезают все — обрезаем сверху (как реальный терминал).
const MAX_BODY = 3400;

function renderTerminal(session: TerminalSession, done: boolean): string {
  const prompt = formatPrompt(session.cwd);
  const footer = done
    ? `\`\`\`\n${prompt}\`\`\`\n_Введите следующую команду или закройте консоль_`
    : `\`\`\`\n${prompt} ⏳\`\`\``;

  const header = `🖥️ *Terminal*\n`;
  const footerLen = footer.length + header.length + 10;
  const budget = MAX_BODY - footerLen;

  // Собираем scrollback в одну строку, обрезаем сверху если не влезает
  let body = session.scrollback.join('\n');
  if (body.length > budget) {
    // Убираем строки сверху пока не влезет
    const lines = body.split('\n');
    while (lines.length > 1 && lines.join('\n').length > budget) {
      lines.shift();
    }
    body = '... (начало обрезано)\n' + lines.join('\n');
  }

  const bodyBlock = body.trim()
    ? `\`\`\`\n${sanitize(body)}\n\`\`\`\n`
    : '';

  return header + bodyBlock + footer;
}

// ── Дебаунс-обновление сообщения ─────────────────────────────────────────────
// Во время выполнения — обновляем каждые 600мс максимум (rate limit Telegram: 1 edit/сек).
const DEBOUNCE_MS = 600;

function scheduleUpdate(chatId: number, done: boolean) {
  const session = getSession(chatId);
  if (session.updateTimer) {
    clearTimeout(session.updateTimer);
    session.updateTimer = null;
  }
  const doUpdate = () => {
    if (!session.activeMsgId) return;
    const text = renderTerminal(session, done);
    if (text === session.lastSentText) return;
    session.lastSentText = text;
    const keyboard = done ? terminalDoneMenu : terminalRunningMenu;
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: session.activeMsgId,
      parse_mode: 'Markdown',
      ...keyboard,
    }).catch(() => {});
  };
  if (done) {
    // Финальное обновление — сразу
    doUpdate();
  } else {
    session.updateTimer = setTimeout(doUpdate, DEBOUNCE_MS);
  }
}

// ── Меню ─────────────────────────────────────────────────────────────────────
// Во время выполнения — только Ctrl+C
const terminalRunningMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔴 Ctrl+C (прервать)', callback_data: 'term_ctrlc' }],
    ]
  }
};

// После завершения команды — управление
const terminalDoneMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🧹 Очистить', callback_data: 'term_clear' },
        { text: '❌ Закрыть консоль', callback_data: 'term_exit' },
      ],
    ]
  }
};

// Главное меню
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔄 Rebuild сервера', callback_data: 'rebuild' }],
      [{ text: '🤖 Restart tg-bot', callback_data: 'restart_bot' }],
      [{ text: '📊 Статус процессов', callback_data: 'status' }],
      [{ text: '🖥️ Железо сервера', callback_data: 'stats' }],
      [{ text: '👥 Пользователи', callback_data: 'users' }],
      [{ text: '📋 Последние логи', callback_data: 'logs' }],
      [{ text: '💻 Terminal', callback_data: 'terminal' }],
    ]
  }
};

// ── Запуск команды ────────────────────────────────────────────────────────────
function runCommand(chatId: number, input: string) {
  const session = getSession(chatId);

  // Добавляем строку с промптом в scrollback
  session.scrollback.push(`${formatPrompt(session.cwd)} ${input}`);
  session.running = true;

  scheduleUpdate(chatId, false);

  const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', input], {
    cwd: session.cwd,
    windowsHide: true,
  });

  session.activeProcess = proc;

  const onData = (chunk: Buffer) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line !== '') session.scrollback.push(line);
    }
    scheduleUpdate(chatId, false);
  };

  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);

  proc.on('close', (code) => {
    session.activeProcess = null;
    session.running = false;
    if (code !== 0 && code !== null) {
      session.scrollback.push(`[exit code: ${code}]`);
    }
    scheduleUpdate(chatId, true);
  });

  proc.on('error', (err) => {
    session.activeProcess = null;
    session.running = false;
    session.scrollback.push(`[ошибка запуска: ${err.message}]`);
    scheduleUpdate(chatId, true);
  });
}

// ── Restart flag ──────────────────────────────────────────────────────────────
const RESTART_FLAG = path.join(ROOT_DIR, '.bot_restarted');

if (fs.existsSync(RESTART_FLAG)) {
  try {
    const { chatId, msgId, elapsed } = JSON.parse(fs.readFileSync(RESTART_FLAG, 'utf-8'));
    fs.unlinkSync(RESTART_FLAG);
    setTimeout(() => {
      bot.editMessageText(
        `✅ *tg-bot успешно перезапущен!*\n\n⏱ Время: ${elapsed} сек\n🤖 Бот снова в сети.`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
      );
    }, 2000);
  } catch {
    fs.unlinkSync(RESTART_FLAG);
  }
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, '⛔ Доступ запрещён');
  bot.sendMessage(chatId,
    `👋 *MoneyCheck Control Panel*\n\nУправляй сервером прямо из Telegram.\nВыбери действие:`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// ── Обработка текстовых сообщений (команды терминала) ─────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const session = getSession(chatId);
  if (session.mode !== 'terminal') return;

  const input = msg.text.trim();
  bot.deleteMessage(chatId, msg.message_id).catch(() => {});

  // Если команда уже выполняется — игнорируем
  if (session.running) return;

  // ── Встроенные команды ───────────────────────────────────────────────────
  if (input === 'clear' || input === 'cls') {
    session.scrollback = [];
    session.lastSentText = '';
    scheduleUpdate(chatId, true);
    return;
  }

  if (input === 'exit') {
    session.mode = null;
    if (session.activeMsgId) {
      bot.editMessageText('👋 *Терминал закрыт*',
        { chat_id: chatId, message_id: session.activeMsgId, parse_mode: 'Markdown', ...mainMenu }
      ).catch(() => {});
    }
    return;
  }

  if (input.startsWith('cd ') || input === 'cd') {
    const target = input === 'cd' ? ROOT_DIR : input.slice(3).trim();
    const newPath = path.isAbsolute(target) ? target : path.resolve(session.cwd, target);
    session.scrollback.push(`${formatPrompt(session.cwd)} ${input}`);
    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      session.cwd = newPath;
      session.scrollback.push(`→ ${newPath}`);
    } else {
      session.scrollback.push(`cd: путь не найден: ${newPath}`);
    }
    session.lastSentText = '';
    scheduleUpdate(chatId, true);
    return;
  }

  // ── Обычная команда ──────────────────────────────────────────────────────
  runCommand(chatId, input);
});

// ── formatStatus ──────────────────────────────────────────────────────────────
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
    bot.answerCallbackQuery(query.id, { text: '⛔ Доступ запрещён' });
    return;
  }

  bot.answerCallbackQuery(query.id);
  const session = getSession(chatId);

  // ── terminal ─────────────────────────────────────────────────────────────
  if (query.data === 'terminal') {
    session.mode = 'terminal';
    session.activeMsgId = msgId;
    session.scrollback = [];
    session.lastSentText = '';
    session.running = false;
    const text = renderTerminal(session, true);
    session.lastSentText = text;
    bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId,
      parse_mode: 'Markdown', ...terminalDoneMenu
    });
    return;
  }

  if (query.data === 'term_exit') {
    session.mode = null;
    session.activeProcess?.kill('SIGTERM');
    session.activeProcess = null;
    session.running = false;
    bot.editMessageText('👋 *Терминал закрыт*',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
    );
    return;
  }

  if (query.data === 'term_ctrlc') {
    if (session.activeProcess) {
      session.activeProcess.kill('SIGTERM');
      session.activeProcess = null;
      session.running = false;
      session.scrollback.push('^C');
      session.lastSentText = '';
      scheduleUpdate(chatId, true);
    } else {
      bot.answerCallbackQuery(query.id, { text: 'Нет активного процесса' });
    }
    return;
  }

  if (query.data === 'term_clear') {
    session.scrollback = [];
    session.lastSentText = '';
    scheduleUpdate(chatId, true);
    return;
  }

  // ── restart_bot ───────────────────────────────────────────────────────────
  if (query.data === 'restart_bot') {
    const start = Date.now();
    bot.editMessageText(
      `⏳ *Restart tg-bot...*\n\n\`git pull → restart\`\n\nЖди сообщение о завершении...`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
    exec(`cd ${ROOT_DIR} && git pull origin main`, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (error) {
        bot.editMessageText(
          `❌ *git pull завершился с ошибкой*\n\n\`\`\`\n${(stderr || error.message).slice(-800)}\n\`\`\``,
          { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
        );
        return;
      }
      fs.writeFileSync(RESTART_FLAG, JSON.stringify({ chatId, msgId, elapsed }));
      exec('pm2 restart tg-bot');
    });
    return;
  }

  // ── status ────────────────────────────────────────────────────────────────
  if (query.data === 'status') {
    exec('pm2 list --no-color', (_, stdout) => {
      const formatted = formatStatus(stdout);
      bot.editMessageText(
        `📊 *Статус серверов*\n\n${formatted}\n\n_Обновлено только что_`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
      );
    });
  }

  // ── logs ──────────────────────────────────────────────────────────────────
  if (query.data === 'logs') {
    exec('pm2 logs moneycheck --nostream --lines 20 --no-color', (_, stdout, stderr) => {
      const output = (stdout || stderr).slice(-1500);
      bot.editMessageText(
        `📋 *Последние логи moneycheck*\n\n\`\`\`\n${output}\n\`\`\``,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
      );
    });
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  if (query.data === 'stats') {
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
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
    );
  }

  // ── users ─────────────────────────────────────────────────────────────────
  if (query.data === 'users') {
    try {
      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
          lastActive: userProgress.lastActiveDate,
        })
        .from(users)
        .leftJoin(userProgress, eq(users.id, userProgress.userId))
        .orderBy(users.id);

      if (!result.length) {
        bot.editMessageText(
          `👥 *Пользователи*\n\nПока никто не зарегистрирован.`,
          { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
        );
        return;
      }

      const lines = result.map((u, i) => {
        const created = formatDate(u.createdAt);
        const lastSeen = u.lastLoginAt
          ? formatDate(u.lastLoginAt)
          : u.lastActive ? u.lastActive : 'никогда';
        const name = u.name?.trim() || 'Без имени';
        const status = u.lastLoginAt ? '🟢' : u.lastActive ? '🟡' : '⚪️';
        return `${status} *${i + 1}. ${name}*\n` +
               `   📧 \`${u.email}\`\n` +
               `   📅 Регистрация: ${created}\n` +
               `   🕐 Последний заход: ${lastSeen}`;
      });

      const header = `👥 *Пользователи MoneyCheck*\n_Всего: ${result.length}_\n\n`;
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
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
        ...(chunks.length === 1 ? mainMenu : {})
      });
      for (let i = 1; i < chunks.length; i++) {
        await bot.sendMessage(chatId, chunks[i], {
          parse_mode: 'Markdown',
          ...(i === chunks.length - 1 ? mainMenu : {})
        });
      }
    } catch (e: any) {
      bot.editMessageText(
        `❌ *Ошибка запроса к БД:*\n\`${e.message}\``,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...mainMenu }
      );
    }
  }

  // ── rebuild ───────────────────────────────────────────────────────────────
  if (query.data === 'rebuild') {
    bot.editMessageText(
      `⏳ *Rebuild запущен...*\n\n\`git pull → build → restart\`\n\nЖди сообщение о завершении...`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
    const start = Date.now();
    exec(`cd ${ROOT_DIR} && npm run rebuild`, { maxBuffer: 1024 * 1024 * 10, timeout: 0 }, (error, stdout, stderr) => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      if (error) {
        bot.sendMessage(chatId,
          `❌ *Rebuild завершился с ошибкой* (${elapsed}s)\n\n\`\`\`\n${(stderr || error.message).slice(-1000)}\n\`\`\``,
          { parse_mode: 'Markdown', ...mainMenu }
        );
        return;
      }
      bot.sendMessage(chatId,
        `✅ *Сервер успешно пересобран!*\n\n⏱ Время: ${elapsed} сек\n\nВсе изменения применены и сервер перезапущен.`,
        { parse_mode: 'Markdown', ...mainMenu }
      );
    });
  }
});

console.log('🤖 Telegram Bot запущен');
export default bot;
