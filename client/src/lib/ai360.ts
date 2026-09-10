import type { AuditReport } from "./audit";

export interface Ai360Result {
  tripNarrative?: {
    headline?: string;
    overview?: string;
    composition?: string;
    particularities?: string[];
    operationalState?: string;
    openPoints?: string[];
    resolvedPoints?: string[];
    dayReads?: Array<{
      dayIndex: number;
      date: string;
      summary: string;
      attention?: string[];
    }>;
  };
  ticketExplanations?: Array<{
    ticketId: string;
    explanation: string;
    subProblems?: string[];
  }>;
  agencyReport?: {
    subject: string;
    body: string;
  };
  situation: string;
  verdict: "stable" | "attention" | "bloquant";
  newInconsistencies: string[];
  actions: string[];
  timeline?: Array<{
    at: string;
    branch: string;
    event: string;
    consequence: string;
  }>;
  responsibilities?: Array<{
    owner: string;
    items: string[];
  }>;
  confidence: number;
  limitations?: string[];
}

export type Ai360Options = {
  apiKey: string;
  model?: string;
  retryBaseDelayMs?: number;
  maxRetriesPerAttempt?: number;
};

export class Ai360Error extends Error {
  readonly kind: "missing-key" | "invalid-key" | "overloaded" | "network" | "invalid-response";

  constructor(kind: Ai360Error["kind"], message: string) {
    super(message);
    this.name = "Ai360Error";
    this.kind = kind;
  }
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function buildAiEvidencePack(report: AuditReport) {
  return {
    dossier: {
      reference: report.reference,
      destination: report.destination,
      startDate: report.startDate,
      endDate: report.endDate,
      travelers: report.travelers,
      metadata: report.metadata,
    },
    itinerary: report.steps,
    checks: report.checks.filter(check => check.status !== "ok"),
    tickets: report.tickets,
    localElite: report.elite,
  };
}

export function normalizeAi360Result(value: unknown): Ai360Result {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Ai360Result>;
  let parsedConfidence = 0;
  if (typeof v.confidence === "number" && !isNaN(v.confidence)) {
    parsedConfidence = v.confidence;
  } else if (typeof v.confidence === "string") {
    const num = parseFloat(v.confidence);
    parsedConfidence = !isNaN(num) ? num : 0;
  }

  return {
    tripNarrative: v.tripNarrative ?? {
      headline: "", overview: "", composition: "", particularities: [],
      operationalState: "", openPoints: [], resolvedPoints: [], dayReads: []
    },
    ticketExplanations: Array.isArray(v.ticketExplanations) ? v.ticketExplanations : [],
    agencyReport: v.agencyReport && typeof v.agencyReport === "object" ? {
      subject: typeof v.agencyReport.subject === "string" ? v.agencyReport.subject : "",
      body: typeof v.agencyReport.body === "string" ? v.agencyReport.body : "",
    } : { subject: "", body: "" },
    situation: typeof v.situation === "string" ? v.situation : "",
    verdict: v.verdict === "attention" || v.verdict === "bloquant" ? v.verdict : "stable",
    newInconsistencies: asStringArray(v.newInconsistencies),
    actions: asStringArray(v.actions),
    timeline: Array.isArray(v.timeline) ? v.timeline : [],
    responsibilities: Array.isArray(v.responsibilities) ? v.responsibilities : [],
    confidence: parsedConfidence,
    limitations: Array.isArray(v.limitations) ? v.limitations : [],
  };
}

export function parseJson(cleaned: string): Ai360Result {
  try {
    const raw = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? cleaned;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    return normalizeAi360Result(JSON.parse(json));
  } catch {
    return normalizeAi360Result({});
  }
}

export async function runAi360Analysis(report: AuditReport, options: Ai360Options): Promise<{ result: Ai360Result; model: string; estimatedInputChars: number }> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Ai360Error("missing-key", "Une clé OpenRouter est requise.");
  const model = options.model?.trim() || "openai/gpt-4o-mini";
  const prompt = JSON.stringify(buildAiEvidencePack(report));
  const maxRetries = options.maxRetriesPerAttempt ?? 1;
  const baseDelay = options.retryBaseDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, Math.min(15000, baseDelay * 2 ** (attempt - 1))));
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: "Tu dois obligatoirement répondre au format JSON." }, { role: "user", content: prompt }], response_format: { type: "json_object" } }),
      });
      if (!response.ok) {
        if (TRANSIENT_STATUSES.has(response.status) && attempt < maxRetries) continue;
        throw new Ai360Error(
          response.status === 401 || response.status === 403
            ? "invalid-key"
            : TRANSIENT_STATUSES.has(response.status)
              ? "overloaded"
              : "network",
          TRANSIENT_STATUSES.has(response.status)
            ? `OpenRouter est momentanément indisponible (réponse ${response.status}).`
            : `OpenRouter a répondu avec le statut ${response.status}.`,
        );
      }
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Ai360Error("invalid-response", "OpenRouter n’a renvoyé aucune analyse exploitable.");
      return { result: parseJson(content), model, estimatedInputChars: prompt.length };
    } catch (error) {
      lastError = error;
      if (error instanceof Ai360Error) {
        if (error.kind !== "network" || attempt >= maxRetries) throw error;
      } else if (attempt >= maxRetries) {
        throw new Ai360Error("network", "La connexion à OpenRouter a échoué.");
      }
    }
  }
  throw lastError instanceof Ai360Error ? lastError : new Ai360Error("network", "OpenRouter n’a pas pu être contacté.");
}
