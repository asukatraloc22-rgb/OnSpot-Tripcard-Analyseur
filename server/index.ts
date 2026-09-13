import express from "express";
import { createServer } from "http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const systemPrompt = `Tu es l'auditeur expert des dossiers de voyage OnSpot Travel. Analyse uniquement les éléments fournis dans le paquet de preuves. Ne crée aucune réservation, date, adresse ou information non présente. Distingue clairement les faits, les points à vérifier et les recommandations. Réponds uniquement avec un objet JSON valide au format suivant : {"tripNarrative":{"headline":"","overview":"","composition":"","particularities":[],"operationalState":"","openPoints":[],"resolvedPoints":[],"dayReads":[{"dayIndex":0,"date":"","summary":"","attention":[]}]},"agencyReport":{"subject":"","body":""},"situation":"","verdict":"stable|attention|bloquant","newInconsistencies":[],"actions":[],"timeline":[{"at":"","branch":"","event":"","consequence":""}],"responsibilities":[{"owner":"","items":[]}],"confidence":0,"limitations":[]}. La confiance doit être un nombre entre 0 et 100. Une validation humaine reste nécessaire pour tout point critique.`;

function errorResponse(res: express.Response, status: number, kind: string, error: string) {
  return res.status(status).json({ ok: false, kind, error });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(process.env.OPENROUTER_API_KEY), aiMode: "server-openrouter" });
  });

  app.post("/api/ai/360", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return errorResponse(res, 503, "missing-key", "OPENROUTER_API_KEY n’est pas configurée côté serveur.");
    const evidencePack = req.body?.evidencePack;
    if (!evidencePack || typeof evidencePack !== "object") return errorResponse(res, 400, "invalid-response", "Le paquet de preuves est manquant ou invalide.");
    const model = typeof req.body?.model === "string" && req.body.model.trim() ? req.body.model.trim() : DEFAULT_MODEL;

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://onspot.travel",
          "X-Title": process.env.OPENROUTER_APP_NAME || "OnSpot TripCard Analyzer",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `PAQUET DE PREUVES :\n${JSON.stringify(evidencePack)}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) {
        const transient = [408, 429, 500, 502, 503, 504].includes(response.status);
        return errorResponse(res, response.status, response.status === 401 || response.status === 403 ? "invalid-key" : transient ? "overloaded" : "network", payload.error?.message || `OpenRouter a répondu avec le statut ${response.status}.`);
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return errorResponse(res, 502, "invalid-response", "OpenRouter n’a renvoyé aucune analyse exploitable.");
      let result: unknown;
      try {
        const raw = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
        result = JSON.parse(raw);
      } catch {
        return errorResponse(res, 502, "invalid-response", "La réponse OpenRouter n’est pas un JSON valide.");
      }
      return res.json({ ok: true, model, result });
    } catch {
      return errorResponse(res, 502, "network", "La connexion à OpenRouter a échoué.");
    }
  });

  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    if (existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(200).json({ ok: true, message: "Backend ready.", aiConfigured: Boolean(process.env.OPENROUTER_API_KEY), aiMode: "server-openrouter" });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`AI mode: server OpenRouter (${process.env.OPENROUTER_API_KEY ? "configured" : "not configured"})`);
  });
}

startServer().catch(console.error);
