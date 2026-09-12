import type { TicketItem, TripDocument } from "./tickets";
import type { LocalFinding } from "./audit";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

export class OpenRouterError extends Error {
  constructor(public kind: "missing-key" | "invalid-key" | "overloaded" | "network" | "invalid-response", message: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced);
}

async function callJson<T>(apiKey: string, model: string, system: string, user: unknown, maxRetries = 1): Promise<T> {
  if (!apiKey.trim()) throw new OpenRouterError("missing-key", "Renseigne une clé OpenRouter locale.");
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, Math.min(12000, 800 * 2 ** (attempt - 1))));
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(user) }
          ],
          response_format: { type: "json_object" },
          temperature: 0.05
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) {
        if (TRANSIENT.has(response.status) && attempt < maxRetries) continue;
        throw new OpenRouterError(
          response.status === 401 || response.status === 403 ? "invalid-key" : TRANSIENT.has(response.status) ? "overloaded" : "network",
          payload.error?.message || `OpenRouter a répondu avec le statut ${response.status}.`
        );
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new OpenRouterError("invalid-response", "OpenRouter n'a renvoyé aucun JSON exploitable.");
      try {
        return extractJson(content) as T;
      } catch {
        throw new OpenRouterError("invalid-response", "La réponse OpenRouter n'est pas un JSON valide.");
      }
    } catch (error) {
      if (error instanceof OpenRouterError && (error.kind !== "network" || attempt >= maxRetries)) throw error;
      if (attempt >= maxRetries) throw new OpenRouterError("network", "La connexion à OpenRouter a échoué.");
    }
  }
  throw new OpenRouterError("network", "OpenRouter n'a pas pu être contacté.");
}

// ---------------------------------------------------------------------------
// PROMPT 1 — Construction d'itinéraire.
// Doctrine : l'IA reconstruit la chronologie DIRECTEMENT depuis le JSON brut
// exporté par l'extension (donneesBrutesExtension). Le code JS n'interprète
// plus rien en amont, il transporte seulement la donnée source.
// ---------------------------------------------------------------------------
const itinerarySystem = `Tu es un agent de voyage senior spécialisé dans la structuration de dossiers premium.

MISSION : reconstruire, à partir du JSON brut exporté par l'extension OnSpot (champ "donneesBrutesExtension") et du résumé des vouchers ("vouchers"), une chronologie jour par jour complète et exacte du séjour.

RÈGLES IMPÉRATIVES :
- Le JSON brut est ta SEULE source de vérité. N'invente aucune information absente du texte fourni.
- Si un champ précis manque (heure, référence, lieu...), indique "(à vérifier)" pour ce champ plutôt que de l'omettre ou de le deviner.
- Toutes les dates doivent être normalisées au format ISO strict AAAA-MM-JJ. Si l'année n'est pas explicite, déduis-la du contexte global du séjour, sans jamais inventer un jour ou un mois.
- Chaque titre d'événement doit être le nom commercial réel de la prestation (nom d'hôtel, numéro de vol, nom de l'activité), jamais uniquement sa catégorie générique.
- Type de chaque événement STRICTEMENT parmi : "Vol", "Hôtel", "Activité", "Transfert", "Train", "Location voiture", "Ferry / bateau".
- Classe les événements par ordre chronologique strict à l'intérieur de chaque jour, puis les jours par ordre chronologique.
- Place dans "undated" tout élément dont la date est réellement introuvable dans le texte.
- "detectedTypes" doit couvrir OBLIGATOIREMENT les 7 types ci-dessus, même ceux à 0 occurrence (count:0, evidence expliquant l'absence).
- Ne fusionne jamais deux prestations distinctes en une seule, et ne dédouble jamais une même prestation mentionnée dans plusieurs sources (voucher + itinéraire) — c'est le même événement, une seule entrée.

Réponds UNIQUEMENT avec un JSON valide au format : {"destination":"","period":"","travelers":[{"name":"","details":""}],"days":[{"date":"AAAA-MM-JJ","label":"","city":"","night":{"title":"","location":"","notes":""},"events":[{"time":"","type":"","category":"","title":"","subtitle":"","location":"","departure":"","arrival":"","reference":"","notes":""}],"warnings":[]}],"undated":[{"type":"","title":"","notes":""}],"detectedTypes":[{"type":"","count":0,"evidence":""}]}. Français uniquement.`;

// ---------------------------------------------------------------------------
// PROMPT 2 — Analyse 360°.
// Doctrine : l'IA est pleinement décisionnelle sur la qualité du dossier.
// Elle raisonne comme un agent de voyage senior, pas comme un détecteur de
// motifs textuels superficiels.
// ---------------------------------------------------------------------------
const auditSystem = `Tu es un agent de voyage senior et contrôleur qualité final d'un voyage haut de gamme, avant départ. Tu as l'œil d'un professionnel qui a vu des centaines de dossiers et qui sait précisément où se cachent les erreurs coûteuses.

CONTEXTE FOURNI : l'itinéraire déjà construit (base de vérité de travail — ne le reconstruis pas, ne le remplace pas), le résumé des vouchers, les tickets de suivi, les notes opérateur, et éventuellement des contrôles locaux déjà calculés (résultats déterministes, à prendre comme indices, pas comme vérité absolue).

GRILLE DE DÉTECTION SYSTÉMATIQUE (balaie chacun de ces axes) :
1. Cohérence temporelle : chevauchements d'horaires, trous de programme sur une journée entière, nuits sans hébergement identifié, transferts programmés avant l'arrivée du vol associé.
2. Cohérence géographique : rupture de continuité entre deux lieux consécutifs sans transport identifié, transfert vers une destination incohérente avec l'étape suivante.
3. Cohérence documentaire : prestation mentionnée dans l'itinéraire sans voucher correspondant (ou l'inverse), divergence de nom/date/lieu entre voucher et itinéraire.
4. Complétude par type de prestation : vol sans PNR complet, hôtel sans référence de réservation, activité avec reconfirmation demandée mais non planifiée.
5. Cohérence voyageurs : nombre de places/chambres/sièges inférieur au nombre de voyageurs déclaré.
6. Documents d'identité : présence ou absence signalée de passeport/CNI par voyageur (jamais de jugement sur le contenu du document lui-même).

RÈGLES DE RIGUEUR :
- Ne signale jamais une "incohérence" basée sur une simple absence de mention textuelle si l'information est plausible mais non fournie — classe-la en "à vérifier avec l'agence", pas en anomalie.
- Un grand nombre de prestations le même jour n'est PAS une anomalie en soi. Ne crée une alerte que sur un conflit objectivable.
- N'invente jamais une incohérence pour remplir une catégorie vide — un dossier propre doit produire une liste vide, pas une liste artificielle.
- Chaque incohérence doit citer précisément les deux éléments comparés (ex : "voucher indique 21h10, itinéraire indique 20h55").

Classe chaque conclusion : red = critique, départ compromis, action immédiate nécessaire ; orange = à vérifier ou action à planifier, avec responsable ; green = contrôlé et conforme, avec preuve citée. Donne une décision globale GO, GO_WITH_CHECKS ou NO_GO.

Réponds UNIQUEMENT avec ce JSON : {"status":"stable|attention|blocking","globalDecision":"GO|GO_WITH_CHECKS|NO_GO","confidence":0,"summary":"","description":"","redItems":[{"code":"","title":"","detail":"","action":"","evidence":"","sourceRefs":[],"affectedServiceIds":[],"proofRequired":""}],"orangeItems":[{"code":"","title":"","detail":"","action":"","evidence":"","sourceRefs":[],"affectedServiceIds":[],"owner":"","proofRequired":""}],"greenChecks":[{"code":"","title":"","detail":"","evidence":"","sourceRefs":[]}],"duplicateCandidates":[],"dataReview":[],"crossSourceComparisons":[{"title":"","itineraryValue":"","voucherValue":"","roadbookValue":"","result":"match|mismatch|missing","action":""}],"actions":[{"priority":"red|orange|green","title":"","detail":"","owner":"","proofRequired":""}],"missingEvidence":[],"localRuleResults":[]}. Français uniquement.`;

export type BuiltItinerary = {
  destination: string;
  period: string;
  travelers: Array<{ name: string; details?: string }>;
  days: Array<{
    date: string;
    label: string;
    city?: string;
    night?: { title: string; location: string; notes: string } | null;
    events: Array<{
      time: string;
      type: string;
      category?: string;
      title: string;
      subtitle?: string;
      location: string;
      departure?: string;
      arrival?: string;
      reference: string;
      notes: string;
      sourceRefs?: string[];
    }>;
    warnings?: string[];
  }>;
  undated: Array<{ type: string; title: string; notes: string; sourceRefs?: string[] }>;
  detectedTypes: Array<{ type: string; count: number; evidence: string }>;
};

export type AuditItem = {
  code: string;
  title: string;
  detail: string;
  action?: string;
  evidence?: string;
  sourceRefs?: string[];
  affectedServiceIds?: string[];
  owner?: string;
  proofRequired?: string;
  itineraryValue?: string;
  voucherValue?: string;
  roadbookValue?: string;
  result?: string;
};

export type Audit360 = {
  status: "stable" | "attention" | "blocking";
  globalDecision: "GO" | "GO_WITH_CHECKS" | "NO_GO";
  confidence: number;
  summary: string;
  description?: string;
  redItems: AuditItem[];
  orangeItems: AuditItem[];
  greenChecks: AuditItem[];
  duplicateCandidates: AuditItem[];
  dataReview: AuditItem[];
  crossSourceComparisons: AuditItem[];
  localRuleResults: AuditItem[];
  missingEvidence: AuditItem[];
  actions: Array<{ priority: string; title: string; detail: string; owner: string; proofRequired?: string }>;
};

function normalizeOutputDate(value: unknown) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  return fr ? `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}` : "";
}

function dayLabel(date: string) {
  if (!date) return "Date à vérifier";
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "Date à vérifier" : parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

function normalizeBuiltItinerary(value: Partial<BuiltItinerary> | null | undefined): BuiltItinerary {
  const source = value || {};
  const destination = String(source.destination || "Destination à vérifier");
  return {
    destination,
    period: String(source.period || "Période à vérifier"),
    travelers: Array.isArray(source.travelers) ? source.travelers : [],
    days: Array.isArray(source.days)
      ? source.days.map(day => {
          const date = normalizeOutputDate(day?.date);
          return {
            ...day,
            date,
            label: date ? dayLabel(date) : String(day?.label || "Date à vérifier"),
            city: String(day?.city || destination),
            events: Array.isArray(day?.events) ? day.events : [],
            warnings: Array.isArray(day?.warnings) ? day.warnings : []
          };
        })
      : [],
    undated: Array.isArray(source.undated) ? source.undated : [],
    detectedTypes: Array.isArray(source.detectedTypes) ? source.detectedTypes : []
  };
}

export async function buildItinerary(apiKey: string, model: string, document: TripDocument, voucherSummary: string) {
  const response = await callJson<Partial<BuiltItinerary>>(
    apiKey,
    model,
    itinerarySystem,
    {
      donneesBrutesExtension: document.raw,
      vouchers: voucherSummary
    },
    1
  );
  return normalizeBuiltItinerary(response);
}

export function audit360(
  apiKey: string,
  model: string,
  document: TripDocument,
  voucherSummary: string,
  itinerary: BuiltItinerary | null,
  tickets: TicketItem[],
  notes: string,
  localFindings: LocalFinding[] = []
) {
  return callJson<Audit360>(
    apiKey,
    model,
    auditSystem,
    {
      itineraireDeReference: itinerary || document.days,
      vouchers: voucherSummary,
      roadbook: document.roadbook,
      tickets,
      notesOperateur: notes,
      controlesLocauxIndicatifs: localFindings
    },
    1
  );
}
