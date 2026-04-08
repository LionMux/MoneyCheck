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

    const cmd = [
      "git -C . pull origin main",
      "npm install --legacy-peer-deps",
      "npm run build",
      "pm2 restart moneycheck",
    ].join(" && ");

    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        log(`Deploy failed: ${err.message}`, "deploy");
        return res.status(500).json({ message: err.message, stderr });
      }
      log("Deploy successful", "deploy");
      res.json({ message: "Deploy successful", stdout });
    });
  });
}
