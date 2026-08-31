import type { AuditReport } from "./audit";

export type Ai360Result = {
  situation: string;
  verdict: "stable" | "attention" | "bloquant";
  newInconsistencies: Array<{ title: string; severity: "info" | "warning" | "blocking"; evidence: string; whyItMatters: string }>;
  actions: Array<{ order: number; action: string; responsible: string; deadline: string; dependsOn?: string; messageToSend?: string }>;
  timeline: Array<{ at: string; branch: string; event: string; consequence: string }>;
  responsibilities: Array<{ owner: string; items: string[] }>;
  confidence: number;
  limitations: string[];
};

type Ai360Options = { apiKey: string; model?: string };

const clamp = (value: string, max: number) => value.length > max ? `${value.slice(0, max)}…` : value;
const text = (value: unknown) => typeof value === "string" ? value : "";

export function buildAiEvidencePack(report: AuditReport) {
  return {
    dossier: {
      reference: report.reference,
      destination: report.destination,
      startDate: report.startDate,
      endDate: report.endDate,
      travelers: report.travelers.slice(0, 12),
      metadata: { agency: report.metadata.agency, tripId: report.metadata.tripId, package: report.metadata.package, profileNotes: report.metadata.profileNotes.slice(0, 8) },
    },
    itinerary: report.steps.slice(0, 30).map(step => ({ id: step.id, type: step.type, title: clamp(step.title, 160), location: clamp(step.location, 180), date: step.date, time: step.time })),
    checks: report.checks.filter(check => check.status !== "ok").slice(0, 25).map(check => ({ domain: check.domain, label: check.label, status: check.status, finding: clamp(check.finding, 320), evidence: clamp(check.evidence, 320), action: clamp(check.action ?? "", 320) })),
    tickets: report.tickets.slice(0, 30).map(ticket => ({
      id: ticket.id,
      number: ticket.ticketNumber,
      status: ticket.current.status,
      priority: ticket.current.priority,
      category: ticket.current.category,
      subject: clamp(ticket.current.subject ?? "", 180),
      episode: ticket.episode,
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
    situation: { type: "STRING" },
    verdict: { type: "STRING", enum: ["stable", "attention", "bloquant"] },
    newInconsistencies: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, severity: { type: "STRING", enum: ["info", "warning", "blocking"] }, evidence: { type: "STRING" }, whyItMatters: { type: "STRING" } }, required: ["title", "severity", "evidence", "whyItMatters"] } },
    actions: { type: "ARRAY", items: { type: "OBJECT", properties: { order: { type: "INTEGER" }, action: { type: "STRING" }, responsible: { type: "STRING" }, deadline: { type: "STRING" }, dependsOn: { type: "STRING" }, messageToSend: { type: "STRING" } }, required: ["order", "action", "responsible", "deadline"] } },
    timeline: { type: "ARRAY", items: { type: "OBJECT", properties: { at: { type: "STRING" }, branch: { type: "STRING" }, event: { type: "STRING" }, consequence: { type: "STRING" } }, required: ["at", "branch", "event", "consequence"] } },
    responsibilities: { type: "ARRAY", items: { type: "OBJECT", properties: { owner: { type: "STRING" }, items: { type: "ARRAY", items: { type: "STRING" } } }, required: ["owner", "items"] } },
    confidence: { type: "NUMBER" },
    limitations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["situation", "verdict", "newInconsistencies", "actions", "timeline", "responsibilities", "confidence", "limitations"],
};

function parseJson(textValue: string): Ai360Result {
  const cleaned = textValue.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as Ai360Result;
}

export async function runAi360Analysis(report: AuditReport, options: Ai360Options): Promise<{ result: Ai360Result; model: string; estimatedInputChars: number }> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("Clé Gemini absente. Ajoutez-la dans les réglages IA locaux.");
  const model = options.model?.trim() || "gemini-flash-latest";
  const evidence = JSON.stringify(buildAiEvidencePack(report));
  const prompt = `Analyse ce dossier de voyage et ses tickets comme un agent Elite senior. Ne répète pas les contrôles locaux déjà conformes. Cherche uniquement les incohérences nouvelles ou insuffisamment prouvées, les dépendances entre actions, les responsabilités et les échéances. Chaque action doit être immédiatement exécutable et préciser le destinataire ou le message à envoyer si pertinent. Ne transforme jamais une mention en preuve. Si une information manque, indique-le explicitement. Retourne uniquement le JSON conforme au schéma.\n\nPREUVES COMPACTES:\n${evidence}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Tu es un copilote opérationnel OnSpot Travel. Tu es précis, prudent et orienté résolution." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema, maxOutputTokens: 2500 },
    }),
  });
  if (!response.ok) {
    const detail = clamp(await response.text(), 500);
    throw new Error(`Gemini ${response.status} : ${detail}`);
  }
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
  const output = text(data.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join(""));
  if (!output) throw new Error(data.error?.message || "Gemini n’a renvoyé aucune analyse exploitable.");
  return { result: parseJson(output), model, estimatedInputChars: prompt.length };
}
