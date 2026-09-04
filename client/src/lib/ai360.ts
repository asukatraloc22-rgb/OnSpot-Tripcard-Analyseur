import type { AuditReport } from "./audit";
import { buildTripNarrative, explainTicket, type TicketExplanation, type TripNarrative } from "./explanations";

export type Ai360Result = {
  tripNarrative: TripNarrative;
  ticketExplanations: TicketExplanation[];
  agencyReport: { subject: string; body: string };
  situation: string;
  verdict: "stable" | "attention" | "bloquant";
  newInconsistencies: Array<{ title: string; severity: "info" | "warning" | "blocking"; evidence: string; whyItMatters: string }>;
  actions: Array<{ order: number; action: string; responsible: string; deadline: string; dependsOn?: string; messageToSend?: string }>;
  timeline: Array<{ at: string; branch: string; event: string; consequence: string }>;
  responsibilities: Array<{ owner: string; items: string[] }>;
  confidence: number;
  limitations: string[];
};

export type Ai360Options = {
  apiKey: string;
  model?: string;
  /** Optional second key from another Google project/account. Keys are tried in order. */
  apiKeys?: string[];
  /** Kept injectable for deterministic tests; production uses 1000 ms. */
  retryBaseDelayMs?: number;
  maxRetriesPerAttempt?: number;
};

export class Ai360Error extends Error {
  readonly kind: "missing-key" | "invalid-key" | "overloaded" | "network" | "invalid-response";
  readonly attempts: Array<{ model: string; status?: number; message: string }>;

  constructor(kind: Ai360Error["kind"], message: string, attempts: Ai360Error["attempts"] = []) {
    super(message);
    this.name = "Ai360Error";
    this.kind = kind;
    this.attempts = attempts;
  }
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const clamp = (value: string, max: number) => value.length > max ? `${value.slice(0, max)}…` : value;
const text = (value: unknown) => typeof value === "string" ? value : "";

export function buildAiEvidencePack(report: AuditReport) {
  const localExplanations = report.tickets.map((ticket, index) => explainTicket(ticket, report, index));
  const localNarrative = buildTripNarrative(report, localExplanations);
  return {
    dossier: {
      reference: report.reference,
      localNarrative: { overview: localNarrative.overview, composition: localNarrative.composition, openPoints: localNarrative.openPoints.slice(0, 10), resolvedPoints: localNarrative.resolvedPoints.slice(0, 10), dayReads: localNarrative.dayReads.slice(0, 20) },
      destination: report.destination,
      startDate: report.startDate,
      endDate: report.endDate,
      travelers: report.travelers.slice(0, 12),
      metadata: { agency: report.metadata.agency, tripId: report.metadata.tripId, package: report.metadata.package, profileNotes: report.metadata.profileNotes.slice(0, 8) },
    },
    itinerary: report.steps.slice(0, 30).map(step => ({ id: step.id, type: step.type, title: clamp(step.title, 160), location: clamp(step.location, 180), date: step.date, time: step.time })),
    checks: report.checks.filter(check => check.status !== "ok").slice(0, 25).map(check => ({ domain: check.domain, label: check.label, status: check.status, finding: clamp(check.finding, 320), evidence: clamp(check.evidence, 320), action: clamp(check.action ?? "", 320) })),
    tickets: report.tickets.slice(0, 30).map((ticket, ticketIndex) => ({
      id: ticket.id,
      number: ticket.ticketNumber,
      status: ticket.current.status,
      priority: ticket.current.priority,
      category: ticket.current.category,
      subject: clamp(ticket.current.subject ?? "", 180),
      episode: ticket.episode,
      classification: ticket.classification,
      localExplanation: localExplanations[ticketIndex],
      whatRemains: ticket.whatRemains.slice(0, 6).map(item => clamp(item, 280)),
      messages: ticket.messages.slice(-4).map(message => ({ at: message.createdAt, author: message.author, text: clamp(message.text, 900) })),
      events: [...ticket.events, ...ticket.statusTransitions].slice(-8).map(event => { const item = event as { createdAt?: string; at?: string; kind?: string; summary?: string; from?: string; to?: string; actor?: string }; return { at: item.createdAt ?? item.at, kind: item.kind ?? "status", summary: clamp(item.summary ?? `${item.from ?? ""} → ${item.to ?? ""}`, 260), actor: item.actor }; }),
      attachments: ticket.attachments.slice(0, 8).map(attachment => ({ name: attachment.name, kind: attachment.kind, extractionStatus: attachment.extractionStatus, excerpt: clamp(attachment.excerpt ?? "", 500) })),
    })),
    localElite: {
      flags: report.elite.flags.slice(0, 20).map(flag => ({ severity: flag.severity, label: flag.label, description: clamp(flag.description, 300), action: clamp(flag.action, 320), evidence: clamp(flag.evidence ?? "", 320), responsible: flag.responsible })),
      reminders: report.elite.reminderPlan,
      responsibilities: report.elite.responsibilities,
      suggestions: report.elite.proactiveSuggestions.suggestions.slice(0, 4),
    },
  };
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    tripNarrative: { type: "OBJECT", properties: { headline: { type: "STRING" }, overview: { type: "STRING" }, composition: { type: "STRING" }, particularities: { type: "ARRAY", items: { type: "STRING" } }, operationalState: { type: "STRING" }, openPoints: { type: "ARRAY", items: { type: "STRING" } }, resolvedPoints: { type: "ARRAY", items: { type: "STRING" } }, dayReads: { type: "ARRAY", items: { type: "OBJECT", properties: { dayIndex: { type: "INTEGER" }, date: { type: "STRING" }, summary: { type: "STRING" }, steps: { type: "ARRAY", items: { type: "STRING" } }, attention: { type: "ARRAY", items: { type: "STRING" } } }, required: ["dayIndex", "date", "summary", "steps", "attention"] } } }, required: ["headline", "overview", "composition", "particularities", "operationalState", "openPoints", "resolvedPoints", "dayReads"] },
    ticketExplanations: { type: "ARRAY", items: { type: "OBJECT", properties: { ticketId: { type: "STRING" }, oneLine: { type: "STRING" }, subject: { type: "STRING" }, tripElement: { type: "STRING" }, initialSituation: { type: "STRING" }, currentSituation: { type: "STRING" }, rootCause: { type: "STRING" }, impact: { type: "STRING" }, impactLabel: { type: "STRING" }, actionsDone: { type: "ARRAY", items: { type: "STRING" } }, remaining: { type: "ARRAY", items: { type: "STRING" } }, missingEvidence: { type: "ARRAY", items: { type: "STRING" } } }, required: ["ticketId", "oneLine", "subject", "tripElement", "initialSituation", "currentSituation", "rootCause", "impact", "impactLabel", "actionsDone", "remaining", "missingEvidence"] } },
    agencyReport: { type: "OBJECT", properties: { subject: { type: "STRING" }, body: { type: "STRING" } }, required: ["subject", "body"] },
    situation: { type: "STRING" },
    verdict: { type: "STRING", enum: ["stable", "attention", "bloquant"] },
    newInconsistencies: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, severity: { type: "STRING", enum: ["info", "warning", "blocking"] }, evidence: { type: "STRING" }, whyItMatters: { type: "STRING" } }, required: ["title", "severity", "evidence", "whyItMatters"] } },
    actions: { type: "ARRAY", items: { type: "OBJECT", properties: { order: { type: "INTEGER" }, action: { type: "STRING" }, responsible: { type: "STRING" }, deadline: { type: "STRING" }, dependsOn: { type: "STRING" }, messageToSend: { type: "STRING" } }, required: ["order", "action", "responsible", "deadline"] } },
    timeline: { type: "ARRAY", items: { type: "OBJECT", properties: { at: { type: "STRING" }, branch: { type: "STRING" }, event: { type: "STRING" }, consequence: { type: "STRING" } }, required: ["at", "branch", "event", "consequence"] } },
    responsibilities: { type: "ARRAY", items: { type: "OBJECT", properties: { owner: { type: "STRING" }, items: { type: "ARRAY", items: { type: "STRING" } } }, required: ["owner", "items"] } },
    confidence: { type: "NUMBER" },
    limitations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["tripNarrative", "ticketExplanations", "agencyReport", "situation", "verdict", "newInconsistencies", "actions", "timeline", "responsibilities", "confidence", "limitations"],
};

function parseJson(textValue: string): Ai360Result {
  const cleaned = textValue.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!cleaned) throw new Ai360Error("invalid-response", "OpenRouter a renvoyé une réponse vide.");
  try {
    return JSON.parse(cleaned) as Ai360Result;
  } catch {
    throw new Ai360Error("invalid-response", "OpenRouter a renvoyé un JSON incomplet ou invalide.");
  }
}

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));
const appOrigin = () => globalThis.location?.origin || "http://localhost";

function friendlyApiError(status: number, detail: string, model: string) {
  if (status === 401 || status === 403) return { kind: "invalid-key" as const, message: `La clé OpenRouter a été refusée. Vérifiez qu’elle est active. Modèle essayé : ${model}.`, attempts: [] };
  if (TRANSIENT_STATUSES.has(status)) return { kind: "overloaded" as const, message: `OpenRouter est momentanément indisponible (réponse ${status}). La synthèse locale reste disponible.`, attempts: [{ model, status, message: detail }] };
  return { kind: "network" as const, message: `OpenRouter a refusé l’analyse (réponse ${status}).`, attempts: [{ model, status, message: detail }] };
}

async function requestModel(prompt: string, apiKey: string, model: string, maxRetries: number, baseDelayMs: number, attempts: Ai360Error["attempts"]) {
  for (let retry = 0; retry <= maxRetries; retry += 1) {
    if (retry > 0) await wait(Math.min(15000, baseDelayMs * (2 ** (retry - 1))));
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": appOrigin(), "X-Title": "OnSpot TripCard Analyseur" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: "Tu es un copilote opérationnel OnSpot Travel. Tu es précis, prudent et orienté résolution." }, { role: "user", content: prompt }], temperature: 0.1, response_format: { type: "json_object" }, max_tokens: 2500 }),
      });
      if (!response.ok) {
        const detail = clamp(await response.text(), 500);
        attempts.push({ model, status: response.status, message: detail });
        if (TRANSIENT_STATUSES.has(response.status) && retry < maxRetries) continue;
        throw friendlyApiError(response.status, detail, model);
      }
      const rawBody = await response.text();
      let data: { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>; error?: { message?: string } };
      try {
        data = JSON.parse(rawBody) as typeof data;
      } catch {
        throw new Ai360Error("invalid-response", rawBody.trim() ? "OpenRouter a renvoyé une réponse non JSON." : "OpenRouter a renvoyé une réponse vide.");
      }
      const content = data.choices?.[0]?.message?.content;
      const output = text(Array.isArray(content) ? content.map(part => part.text ?? "").join("") : content);
      if (!output) throw new Ai360Error("invalid-response", data.error?.message || "OpenRouter n’a renvoyé aucune analyse exploitable.", attempts);
      try {
        return parseJson(output);
      } catch (error) {
        if (error instanceof Ai360Error) throw error;
        throw new Ai360Error("invalid-response", "OpenRouter a renvoyé un JSON incomplet ou invalide.");
      }
    } catch (error) {
      if (error instanceof Ai360Error) throw error;
      if (typeof error === "object" && error !== null && typeof (error as { kind?: unknown }).kind === "string") {
        const typedError = error as Ai360Error;
        throw new Ai360Error(typedError.kind, typedError.message, typedError.attempts);
      }
      const detail = error instanceof Error ? error.message : String(error);
      attempts.push({ model, message: detail });
      if (retry >= maxRetries) {
        throw new Ai360Error(
          "network",
          `La connexion à OpenRouter a échoué : ${detail || "le navigateur a bloqué la requête"}. Vérifiez la console réseau et les permissions du navigateur.`,
          attempts,
        );
      }
    }
  }
  throw new Ai360Error("network", "OpenRouter n’a pas pu être contacté.", attempts);
}

export async function runAi360Analysis(report: AuditReport, options: Ai360Options): Promise<{ result: Ai360Result; model: string; estimatedInputChars: number }> {
  const keys = [options.apiKey, ...(options.apiKeys ?? [])].map(key => key.trim()).filter(Boolean);
  if (!keys.length) throw new Ai360Error("missing-key", "Clé OpenRouter absente. Ajoutez-la dans les réglages IA locaux.");
  const models = Array.from(new Set([options.model?.trim() || DEFAULT_MODEL]));
  const evidence = JSON.stringify(buildAiEvidencePack(report));
  const prompt = `Analyse ce dossier de voyage et ses tickets comme un agent Elite senior. Explique le voyage, les incohérences nouvelles, les actions ordonnées, les responsabilités et les échéances. Ne transforme jamais une mention en preuve. Si une information manque, indique-le explicitement. Retourne uniquement le JSON conforme au schéma.\n\nPREUVES COMPACTES:\n${evidence}`;
  const attempts: Ai360Error["attempts"] = [];
  let lastError: Ai360Error | undefined;
  for (const apiKey of keys) for (const model of models) {
    try {
      const result = await requestModel(prompt, apiKey, model, options.maxRetriesPerAttempt ?? 2, options.retryBaseDelayMs ?? 1000, attempts);
      return { result, model, estimatedInputChars: prompt.length };
    } catch (error) {
      if (error instanceof Ai360Error) lastError = error;
      else if (typeof error === "object" && error !== null && typeof (error as { kind?: unknown }).kind === "string") lastError = error as Ai360Error;
      else lastError = new Ai360Error("network", "Analyse IA impossible.", attempts);
      if (lastError.kind === "invalid-key" || lastError.kind === "invalid-response") break;
    }
  }
  throw new Ai360Error(lastError?.kind ?? "network", lastError?.message ?? "Analyse IA impossible.", attempts);
}
