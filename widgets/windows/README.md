# FinWise Windows Widget

Compact Electron widget that shows your FinWise balance summary as a floating always-on-top window.

## Requirements
- Node.js 18+
- Windows 10/11 (or macOS/Linux for dev)
- FinWise backend running

## Run in development

```bash
cd widgets/windows
npm install
FINWISE_API=http://localhost:5000 npm start
```

## Build installer (Windows)

```bash
npm run build
# Output: dist/FinWise Widget Setup.exe
```

## Features
- Shows total balance, monthly income and expenses
- Streak and level display
- Click "Открыть →" to jump to the FinWise web app
- Polls for fresh data every 60 seconds
- Refresh button for instant update
- Minimize to tray — stays running in background
- Glassmorphism dark UI with emerald accent

## Configuration

Set the `FINWISE_API` environment variable to your backend URL:
- Local: `http://localhost:5000`
- Deployed: `https://your-finwise.example.com`

## Widget endpoint

The widget uses `GET /api/widget/summary` which returns:
```json
{
  "totalBalance": 85400,
  "monthIncome": 120000,
  "monthExpense": 48200,
  "streak": 7,
  "level": 3,
  "totalXp": 650
}
```

This endpoint needs to be added to `server/routes.ts` (see main README).
