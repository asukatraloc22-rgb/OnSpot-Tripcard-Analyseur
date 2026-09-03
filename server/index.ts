import express from "express";
import { createServer } from "http";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aiEndpoint = process.env.AI_API_URL || process.env.VITE_AI_API_URL || "";
const aiKey = process.env.AI_API_KEY || process.env.VITE_AI_API_KEY || "";
const aiModel = process.env.AI_MODEL || process.env.VITE_AI_MODEL || "gpt-4o-mini";

const compactTravelSummary = (payload: any[]) => {
  const steps = Array.isArray(payload) ? payload : [];
  return steps
    .map((step: any, index: number) => {
      const type = String(step?.type || step?.kind || step?.category || `Étape ${index + 1}`);
      const date = String(step?.date || step?.startDate || step?.departureDate || "");
      const time = String(step?.time || step?.startTime || step?.departureTime || "");
      const arrivalDate = String(step?.arrivalDate || "");
      const arrivalTime = String(step?.arrivalTime || "");
      const location = String(step?.location || step?.city || step?.destination || step?.address || "");
      return `${index + 1}. ${type}${date ? ` | ${date}` : ""}${time ? ` | ${time}` : ""}${location ? ` | ${location}` : ""}${arrivalDate ? ` | arrivée ${arrivalDate}${arrivalTime ? ` ${arrivalTime}` : ""}` : ""}`;
    })
    .join("\n");
};

const buildPrompt = (payload: any) => {
  const steps = Array.isArray(payload?.steps)
    ? payload.steps
    : Array.isArray(payload?.itinerary)
      ? payload.itinerary
      : Array.isArray(payload?.services)
        ? payload.services
        : [];

  return {
    system: "Tu es un assistant de contrôle voyage. Réponds uniquement en JSON strict valide sans markdown.",
    user: `Analyse le voyage en amont du départ. Donne uniquement les faits utiles pour prévenir l'agence avant départ.

Étapes minimales :
${compactTravelSummary(steps) || "Aucune étape détectée."}

JSON strict attendu :
{
  "tripSummary": "string",
  "documentsMissing": [{ "section": "string", "reason": "string", "severity": "low|medium|high" }],
  "logicalInconsistencies": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "missingElements": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "timeAlerts": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "watchpoints": [{ "point": "string", "detail": "string", "severity": "low|medium|high" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high" }]
}

Cherche : documents manquants (hôtels, activités, transfert, car rental, passeport/CNI), incohérences logiques, alertes temporelles, oublis de correspondance, et éléments à surveiller avant départ.`
  };
};

const normalizeAiResult = (value: any) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    tripSummary: typeof source.tripSummary === "string" ? source.tripSummary : "Analyse réalisée à partir des données disponibles.",
    documentsMissing: Array.isArray(source.documentsMissing) ? source.documentsMissing : [],
    logicalInconsistencies: Array.isArray(source.logicalInconsistencies) ? source.logicalInconsistencies : [],
    missingElements: Array.isArray(source.missingElements) ? source.missingElements : [],
    timeAlerts: Array.isArray(source.timeAlerts) ? source.timeAlerts : [],
    watchpoints: Array.isArray(source.watchpoints) ? source.watchpoints : [],
    recommendedActions: Array.isArray(source.recommendedActions) ? source.recommendedActions : [],
  };
};

const fallbackLocalAnalysis = (payload: any) => {
  const steps = Array.isArray(payload?.steps)
    ? payload.steps
    : Array.isArray(payload?.itinerary)
      ? payload.itinerary
      : Array.isArray(payload?.services)
        ? payload.services
        : [];

  const types = steps.map((step: any) => String(step?.type || step?.kind || "").toLowerCase());
  const hasHotel = types.some((type: string) => type.includes("hotel") || type.includes("hôtel") || type.includes("hébergement"));
  const hasFlight = types.some((type: string) => type.includes("vol") || type.includes("flight"));
  const hasTransfer = types.some((type: string) => type.includes("transfert") || type.includes("transfer") || type.includes("taxi") || type.includes("train"));
  const hasActivity = types.some((type: string) => type.includes("activité") || type.includes("activity"));
  const hasRental = types.some((type: string) => type.includes("car") || type.includes("location") || type.includes("vehicle"));

  return normalizeAiResult({
    tripSummary: steps.length ? `Voyage avec ${steps.length} étape(s) détectée(s), à vérifier avant départ.` : "Aucune étape structurée détectée.",
    documentsMissing: [
      !hasHotel ? { section: "Hôtel", reason: "Aucun hébergement détecté.", severity: "medium" } : null,
      !hasTransfer ? { section: "Transfert", reason: "Aucune correspondance / transfer détecté.", severity: "medium" } : null,
      !hasActivity ? { section: "Activité", reason: "Aucune activité détectée.", severity: "low" } : null,
      !hasRental ? { section: "Car rental", reason: "Aucune location de voiture détectée.", severity: "low" } : null,
    ].filter(Boolean),
    logicalInconsistencies: hasFlight && hasHotel ? [{ issue: "Contrôle logique de cohérence", detail: "Vérifier la cohérence entre l’arrivée du vol et la date d’arrivée à l’hôtel.", severity: "medium" }] : [],
    missingElements: !hasTransfer && hasFlight && hasHotel ? [{ issue: "Absence de transfert", detail: "Pas de transfert explicite entre aéroport et hôtel.", severity: "medium" }] : [],
    timeAlerts: [],
    watchpoints: [{ point: "Documents de voyage", detail: "Vérifier CNI / passeport et pièces d’identité avant départ.", severity: "medium" }],
    recommendedActions: [{ action: "Demander confirmation de l’agence sur les hébergements, transferts et documents manquants.", priority: "high" }],
  });
};

async function callAi(payload: any) {
  if (!aiEndpoint) {
    return fallbackLocalAnalysis(payload);
  }

  const prompt = buildPrompt(payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(aiKey ? { Authorization: aiKey.startsWith("Bearer ") ? aiKey : `Bearer ${aiKey}` } : {}),
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`IA unavailable: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.output_text || data?.content || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "{}";
    const parsed = typeof text === "string" ? JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") : text;
    return normalizeAiResult(parsed);
  } catch {
    return fallbackLocalAnalysis(payload);
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "2mb" }));

  app.post("/api/analyze-travel", async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await callAi(payload);
      res.json({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI error";
      res.status(500).json({ ok: false, error: message, result: fallbackLocalAnalysis(req.body || {}) });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(aiEndpoint) });
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
      aiConfigured: Boolean(aiEndpoint),
    });
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`AI endpoint configured: ${Boolean(aiEndpoint)}`);
  });
}

startServer().catch(console.error);
