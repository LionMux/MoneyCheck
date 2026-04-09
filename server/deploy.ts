import { type Express, type Request, type Response } from "express";
import { exec } from "child_process";
import { log } from "./index";

export function registerDeployRoute(app: Express) {
  app.post("/api/deploy", (req: Request, res: Response) => {
    const token = req.headers["x-deploy-token"];

    if (!token || token !== process.env.DEPLOY_TOKEN) {
      log("Deploy attempt with invalid token", "deploy");
      return res.status(403).json({ message: "Forbidden" });
    }

    log("Deploy triggered via webhook", "deploy");

    // Respond immediately — pm2 restart kills this process,
    // so we must send 200 before the restart command runs.
    res.json({ message: "Deploy started" });

    const cmd = [
      "git -C . pull origin main",
      "npm install --legacy-peer-deps",
      "npm run build",
      "pm2 restart moneycheck",
    ].join(" && ");

    exec(cmd, { cwd: process.cwd() }, (err, _stdout, stderr) => {
      if (err) {
        log(`Deploy failed: ${err.message}\n${stderr}`, "deploy");
      } else {
        log("Deploy successful", "deploy");
      }
    });
  });
}
