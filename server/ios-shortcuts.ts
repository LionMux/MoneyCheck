import { Router } from "express";
import path from "path";
import fs from "fs";

// process.cwd() — корень проекта в production (C:\...\MoneyCheck)
// Работает в любом формате: CJS (продакшн) и ESM (дев)
const SHORTCUTS_DIR = path.resolve(process.cwd(), "widgets", "ios", "shortcuts");

const ALLOWED_FILES = ["FinWiseRashod.shortcut", "FinWiseDohod.shortcut"];

const router = Router();

// GET /api/ios/shortcuts/:filename
// iOS Safari перехватывает .shortcut файл и открывает приложение «Команды»
router.get("/shortcuts/:filename", (req, res) => {
  const { filename } = req.params;

  // Белый список файлов — защита от path traversal
  if (!ALLOWED_FILES.includes(filename)) {
    return res.status(404).json({ error: "Shortcut not found" });
  }

  const filePath = path.join(SHORTCUTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "File not found",
      message: `Положите файл ${filename} в папку widgets/ios/shortcuts/`,
    });
  }

  // Content-Type для .shortcut: iOS распознаёт и открывает в «Командах»
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

export default router;
