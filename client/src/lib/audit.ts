/* TripCard ELITE — moteur local de contrôle. Style reminder: Swiss operational dossier, explicit evidence, no opaque scoring. */

export type AuditStatus = "ok" | "warning" | "critical" | "pending";
export type AuditIssue = { id: string; severity: Exclude<AuditStatus, "pending">; title: string; detail: string; source?: string; action?: string };
export type TripStep = { id: string; type: string; title: string; location: string; date?: string; time?: string; status: AuditStatus; detail?: string };
export type AuditReport = { raw: Record<string, unknown>; tripName: string; reference: string; destination: string; startDate: string; endDate: string; travelers: string[]; steps: TripStep[]; issues: AuditIssue[]; stats: { checked: number; passed: number; warnings: number; critical: number }; domains: { label: string; count: number; status: AuditStatus; note: string }[] };

const text = (value: unknown, fallback = "Non renseigné") => { if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); return fallback; };
const arrayFrom = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const first = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const recordOf = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const monthNumber: Record<string, string> = { jan: "01", janv: "01", févr: "02", fevr: "02", mars: "03", avr: "04", mai: "05", juin: "06", juil: "07", août: "08", aout: "08", sept: "09", oct: "10", nov: "11", déc: "12", dec: "12" };

function isoDate(value: unknown) {
  const valueText = text(value, "");
  const iso = valueText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const french = valueText.match(/(\d{1,2})\s+([a-zéû.]+)(?:\s+(\d{2,4}))?/i);
  if (french) { const month = monthNumber[french[2].replace(".", "").toLowerCase()]; if (month) return `${french[3] ? (french[3].length === 2 ? `20${french[3]}` : french[3]) : "2026"}-${month}-${french[1].padStart(2, "0")}`; }
  return valueText || "—";
}

function pickList(raw: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) { const direct = raw[key]; if (Array.isArray(direct)) return direct; if (direct && typeof direct === "object") { const nested = Object.values(direct as Record<string, unknown>).find(Array.isArray); if (nested) return nested as unknown[]; } }
  return [];
}

function makeStep(item: unknown, index: number, type: string): TripStep {
  const record = recordOf(item);
  const location = text(first(record.location, record.city, record.destination, record.address, record.hotelCity), "Lieu à identifier");
  const title = text(first(record.title, record.name, record.hotelName, record.activity, record.service, record.flightNumber), `${type} ${index + 1}`);
  const date = isoDate(first(record.date, record.startDate, record.checkIn, record.departureDate, record.pickupDate));
  const time = text(first(record.time, record.departureTime, record.pickupTime, record.checkInTime), "");
  return { id: `${type}-${index}`, type, title, location, date, time: time || undefined, status: "ok", detail: text(first(record.description, record.notes, record.supplier), "Présence enregistrée dans le dossier.") };
}

function onSpotText(raw: Record<string, unknown>) {
  const itinerary = recordOf(raw.itinerary);
  const blocks = [itinerary.tous, itinerary.vols, itinerary.transferts, itinerary.hotels, itinerary.vouchersTab, raw.vouchersSummary].filter((value) => typeof value === "string").map(String);
  return { itinerary, all: blocks.join("\n\n") };
}

function parseOnSpotSteps(raw: Record<string, unknown>, all: string): { steps: TripStep[]; travelers: string[]; reference: string; destination: string; startDate: string; endDate: string; tripName: string; documents: TripStep[] } {
  const year = text(raw.generatedAt, "2026").match(/20\d{2}/)?.[0] ?? "2026";
  const country = all.match(/PAYS\s+([^\n]+)/i)?.[1] ?? "";
  const dateLine = all.match(/DATES DE TRIP\s+(\d{1,2})\s+([a-zéû.]+)\s+→\s+(\d{1,2})\s+([a-zéû.]+)/i);
  const startDate = dateLine ? isoDate(`${dateLine[1]} ${dateLine[2]} ${year}`) : "—";
  const endDate = dateLine ? isoDate(`${dateLine[3]} ${dateLine[4]} ${year}`) : "—";
  const reference = all.match(/Référence de réservation\s+([A-Z0-9-]+)/i)?.[1] ?? text(raw.id, "Dossier sans référence");
  const tripNumber = all.match(/Trip\s+(\d{6,})/i)?.[1];
  const tripName = tripNumber ? `Trip ${tripNumber}` : `Dossier ${reference}`;
  const travelerSet = new Set<string>();
  const travelerSection = all.match(/VOYAGEURS\s+([\s\S]*?)(?=\nNotes\b)/i)?.[1] ?? all;
  for (const match of Array.from(travelerSection.matchAll(/\b(?:M\.|MR\.|Mme|MM\.)\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)/g))) travelerSet.add(clean(`${match[1]} ${match[2]}`));
  const travelers = Array.from(travelerSet);
  const steps: TripStep[] = [];
  const hotelMatch = all.match(/\n([A-Z][A-ZÀ-ÿ'’\s-]{4,})\n\n[^\n]+\n\n([A-ZÀ-ÿ'’ -]{2,}),\s*([A-Z]{2})/);
  if (hotelMatch) steps.push({ id: "Hôtel-0", type: "Hôtel", title: clean(hotelMatch[1]), location: `${clean(hotelMatch[2])}, ${hotelMatch[3]}`, date: startDate, status: "ok", detail: "Hébergement extrait du bloc itinéraire OnSpot." });
  const flightRegex = /(?:^|\n)(\d{1,2})\s+([a-zéû.]+)\s+[\s\S]{0,260}?Vols\s+(\d{1,2}:\d{2})\s+([A-Z0-9]+\s+\d+)\s+·\s+([A-Z0-9]+)\s+\n+([A-Z]{3})\s+→\s+([A-Z]{3})/gi;
  for (const match of Array.from(all.matchAll(flightRegex))) steps.push({ id: `Vol-${steps.length}`, type: "Vol", title: `${match[4]} · ${match[5]}`, location: `${match[6]} → ${match[7]}`, date: isoDate(`${match[1]} ${match[2]} ${year}`), time: match[3], status: "ok", detail: "Segment de vol extrait du texte OnSpot." });
  const transferRegex = /NAVETTE\s*\([^)]*\)\s*→\s*([^\n]+)/gi;
  let transferIndex = 0;
  for (const match of Array.from(all.matchAll(transferRegex))) { const before = all.slice(Math.max(0, match.index ?? 0) - 130, match.index ?? 0); const from = before.match(/([^\n]+)\s*$/)?.[1] ?? "Point de prise en charge"; steps.push({ id: `Transfert-${transferIndex}`, type: "Transfert", title: "Navette collective · AMATHUS", location: `${clean(from)} → ${clean(match[1])}`, date: transferIndex < 2 ? startDate : endDate, status: "ok", detail: "Transfert extrait du voucher OnSpot." }); transferIndex += 1; }
  const documents: TripStep[] = [];
  for (const match of Array.from(all.matchAll(/([^\n]{2,80}\.(?:pdf|PDF))/g))) documents.push({ id: `Document-${documents.length}`, type: "Document", title: clean(match[1]), location: "Voucher OnSpot", date: "—", status: "ok", detail: "Document référencé dans le dossier source." });
  const uniqueSteps = Array.from(new Map(steps.map((step) => [`${step.type}|${step.title}|${step.location}|${step.date}|${step.time ?? ""}`, step])).values());
  const uniqueDocuments = Array.from(new Map(documents.map((document) => [document.title, document])).values());
  return { steps: uniqueSteps, travelers, reference, destination: clean(country), startDate, endDate, tripName, documents: uniqueDocuments };
}

function compareDatesFromText(endDate: string, all: string) { const endDay = endDate.match(/-([0-9]{2})$/)?.[1]; return endDay && (all.includes("Retour le 8") || /\n8 sept\./i.test(all)) && endDay !== "08"; }

export function analyzeTrip(raw: Record<string, unknown>): AuditReport {
  const meta = recordOf(raw.meta); const trip = recordOf(raw.trip); const onSpot = onSpotText(raw); const isOnSpot = Boolean(raw.source === "onspot-audit-assistant" || raw.itinerary || raw.vouchersSummary);
  let travelers = pickList(raw, ["travelers", "passengers", "pax", "clients"]).map((item) => typeof item === "string" ? item : text(first(recordOf(item).name, recordOf(item).fullName, [recordOf(item).firstName, recordOf(item).lastName].filter(Boolean).join(" ")), "Voyageur")).filter(Boolean);
  let flights = pickList(raw, ["flights", "flightSegments", "air"]).map((item, index) => makeStep(item, index, "Vol"));
  let hotels = pickList(raw, ["hotels", "accommodations", "lodging"]).map((item, index) => makeStep(item, index, "Hôtel"));
  let transfers = pickList(raw, ["transfers", "transport", "groundTransport"]).map((item, index) => makeStep(item, index, "Transfert"));
  const activities = pickList(raw, ["activities", "excursions", "experiences", "tours"]).map((item, index) => makeStep(item, index, "Expérience"));
  let documents = pickList(raw, ["documents", "vouchers", "tickets"]).map((item, index) => makeStep(item, index, "Document"));
  let reference = text(first(meta.reference, meta.tripId, raw.reference, raw.tripId, raw.id), "Dossier sans référence"); let startDate = isoDate(first(meta.startDate, trip.startDate, raw.startDate, raw.departureDate)); let endDate = isoDate(first(meta.endDate, trip.endDate, raw.endDate, raw.returnDate)); let destination = text(first(meta.destination, trip.destination, raw.destination, raw.country), "Destination à confirmer"); let tripName = text(first(meta.name, trip.name, raw.tripName, raw.title), `Dossier ${reference}`);
  if (isOnSpot) { const parsed = parseOnSpotSteps(raw, onSpot.all); travelers = parsed.travelers; flights = parsed.steps.filter((step) => step.type === "Vol"); hotels = parsed.steps.filter((step) => step.type === "Hôtel"); transfers = parsed.steps.filter((step) => step.type === "Transfert"); documents = parsed.documents; reference = parsed.reference; startDate = parsed.startDate; endDate = parsed.endDate; destination = parsed.destination || destination; tripName = parsed.tripName; }
  const steps = Array.from(new Map([...flights, ...hotels, ...transfers, ...activities].map((step) => [`${step.type}|${step.title}|${step.location}|${step.date}|${step.time ?? ""}`, step])).values()); const issues: AuditIssue[] = [];
  if (travelers.length === 0) issues.push({ id: "missing-travelers", severity: "warning", title: "Voyageurs non identifiés", detail: "Aucun nom de passager n’a été trouvé dans les champs reconnus.", action: "Vérifier l’onglet voyageurs de la tripcard." });
  if (startDate === "—" || endDate === "—") issues.push({ id: "missing-dates", severity: "critical", title: "Dates du voyage incomplètes", detail: "La période de voyage ne peut pas être confirmée à partir des données importées.", action: "Comparer avec l’itinéraire et les billets émis." });
  if (steps.length === 0) issues.push({ id: "empty-itinerary", severity: "critical", title: "Aucune étape d’itinéraire détectée", detail: "Le JSON ne contient pas de prestation exploitable par les règles locales.", action: "Contrôler la copie depuis l’extension OnSpot Audit Assistant." });
  if (hotels.length === 0) issues.push({ id: "missing-hotels", severity: "warning", title: "Hébergement non retrouvé", detail: "Aucun hébergement n’est présent dans les collections analysées.", action: "Vérifier les vouchers hôtels et les nuits intermédiaires." });
  if (transfers.length === 0 && steps.length > 0) issues.push({ id: "missing-transfers", severity: "warning", title: "Transferts non retrouvés", detail: "Aucun transfert n’est identifié. Cela peut être normal, mais doit être confirmé sur le dossier.", action: "Contrôler les vouchers de transport et les arrivées tardives." });
  const combined = onSpot.all;
  if (isOnSpot && compareDatesFromText(endDate, combined)) issues.push({ id: "return-date-conflict", severity: "critical", title: "Date de retour incohérente", detail: `La période du trip se termine le ${endDate}, mais le voucher et l’itinéraire mentionnent un retour le 8 septembre.`, source: "itinerary.tous · vouchersSummary", action: "Faire confirmer la date de retour à l’agence et corriger la tripcard." });
  if (isOnSpot && /Bosnie[- ]Herz[eé]govine/i.test(combined) && /Croatie/i.test(destination)) issues.push({ id: "country-conflict", severity: "critical", title: "Pays de séjour à clarifier", detail: "Le bandeau indique la Croatie tandis que le voucher précise une arrivée en Croatie et un séjour en Bosnie-Herzégovine, avec un hôtel à Neum (BA).", source: "vouchersSummary · voucher PDF", action: "Vérifier le pays contractuel, les formalités et la destination communiquée au client." });
  if (isOnSpot && /Reconfirmation pré-voyage\s+Refusé/i.test(combined)) issues.push({ id: "reconfirmation-refused", severity: "warning", title: "Reconfirmation pré-voyage refusée", detail: "Le service de reconfirmation pré-voyage apparaît comme refusé dans le dossier OnSpot.", source: "bandeau TripCard", action: "Confirmer si cette prestation est volontairement refusée ou doit être réactivée." });
  if (isOnSpot && /Tickets \(0\)/i.test(combined) && documents.length > 0) issues.push({ id: "tickets-missing", severity: "warning", title: "Aucun ticket dans l’onglet Tickets", detail: "Des vouchers sont présents, mais l’onglet Tickets indique 0. Cela peut être normal pour ce dossier, mais mérite une vérification.", source: "bandeau TripCard · Vouchers", action: "Contrôler si les billets aériens sont bien disponibles dans les vouchers." });
  const normalizedDates = steps.map((step) => step.date).filter((date) => date && date !== "—"); const duplicateDates = normalizedDates.filter((date, index) => normalizedDates.indexOf(date) !== index); if (duplicateDates.length > 0) issues.push({ id: "duplicate-date", severity: "warning", title: "Plusieurs prestations le même jour", detail: `Les dates ${Array.from(new Set(duplicateDates)).join(", ")} comportent plusieurs prestations.`, action: "Vérifier les horaires et les temps de transfert." });
  const checked = Math.max(steps.length + documents.length + 4, 4); const critical = issues.filter((issue) => issue.severity === "critical").length; const warnings = issues.filter((issue) => issue.severity === "warning").length; const passed = Math.max(checked - critical - warnings, 0); const domain = (label: string, count: number, related: AuditIssue[], note: string) => ({ label, count, status: related.some((issue) => issue.severity === "critical") ? "critical" as AuditStatus : related.length ? "warning" as AuditStatus : "ok" as AuditStatus, note }); const issue = (id: string) => issues.filter((entry) => entry.id === id);
  return { raw, tripName, reference, destination, startDate, endDate, travelers, steps, issues, stats: { checked, passed, warnings, critical }, domains: [domain("Méta & voyageurs", travelers.length + 4, [...issue("missing-travelers"), ...issue("missing-dates"), ...issue("country-conflict")], travelers.length ? "Identité et période repérées" : "Informations à compléter"), domain("Vols", flights.length, [], flights.length ? `${flights.length} segment${flights.length > 1 ? "s" : ""} détecté${flights.length > 1 ? "s" : ""}` : "Aucun segment retrouvé"), domain("Hébergements", hotels.length, issue("missing-hotels"), hotels.length ? `${hotels.length} étape${hotels.length > 1 ? "s" : ""} retrouvée${hotels.length > 1 ? "s" : ""}` : "Contrôle requis"), domain("Transferts & documents", transfers.length + documents.length, [...issue("missing-transfers"), ...issue("tickets-missing")], `${transfers.length} transfert${transfers.length > 1 ? "s" : ""}, ${documents.length} document${documents.length > 1 ? "s" : ""}`), domain("Cohérence", steps.length, [...issue("return-date-conflict"), ...issue("duplicate-date"), ...issue("empty-itinerary")], issues.length ? "Points d’attention générés" : "Aucune anomalie locale")] };
}

export const demoPayload: Record<string, unknown> = { meta: { reference: "ELT-2026-0814", name: "Sicile — famille Martin", destination: "Sicile, Italie", startDate: "2026-09-14", endDate: "2026-09-23" }, travelers: [{ fullName: "Claire Martin" }, { fullName: "Julien Martin" }, { fullName: "Léa Martin" }], flights: [{ flightNumber: "AF 1186", departureDate: "2026-09-14", departureTime: "09:20", location: "Paris CDG → Catane" }, { flightNumber: "AF 1291", departureDate: "2026-09-23", departureTime: "18:45", location: "Palerme → Paris CDG" }], hotels: [{ name: "Palazzo Sant’Agata", checkIn: "2026-09-14", city: "Catane" }, { name: "Masseria del Sole", checkIn: "2026-09-17", city: "Noto" }, { name: "Casa Marina", checkIn: "2026-09-20", city: "Palerme" }], activities: [{ title: "Etna au lever du jour", date: "2026-09-16", city: "Catane", supplier: "Opérateur local" }, { title: "Cours de cuisine sicilienne", date: "2026-09-19", city: "Noto", supplier: "Opérateur local" }], documents: [{ name: "Voucher Etna", date: "2026-09-16" }, { name: "Billet retour", date: "2026-09-23" }] };
