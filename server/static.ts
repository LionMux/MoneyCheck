import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (e.g. index-BImz0Ynk.js) → cache 1 year, immutable
  // index.html and manifest.json → no cache (always fetch fresh)
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const basename = path.basename(filePath);
        if (basename === "index.html" || basename === "manifest.json" || basename === "sw.js") {
          // Never cache the entry point — ensures new deploys are picked up immediately
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else if (/\.[0-9a-f]{8,}\.(js|css)$/.test(basename)) {
          // Content-hashed assets — safe to cache forever
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
