import type { AuditReport } from "./audit";
import { Ai360Error, OPENROUTER_ENDPOINT, TRANSIENT_STATUSES } from "./ai360";

export type BuiltItineraryEvent = {
  time: string;
  type: string;
  title: string;
  subtitle?: string;
  location: string;
  reference: string;
  notes: string;
};

export type BuiltItineraryDay = {
  date: string;
  label: string;
  city?: string;
  events: BuiltItineraryEvent[];
  warnings?: string[];
};

export type BuiltItinerary = {
  destination: string;
  period: string;
  travelers: Array<{ name: string; details?: string }>;
  days: BuiltItineraryDay[];
  undated: Array<{ type: string; title: string; notes: string }>;
  detectedTypes: Array<{ type: string; count: number; evidence: string }>;
};

export type ItineraryBuildOptions = {
  apiKey: string;
  model?: string;
  retryBaseDelayMs?: number;
  maxRetriesPerAttempt?: number;
};

const ITINERARY_SYSTEM_PROMPT = "Tu es un agent de voyage senior specialise dans la structuration de dossiers premium. MISSION : reconstruire, a partir du JSON brut d un dossier de voyage exporte par l extension OnSpot (champ donneesBrutesExtension) et du resume des vouchers (vouchers), une chronologie jour par jour complete et exacte du sejour. REGLES IMPERATIVES : le JSON brut est ta SEULE source de verite, n invente aucune information absente du texte fourni. Si un champ precis manque (heure, reference, lieu), indique (a verifier) pour ce champ plutot que de l omettre ou de le deviner. Toutes les dates doivent etre normalisees au format ISO strict AAAA-MM-JJ, en deduisant l annee du contexte global du sejour si besoin, sans jamais inventer un jour ou un mois. Chaque titre d evenement doit etre le nom commercial reel de la prestation, jamais uniquement sa categorie generique. Type de chaque evenement strictly parmi Vol, Hotel, Activite, Transfert, Train, Location voiture, Ferry / bateau. Classe les evenements par ordre chronologique strict a l interieur de chaque jour, puis les jours par ordre chronologique. Place dans undated tout element dont la date est reellement introuvable. detectedTypes doit couvrir obligatoirement les 7 types ci-dessus, meme a 0 occurrence, avec une courte justification. Ne fusionne jamais deux prestations distinctes, et ne dedouble jamais une meme prestation mentionnee dans plusieurs sources (voucher et itineraire), c est le meme evenement, une seule entree. Reponds uniquement en francais, et uniquement au format JSON demande par le message utilisateur, sans texte ni commentaire autour.";

function extractVoucherSummary(raw: Record<string, unknown>): string {
  if (typeof raw.vouchersSummary === "string") return raw.vouchersSummary;
  const itinerary = raw.itinerary as Record<string, unknown> | undefined;
  if (itinerary && typeof itinerary.vouchersTab === "string") return itinerary.vouchersTab;
  return "";
}

function normalizeOutputDate(value: unknown): string {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

function dayLabel(date: string): string {
  if (!date) return "Date à vérifier";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "Date à vérifier" : parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

export function normalizeBuiltItinerary(value: unknown): BuiltItinerary {
  const source = (value && typeof value === "object" ? value : {}) as Partial<BuiltItinerary>;
  const destination = String(source.destination || "Destination à vérifier");
  return {
    destination,
    period: String(source.period || "Période à vérifier"),
    travelers: Array.isArray(source.travelers) ? source.travelers : [],
    days: Array.isArray(source.days)
      ? source.days.map(day => {
          const date = normalizeOutputDate(day?.date);
          return {
            date,
            label: date ? dayLabel(date) : String(day?.label || "Date à vérifier"),
            city: day?.city ? String(day.city) : destination,
            events: Array.isArray(day?.events) ? day.events : [],
            warnings: Array.isArray(day?.warnings) ? day.warnings : [],
          };
        })
      : [],
    undated: Array.isArray(source.undated) ? source.undated : [],
    detectedTypes: Array.isArray(source.detectedTypes) ? source.detectedTypes : [],
  };
}

export async function runItineraryBuild(report: AuditReport, options: ItineraryBuildOptions): Promise<{ result: BuiltItinerary; model: string; estimatedInputChars: number }> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Ai360Error("missing-key", "Une clé OpenRouter est requise.");
  const model = options.model?.trim() || "openai/gpt-4o-mini";
  const rawPayload = JSON.stringify(report.raw ?? {});
  const vouchers = extractVoucherSummary(report.raw ?? {});
  const outputSchema = "{\"destination\":\"\",\"period\":\"\",\"travelers\":[{\"name\":\"\",\"details\":\"\"}],\"days\":[{\"date\":\"AAAA-MM-JJ\",\"label\":\"\",\"city\":\"\",\"events\":[{\"time\":\"\",\"type\":\"\",\"title\":\"\",\"subtitle\":\"\",\"location\":\"\",\"reference\":\"\",\"notes\":\"\"}],\"warnings\":[]}],\"undated\":[{\"type\":\"\",\"title\":\"\",\"notes\":\"\"}],\"detectedTypes\":[{\"type\":\"\",\"count\":0,\"evidence\":\"\"}]}";
  const userMessage = "Donnees brutes du dossier (JSON) : " + rawPayload + " Resume des vouchers : " + (vouchers || "(non fourni)") + " Reponds uniquement avec un JSON valide au format exact suivant, sans texte autour : " + outputSchema;
  const maxRetries = options.maxRetriesPerAttempt ?? 1;
  const baseDelay = options.retryBaseDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, Math.min(15000, baseDelay * 2 ** (attempt - 1))));
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: ITINERARY_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: 0.05,
        }),
      });
      if (!response.ok) {
        if (TRANSIENT_STATUSES.has(response.status) && attempt < maxRetries) continue;
        throw new Ai360Error(
          response.status === 401 || response.status === 403 ? "invalid-key" : TRANSIENT_STATUSES.has(response.status) ? "overloaded" : "network",
          TRANSIENT_STATUSES.has(response.status) ? `OpenRouter est momentanément indisponible (réponse ${response.status}).` : `OpenRouter a répondu avec le statut ${response.status}.`,
        );
      }
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Ai360Error("invalid-response", "OpenRouter n’a renvoyé aucune chronologie exploitable.");
      const cleaned = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      return { result: normalizeBuiltItinerary(JSON.parse(json)), model, estimatedInputChars: rawPayload.length };
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
