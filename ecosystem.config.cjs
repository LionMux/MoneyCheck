const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: "moneycheck",
      script: "dist/index.cjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "tg-bot",
      script: "node_modules/tsx/dist/cli.mjs",
      interpreter: "node",
      args: "server/telegramBot.ts",
      env: {
        NODE_ENV: "production",
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_ADMIN_ID: process.env.TELEGRAM_ADMIN_ID
      }
    }
  ]
}
