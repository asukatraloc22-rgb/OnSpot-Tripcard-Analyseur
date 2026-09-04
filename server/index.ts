import express from "express";
import { createServer } from "http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, aiConfigured: false, aiMode: "browser-openrouter" });
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    res.status(200).json({
      ok: true,
      message: "Backend ready. Build the frontend or serve a generated dist/index.html to expose the UI.",
      aiConfigured: false,
      aiMode: "browser-openrouter",
    });
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log("AI mode: browser OpenRouter configuration");
  });
}

startServer().catch(console.error);
