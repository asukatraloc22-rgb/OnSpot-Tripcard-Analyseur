const DEFAULT_TIMEOUT_MS = 15000;

const normalizeText = value => typeof value === "string" ? value.trim() : "";

const arrayFrom = value => Array.isArray(value) ? value : [];

const getAiConfig = () => {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  return {
    provider: env.VITE_AI_PROVIDER || "backend",
    endpoint: env.VITE_AI_API_URL || env.VITE_AI_ENDPOINT || env.VITE_OPENAI_API_URL || "/api/analyze-travel",
    apiKey: env.VITE_AI_API_KEY || env.VITE_OPENAI_API_KEY || "",
    model: env.VITE_AI_MODEL || env.VITE_OPENAI_MODEL || "gpt-4o-mini",
  };
};

const extractSteps = payload => {
  const candidateSources = [
    payload?.steps,
    payload?.itinerary,
    payload?.travel?.steps,
    payload?.segments,
    payload?.journey?.steps,
    payload?.services,
  ];

  for (const source of candidateSources) {
    if (Array.isArray(source) && source.length) return source;
  }

  return [];
};

const compactTravelSummary = payload => {
  const steps = extractSteps(payload).map((step, index) => {
    const record = step && typeof step === "object" ? step : {};
    return {
      index: index + 1,
      type: normalizeText(record.type || record.kind || record.category || record.title || "étape") || `Étape ${index + 1}`,
      date: normalizeText(record.date || record.startDate || record.departureDate || record.arrivalDate || ""),
      time: normalizeText(record.time || record.startTime || record.departureTime || record.arrivalTime || ""),
      arrivalDate: normalizeText(record.arrivalDate || ""),
      arrivalTime: normalizeText(record.arrivalTime || ""),
      location: normalizeText(record.location || record.city || record.destination || record.address || record.airport || record.hotel || ""),
      title: normalizeText(record.title || record.name || record.label || ""),
    };
  });

  return steps.filter(step => step.type || step.date || step.location || step.title);
};

const buildPrompt = payload => {
  const summary = compactTravelSummary(payload);

  const lines = summary.length
    ? summary.map(step => {
        const timeText = step.time ? ` | ${step.time}` : "";
        const arrivalText = step.arrivalDate ? ` | arrivée ${step.arrivalDate}${step.arrivalTime ? ` ${step.arrivalTime}` : ""}` : "";
        return `${step.index}. ${step.type}${step.date ? ` | ${step.date}` : ""}${timeText}${step.location ? ` | ${step.location}` : ""}${arrivalText}`;
      }).join("\n")
    : "Aucune étape structurée détectée dans l’export.";

  return {
    system: "Tu es un assistant de contrôle voyage / opérations. Tu reçois uniquement les éléments utiles pour vérifier la cohérence du voyage avant départ. Réponds uniquement avec du JSON strict valide.",
    user: `Analyse le voyage ci-dessous au format JSON strict. 

Données minimales (dates, heures, lieux, types d'étapes seulement) :
${lines}

Objectif : vérifier le voyage dans son ensemble afin d'aviser l'agence en cas de problème avant le départ.

Retour attendu, en JSON strict, sans markdown, sans commentaire, avec cette structure exacte :
{
  "tripSummary": "string",
  "documentsMissing": [{ "section": "string", "reason": "string", "severity": "low|medium|high" }],
  "logicalInconsistencies": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "missingElements": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "timeAlerts": [{ "issue": "string", "detail": "string", "severity": "low|medium|high" }],
  "watchpoints": [{ "point": "string", "detail": "string", "severity": "low|medium|high" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high" }]
}

Règles :
- Dans documentsMissing, signale les sections manquantes comme hôtels, activités, car rental, transfert, documents de voyage, passeport/CNI, etc.
- Dans logicalInconsistencies, signale les incohérences logiques (ex. hôtel avant l'arrivée du vol).
- Dans missingElements, signale les éléments absents ou non couverts (ex. absence de transfert entre aéroport et hôtel).
- Dans timeAlerts, signale les risques temporels (ex. escale trop courte < 1h, horaire impossible).
- Dans watchpoints, signale les éléments à suivre avant le départ et les dossiers à vérifier (CNI/passeport).
- Dans recommendedActions, propose les actions à faire pour l'agence.
- Si rien n'est trouvé, renvoie des tableaux vides [].`
  };
};

const parseContent = raw => {
  if (!raw) return null;

  if (typeof raw === "string") {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    return raw;
  }

  return null;
};

const normalizeAiPayload = payload => {
  const result = payload && typeof payload === "object" ? payload : {};

  return {
    tripSummary: normalizeText(result.tripSummary) || "Analyse du voyage réalisée à partir des étapes disponibles.",
    documentsMissing: arrayFrom(result.documentsMissing).map(item => ({
      section: normalizeText(item?.section) || "Section inconnue",
      reason: normalizeText(item?.reason) || "Document non identifié.",
      severity: ["low", "medium", "high"].includes(item?.severity) ? item.severity : "medium",
    })),
    logicalInconsistencies: arrayFrom(result.logicalInconsistencies).map(item => ({
      issue: normalizeText(item?.issue) || "Incohérence détectée",
      detail: normalizeText(item?.detail) || "Détail non précisé.",
      severity: ["low", "medium", "high"].includes(item?.severity) ? item.severity : "medium",
    })),
    missingElements: arrayFrom(result.missingElements).map(item => ({
      issue: normalizeText(item?.issue) || "Élément manquant",
      detail: normalizeText(item?.detail) || "Détail non précisé.",
      severity: ["low", "medium", "high"].includes(item?.severity) ? item.severity : "medium",
    })),
    timeAlerts: arrayFrom(result.timeAlerts).map(item => ({
      issue: normalizeText(item?.issue) || "Alerte temporelle",
      detail: normalizeText(item?.detail) || "Détail non précisé.",
      severity: ["low", "medium", "high"].includes(item?.severity) ? item.severity : "medium",
    })),
    watchpoints: arrayFrom(result.watchpoints).map(item => ({
      point: normalizeText(item?.point) || "Point à surveiller",
      detail: normalizeText(item?.detail) || "Détail non précisé.",
      severity: ["low", "medium", "high"].includes(item?.severity) ? item.severity : "medium",
    })),
    recommendedActions: arrayFrom(result.recommendedActions).map(item => ({
      action: normalizeText(item?.action) || "Action à définir",
      priority: ["low", "medium", "high"].includes(item?.priority) ? item.priority : "medium",
    })),
  };
};

const determineLocalFallback = payload => {
  const steps = compactTravelSummary(payload);
  const documentsMissing = [];
  const logicalInconsistencies = [];
  const missingElements = [];
  const timeAlerts = [];
  const watchpoints = [];
  const recommendedActions = [];

  const types = steps.map(step => step.type.toLowerCase());
  const hasHotel = types.some(type => type.includes("hotel") || type.includes("hébergement") || type.includes("hôtel"));
  const hasFlight = types.some(type => type.includes("vol") || type.includes("flight"));
  const hasTransfer = types.some(type => type.includes("transfert") || type.includes("transfer") || type.includes("train") || type.includes("taxi") || type.includes("voiture"));
  const hasActivity = types.some(type => type.includes("activité") || type.includes("activity"));
  const hasRental = types.some(type => type.includes("car") || type.includes("vehicle") || type.includes("location"));

  const requiredSections = [
    { label: "Hôtel", present: hasHotel, reason: "Aucun hébergement renseigné dans les étapes du voyage." },
    { label: "Transfert", present: hasTransfer, reason: "Aucun transfert / transport de correspondance renseigné." },
    { label: "Activité", present: hasActivity, reason: "Aucune activité planifiée n’a été détectée." },
    { label: "Car rental", present: hasRental, reason: "Aucune location de voiture / car rental détectée." },
  ];

  for (const section of requiredSections) {
    if (!section.present) {
      documentsMissing.push({
        section: section.label,
        reason: section.reason,
        severity: "medium",
      });
    }
  }

  if (hasHotel && hasFlight) {
    const hotelStep = steps.find(step => /hotel|hôtel|hébergement/i.test(step.type));
    const flightArrival = steps.find(step => /flight|vol/i.test(step.type) && step.arrivalDate);

    if (hotelStep && flightArrival && hotelStep.date && flightArrival.arrivalDate) {
      const hotelDate = new Date(`${hotelStep.date}T00:00:00`);
      const arrivalDate = new Date(`${flightArrival.arrivalDate}T00:00:00`);
      if (hotelDate < arrivalDate) {
        logicalInconsistencies.push({
          issue: "Hôtel réservé avant arrivée du vol",
          detail: `L’hébergement est planifié avant l’arrivée du vol ${flightArrival.type}.`,
          severity: "high",
        });
      }
    }
  }

  if (hasFlight && hasHotel && !hasTransfer) {
    missingElements.push({
      issue: "Absence de transfert entre aéroport et hôtel",
      detail: "Un vol et un hébergement sont présents sans correspondance de transport explicite.",
      severity: "medium",
    });
  }

  for (let i = 0; i < steps.length - 1; i += 1) {
    const current = steps[i];
    const next = steps[i + 1];

    if (current.date && next.date && current.arrivalDate && next.date) {
      const currentEnd = new Date(`${current.arrivalDate || current.date}T${current.arrivalTime || "23:59"}:00`);
      const nextStart = new Date(`${next.date}T${next.time || "00:00"}:00`);
      const deltaHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);
      if (deltaHours > 0 && deltaHours < 1) {
        timeAlerts.push({
          issue: "Risque d’escale ou de transfert trop court",
          detail: `Écart de ${deltaHours.toFixed(1)}h entre ${current.type} et ${next.type}.`,
          severity: "high",
        });
      }
    }
  }

  if (!steps.some(step => /passport|cni|passport|identity|passeport|cni/i.test(`${step.type} ${step.title} ${step.location}`))) {
    watchpoints.push({
      point: "Documents de voyage",
      detail: "Aucun élément de vérification de passeport/CNI n’a été repéré dans l’itinéraire exporté.",
      severity: "medium",
    });
  }

  if (steps.length === 0) {
    watchpoints.push({
      point: "Dossier incomplet",
      detail: "Aucune étape structurée détectée. Le dossier doit être vérifié manuellement avant le départ.",
      severity: "high",
    });
  }

  if (documentsMissing.length || logicalInconsistencies.length || missingElements.length || timeAlerts.length) {
    recommendedActions.push({
      action: "Contacter l’agence pour valider les éléments manquants, les correspondances logistiques et les horaires avant départ.",
      priority: "high",
    });
  }

  if (watchpoints.length > 0) {
    recommendedActions.push({
      action: "Demander la confirmation des documents de voyage et des éléments de suivi critiques avant le départ.",
      priority: "medium",
    });
  }

  return {
    tripSummary: steps.length
      ? `Voyage avec ${steps.length} étape(s) détectée(s), à vérifier dans son ensemble avant départ.`
      : "Aucune étape structurée détectée ; le dossier doit être vérifié manuellement.",
    documentsMissing,
    logicalInconsistencies,
    missingElements,
    timeAlerts,
    watchpoints,
    recommendedActions,
  };
};

const safeFetchAi = async (prompt, config, timeoutMs) => {
  const endpoint = config.endpoint || "/api/analyze-travel";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI endpoint error: ${response.status}`);
    }

    const data = await response.json();
    const payload = data?.result || data;
    return parseContent(payload || "{}");
  } finally {
    clearTimeout(timeoutId);
  }
};

export const analyzeTravelWithAI = async (payload, options = {}) => {
  const config = getAiConfig();
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const prompt = buildPrompt(payload);

  try {
    const aiResult = await safeFetchAi(prompt, config, timeoutMs);
    if (aiResult && typeof aiResult === "object") {
      return normalizeAiPayload(aiResult);
    }
  } catch (error) {
    console.warn("AI analysis failed, using local fallback.", error);
  }

  return normalizeAiPayload(determineLocalFallback(payload));
};

export const localFallbackAnalysis = payload => normalizeAiPayload(determineLocalFallback(payload));

export default {
  analyzeTravelWithAI,
  localFallbackAnalysis,
  buildPrompt,
  compactTravelSummary,
};
