import type { AnyRecord, ItineraryItem, TripDocument } from "./tripcard";

export type AuditSeverity = "red" | "orange" | "green";
export type LocalFinding = { severity: AuditSeverity; code: string; title: string; detail: string; action: string; evidence: string; sourceRefs: string[]; affectedServiceIds: string[]; owner?: string; proofRequired?: string };
const finding = (severity: AuditSeverity, code: string, title: string, detail: string, action: string, evidence: string, items: ItineraryItem[] = [], proofRequired = ""): LocalFinding => ({ severity, code, title, detail, action, evidence, sourceRefs: Array.from(new Set(items.flatMap(i => i.sourceRefs))), affectedServiceIds: items.map(i => i.id), proofRequired });
const num = (value: unknown) => { const match = String(value ?? "").match(/\d+/); return match ? Number(match[0]) : 0; };
const values = (item: ItineraryItem) => `${item.title} ${item.subtitle} ${item.notes} ${JSON.stringify(item.raw)}`;

export function runLocalAudit(document: TripDocument): LocalFinding[] {
  const output: LocalFinding[] = [];
  const seen = new Map<string, ItineraryItem[]>();
  for (const item of document.itinerary) { if (!item.duplicateKey || item.title === "Prestation sans titre") continue; const bucket = seen.get(item.duplicateKey) || []; bucket.push(item); seen.set(item.duplicateKey, bucket); }
  for (const items of seen.values()) if (items.length > 1) output.push(finding("orange", "DUPLICATE_CANDIDATE", "Doublon potentiel dans l’itinéraire", `${items.map(i => `${i.displayTitle} (${i.reference || "sans référence"})`).join(" / ")} semblent partager le même type, la même date et le même lieu.`, "Comparer les références et supprimer ou fusionner la prestation en trop.", items.map(i => `${i.date} · ${i.location} · ${i.reference || "référence absente"}`).join(" | "), items, "Réservation fournisseur ou confirmation de la prestation conservée"));
  for (const day of document.days) {
    if (day.empty) output.push(finding("orange", "EMPTY_DAY", "Journée sans prestation identifiée", `${day.date} ne contient aucun élément exploitable alors que le séjour continue.`, "Vérifier le roadbook, l’hôtel de nuit et les prestations manquantes.", day.date));
    if (!day.night) output.push(finding("orange", "MISSING_NIGHT", "Hébergement de nuit non couvert", `Aucun hébergement n’est rattaché automatiquement à la nuit du ${day.date}.`, "Confirmer l’hôtel ou corriger les dates de check-in/check-out.", day.date, [], "Voucher hôtel ou confirmation fournisseur"));
    const timed = day.events.filter(item => item.time).sort((a, b) => a.time.localeCompare(b.time));
    for (let index = 1; index < timed.length; index += 1) if (timed[index].time === timed[index - 1].time) output.push(finding("red", "TIME_OVERLAP", "Chevauchement horaire critique", `${timed[index - 1].displayTitle} et ${timed[index].displayTitle} commencent tous deux à ${timed[index].time}.`, "Confirmer l’horaire exact et modifier l’itinéraire ou la réservation en conflit.", `${timed[index - 1].id} / ${timed[index].id}`, [timed[index - 1], timed[index]], "Deux confirmations ou horaires fournisseur comparables"));
  }
  for (const item of document.itinerary) {
    const raw = values(item); if (!item.reference && !item.hasProof) output.push(finding("orange", "MISSING_PROOF", "Preuve de réservation absente", `${item.displayTitle} n’a ni référence ni voucher rattaché.`, "Rattacher le voucher ou demander la confirmation fournisseur.", `${item.date} · ${item.displayTitle}`, [item], "Voucher, PNR ou numéro de confirmation"));
    if (item.reconfirmationRequired) output.push(finding("orange", "RECONFIRMATION", "Reconfirmation demandée par la source", `${item.displayTitle} contient une instruction de reconfirmation : ${item.reconfirmationEvidence}`, "Créer ou traiter le rappel de reconfirmation 24 heures avant la prestation.", item.reconfirmationEvidence, [item]));
    const capacity = num(item.raw.rooms || item.raw.roomCount || item.raw.passengers || item.raw.guests || item.raw.participants); if (capacity && document.meta.travelers.length && capacity < document.meta.travelers.length && /hôtel|vol|train|activité/i.test(item.type)) output.push(finding("red", "CAPACITY_MISMATCH", "Capacité inférieure au nombre de voyageurs", `${item.displayTitle} indique ${capacity} place(s)/participant(s) pour ${document.meta.travelers.length} voyageur(s).`, "Confirmer la capacité et corriger la réservation si nécessaire.", raw.slice(0, 300), [item], "Confirmation avec capacité corrigée"));
  }
  const roadbook = document.roadbook.toLowerCase(); for (const item of document.itinerary) if (roadbook && !roadbook.includes(item.title.toLowerCase().slice(0, 16))) output.push(finding("orange", "ROADBOOK_MISMATCH", "Prestation non retrouvée dans le roadbook", `${item.displayTitle} n’est pas retrouvée avec son nom dans le texte roadbook fourni.`, "Comparer manuellement le roadbook et la réservation avant de modifier l’itinéraire.", item.displayTitle, [item], "Roadbook corrigé ou preuve fournisseur"));
  if (!output.length) output.push(finding("green", "LOCAL_CHECKS_CLEAR", "Contrôles locaux sans anomalie", "Aucun conflit déterministe n’a été trouvé dans les données importées.", "Poursuivre la revue des preuves et des règles métier.", "JSON, prestations et projection locale"));
  return output;
}

export function auditCounts(findings: LocalFinding[]) { return { red: findings.filter(item => item.severity === "red").length, orange: findings.filter(item => item.severity === "orange").length, green: findings.filter(item => item.severity === "green").length }; }
export function findingToAi(item: LocalFinding) { return { ...item }; }
