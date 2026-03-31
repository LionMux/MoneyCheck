import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  });
}

/** Отправляет письмо с 6-значным OTP-кодом для сброса пароля */
export async function sendPasswordResetCode(to: string, code: string, expiresMinutes = 30) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@moneycheck.app";
  const transporter = createTransport();

  // Цифры отдельными span — визуальные отступы без letter-spacing.
  // Скрытый span с чистым кодом — чтобы при копировании брался только он.
  const digits = code.split("").map((d, i) =>
    `<span style="display:inline-block;font-size:40px;font-weight:700;color:#20808D;margin-right:${i < code.length - 1 ? "10px" : "0"}">${d}</span>`
  ).join("");

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 8px;color:#111;font-size:22px">Сброс пароля</h2>
    <p style="color:#555;margin:0 0 24px">MoneyCheck получил запрос на сброс пароля для этого аккаунта. Введите код ниже:</p>
    <div style="text-align:center;margin:0 0 24px;background:#f0fafa;padding:20px 28px;border-radius:10px;border:2px solid #20808D">
      <!-- Визуальные цифры с отступами, скрыты при копировании -->
      <span aria-hidden="true" style="user-select:none;-webkit-user-select:none">${digits}</span>
      <!-- Чистый код без пробелов, отображается при копировании -->
      <span style="position:absolute;opacity:0;pointer-events:none;font-size:1px;color:transparent">${code}</span>
    </div>
    <p style="text-align:center;color:#555;font-size:15px;margin:0 0 24px">Код: <strong>${code}</strong></p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#aaa;font-size:13px;margin:0">Код действует ${expiresMinutes} минут. Если это были не вы, просто игнорируйте это письмо.</p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Ваш код сброса пароля MoneyCheck",
    html,
  });
}

/** Отправляет письмо со ссылкой для сброса пароля (legacy, не используется) */
export async function sendPasswordResetEmail(to: string, resetUrl: string, expiresMinutes = 30) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@moneycheck.app";
  const transporter = createTransport();

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 8px;color:#111;font-size:22px">Сброс пароля</h2>
    <p style="color:#555;margin:0 0 24px">MoneyCheck получил запрос на сброс пароля для этого аккаунта.</p>
    <a href="${resetUrl}" style="display:inline-block;background:#20808D;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px">Сбросить пароль</a>
    <p style="margin:20px 0 4px;color:#777;font-size:14px">Или скопируйте ссылку в браузер:</p>
    <p style="margin:0 0 20px;word-break:break-all"><a href="${resetUrl}" style="color:#20808D;font-size:13px">${resetUrl}</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#aaa;font-size:13px;margin:0">Ссылка действует ${expiresMinutes} минут. Если это были не вы, просто игнорируйте это письмо.</p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Сброс пароля MoneyCheck",
    html,
  });
}

export async function sendPasswordChangedEmail(to: string) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@moneycheck.app";
  const transporter = createTransport();

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h2 style="margin:0 0 8px;color:#111;font-size:22px">Пароль изменён</h2>
    <p style="color:#555;margin:0 0 16px">Пароль от вашего аккаунта MoneyCheck был успешно изменён.</p>
    <p style="color:#555;margin:0 0 24px">Если вы не делали этого — немедленно свяжитесь с поддержкой.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#aaa;font-size:13px;margin:0">MoneyCheck Security</p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Ваш пароль MoneyCheck был изменён",
    html,
  });
}
