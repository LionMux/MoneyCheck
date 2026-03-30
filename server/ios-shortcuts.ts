import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHORTCUTS_DIR = path.resolve(__dirname, "../widgets/ios/shortcuts");

const ALLOWED_FILES = ["FinWiseRashod.shortcut", "FinWiseDohod.shortcut"];

const router = Router();

// GET /api/ios/shortcuts/:filename
// Отдаёт .shortcut файл для скачивания на iOS
// iOS автоматически открывает файл в приложении «Команды» и предлагает добавить shortcut
router.get("/shortcuts/:filename", (req, res) => {
  const { filename } = req.params;

  // Разрешаем только белый список файлов (защита от path traversal)
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

  // Content-Type для .shortcut файлов — iOS распознаёт и открывает в «Командах»
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

export default router;
