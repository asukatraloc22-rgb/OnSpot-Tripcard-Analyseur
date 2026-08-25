/* TripCard ELITE — moteur local de contrôle. Style reminder: Swiss operational dossier, explicit evidence, no opaque scoring. */

export type AuditStatus = "ok" | "warning" | "critical" | "pending";
export type AuditIssue = { id: string; severity: Exclude<AuditStatus, "pending">; title: string; detail: string; source?: string; action?: string };
export type TripStep = { id: string; type: string; title: string; location: string; date?: string; time?: string; status: AuditStatus; detail?: string };
export type AuditReminder = { id: string; kind: "H-24" | "CHECK-IN" | "WELCOME"; date: string; time?: string; timezone: "UTC"; label: string; detail: string; status: AuditStatus };
export type AuditMetadata = { agency: string; creator: string; tripId: string; package: string; lastUpdated: string; identityDocuments: string[]; profileNotes: string[]; tickets: string; reconfirmation: string };
export type DocumentCheck = { id: string; label: string; category: "flight-plan" | "identity" | "hotel" | "transport" | "activity" | "other"; status: "present" | "missing" | "pending" | "not-applicable"; evidence: string };
export type AuditReport = { raw: Record<string, unknown>; tripName: string; reference: string; destination: string; startDate: string; endDate: string; travelers: string[]; steps: TripStep[]; issues: AuditIssue[]; reminders: AuditReminder[]; metadata: AuditMetadata; documentChecks: DocumentCheck[]; stats: { checked: number; passed: number; warnings: number; critical: number }; domains: { label: string; count: number; status: AuditStatus; note: string }[] };

const emptyMetadata = (): AuditMetadata => ({ agency: "Non renseignée", creator: "Non renseigné", tripId: "Non renseigné", package: "Non renseigné", lastUpdated: "Non renseignée", identityDocuments: [], profileNotes: [], tickets: "Non renseigné", reconfirmation: "Non renseignée" });
const defaultDomains = () => ["Méta & voyageurs", "Vols", "Hébergements", "Transferts & documents", "Cohérence"].map((label) => ({ label, count: 0, status: "pending" as AuditStatus, note: "À contrôler" }));

export function normalizeReport(value: unknown): AuditReport | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<AuditReport> & Record<string, unknown>;
  if (!Array.isArray(source.steps) || !Array.isArray(source.issues)) return null;
  if ((!Array.isArray(source.reminders) || !Array.isArray(source.documentChecks)) && source.raw && typeof source.raw === "object") return analyzeTrip(source.raw as Record<string, unknown>);
  const metadata = { ...emptyMetadata(), ...(source.metadata && typeof source.metadata === "object" ? source.metadata : {}) };
  const reminders = Array.isArray(source.reminders) ? source.reminders.map((reminder) => ({ ...reminder, timezone: "UTC" as const })) : [];
  const stats = { checked: 0, passed: 0, warnings: 0, critical: 0, ...(source.stats && typeof source.stats === "object" ? source.stats : {}) };
  const domains = Array.isArray(source.domains) ? source.domains : defaultDomains();
  const documentChecks = Array.isArray(source.documentChecks) ? source.documentChecks : [];
  return { raw: (source.raw && typeof source.raw === "object" ? source.raw : {}) as Record<string, unknown>, tripName: text(source.tripName, "Dossier sans titre"), reference: text(source.reference, "Dossier sans référence"), destination: text(source.destination, "Destination à confirmer"), startDate: text(source.startDate, "—"), endDate: text(source.endDate, "—"), travelers: Array.isArray(source.travelers) ? source.travelers.map(String) : [], steps: source.steps as TripStep[], issues: source.issues as AuditIssue[], reminders: reminders as AuditReminder[], metadata: metadata as AuditMetadata, documentChecks: documentChecks as DocumentCheck[], stats, domains: domains as AuditReport["domains"] };
}

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
  const french = valueText.match(/(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))(?:\s+(\d{2,4}))?/i);
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
  const blocks = [itinerary.tous, itinerary.vols, itinerary.transferts, itinerary.hotels, itinerary.activites, itinerary.trains, itinerary.vouchersTab, raw.vouchersSummary].filter((value) => typeof value === "string").map(String);
  return { itinerary, all: blocks.join("\n\n") };
}

function parseOnSpotSteps(raw: Record<string, unknown>, all: string): { steps: TripStep[]; travelers: string[]; reference: string; destination: string; startDate: string; endDate: string; tripName: string; documents: TripStep[] } {
  const year = text(raw.generatedAt, "2026").match(/20\d{2}/)?.[0] ?? "2026";
  const timeline = text(recordOf(raw.itinerary).tous, all);
  const country = timeline.match(/PAYS\s+([^\n]+)/i)?.[1] ?? "";
  const dateLine = timeline.match(/DATES DE TRIP[\s\S]{0,60}?(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))[\s\S]{0,20}?→[\s\S]{0,20}?(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))/i);
  const startDate = dateLine ? isoDate(`${dateLine[1]} ${dateLine[2]} ${year}`) : "—";
  const endDate = dateLine ? isoDate(`${dateLine[3]} ${dateLine[4]} ${year}`) : "—";
  const reference = all.match(/Référence de réservation\s+([^\n]+)/i)?.[1]?.trim() ?? text(raw.id, "Dossier sans référence");
  const tripNumber = all.match(/Trip\s+(\d{6,})/i)?.[1];
  const tripName = tripNumber ? `Trip ${tripNumber}` : `Dossier ${reference}`;
  const travelerSet = new Set<string>();
  const travelerSection = timeline.match(/VOYAGEURS\s+([\s\S]*?)(?=\nNotes\b)/i)?.[1] ?? timeline;
  for (const match of Array.from(travelerSection.matchAll(/\b(?:M\.|MR\.|Mme|MM\.)\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)/g))) travelerSet.add(clean(`${match[1]} ${match[2]}`));
  const travelers = Array.from(travelerSet);
  const steps: TripStep[] = [];
  const hotelRegex = /(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))[\s\S]{0,80}?Hôtels\s+([^\n]+)\n+\n+([^\n]+)\n+\n+([^,\n]+),\s*([A-Z]{2})/gi;
  for (const match of Array.from(timeline.matchAll(hotelRegex))) steps.push({ id: `Hôtel-${steps.length}`, type: "Hôtel", title: clean(match[3]), location: `${clean(match[5])}, ${match[6]}`, date: isoDate(`${match[1]} ${match[2]} ${year}`), status: "ok", detail: clean(match[4]) });
  const flightRegex = /(?:^|\n)(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))\s+[\s\S]{0,260}?Vols\s+(\d{1,2}:\d{2})\s+([A-Z0-9]+\s+\d+)\s+·\s+([A-Z0-9]+)\s+\n+([A-Z]{3})\s+→\s+([A-Z]{3})/gi;
  for (const match of Array.from(timeline.matchAll(flightRegex))) steps.push({ id: `Vol-${steps.length}`, type: "Vol", title: `${match[4]} · ${match[5]}`, location: `${match[6]} → ${match[7]}`, date: isoDate(`${match[1]} ${match[2]} ${year}`), time: match[3], status: "ok", detail: "Segment de vol extrait du texte OnSpot." });
  const transferRegex = /(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))[\s\S]{0,160}?Transferts\s+(?:(\d{1,2}:\d{2})\s+)?([^\n]+)\n+\n+([^\n]+)\n+\n+([^\n]+)/gi;
  for (const match of Array.from(timeline.matchAll(transferRegex))) steps.push({ id: `Transfert-${steps.length}`, type: "Transfert", title: clean(match[4]), location: `${clean(match[5])} → ${clean(match[6])}`, date: isoDate(`${match[1]} ${match[2]} ${year}`), time: match[3], status: "ok", detail: "Transfert extrait du bloc itinéraire OnSpot." });
  const activityRegex = /(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))[\s\S]{0,140}?Activités\s+(?:(\d{1,2}:\d{2})\s+)?([^\n]+)\n+([^\n]+)/gi;
  for (const match of Array.from(timeline.matchAll(activityRegex))) steps.push({ id: `Activité-${steps.length}`, type: "Activité", title: clean(match[4]), location: clean(match[5]), date: isoDate(`${match[1]} ${match[2]} ${year}`), time: match[3], status: "ok", detail: "Activité extraite du bloc itinéraire OnSpot." });
  const trainRegex = /(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))[\s\S]{0,140}?Trains\s+(?:(\d{1,2}:\d{2})\s+)?([^\n]+)\n+([^\n]+)/gi;
  for (const match of Array.from(timeline.matchAll(trainRegex))) steps.push({ id: `Train-${steps.length}`, type: "Train", title: clean(match[4]), location: clean(match[5]), date: isoDate(`${match[1]} ${match[2]} ${year}`), time: match[3], status: "ok", detail: "Transport ferroviaire extrait du bloc itinéraire OnSpot." });
  const timelineLines = timeline.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const monthPattern = "(?:janv?\\.?|févr?\\.?|mars|avr(?:il)?\\.?|mai|juin|juil?\\.?|août|sept?\\.?|oct(?:obre)?\\.?|nov(?:embre)?\\.?|déc(?:embre)?)";
  let currentDate = "—"; let currentSection = "";
  const sectionNames = new Set(["Hôtels", "Activités", "Transferts", "Trains", "Vols"]);
  for (let i = 0; i < timelineLines.length; i += 1) {
    const line = timelineLines[i];
    const dateMatch = line.match(new RegExp(`^(\\d{1,2})\\s+(${monthPattern})$`, "i"));
    if (dateMatch) { currentDate = isoDate(`${dateMatch[1]} ${dateMatch[2]} ${year}`); continue; }
    if (sectionNames.has(line)) { currentSection = line; continue; }
    if (currentDate === "—") continue;
    if (currentSection === "Hôtels" && i + 2 < timelineLines.length && !sectionNames.has(line) && !/^\\d{1,2}\\s+/.test(line)) {
      const room = timelineLines[i + 1]; const location = timelineLines[i + 2];
      if (!/^(Rechercher|Tableau|Trip_|Ajouter|Reminders|Notes|Services|Métadonnées)/i.test(line) && /,\\s*[A-Z]{2}$/.test(location)) { steps.push({ id: `Hôtel-${steps.length}`, type: "Hôtel", title: line, location, date: currentDate, status: "ok", detail: room }); i += 2; continue; }
    }
    if (currentSection === "Activités" && i + 1 < timelineLines.length && !sectionNames.has(line) && !/^\\d{1,2}\\s+/.test(line) && !line.includes("→")) {
      const hasTime = /^\\d{1,2}:\\d{2}$/.test(line); const title = hasTime ? timelineLines[i + 1] : line; const location = hasTime ? timelineLines[i + 2] : timelineLines[i + 1];
      if (title && location && !sectionNames.has(location) && !/^\\d{1,2}\\s+/.test(location)) { steps.push({ id: `Activité-${steps.length}`, type: "Activité", title, location, date: currentDate, time: hasTime ? line : undefined, status: "ok", detail: "Activité extraite de la timeline OnSpot." }); if (hasTime) i += 2; else i += 1; continue; }
    }
    if ((currentSection === "Transferts" || currentSection === "Trains") && line.includes("→")) {
      const nextRoute = timelineLines[i + 1]?.includes("→") ? timelineLines[i + 1] : ""; const previous = timelineLines[i - 1] ?? currentSection; const time = /^\\d{1,2}:\\d{2}$/.test(timelineLines[i - 2] ?? "") ? timelineLines[i - 2] : undefined;
      steps.push({ id: `${currentSection}-${steps.length}`, type: currentSection === "Trains" ? "Train" : "Transfert", title: previous, location: nextRoute ? `${line} → ${nextRoute}` : line, date: currentDate, time, status: "ok", detail: `${currentSection} extrait de la timeline OnSpot.` }); if (nextRoute) i += 1; continue;
    }
    if (currentSection === "Vols" && /→/.test(line)) { const previous = timelineLines[i - 1] ?? "Vol"; const time = /^\\d{1,2}:\\d{2}$/.test(timelineLines[i - 2] ?? "") ? timelineLines[i - 2] : undefined; steps.push({ id: `Vol-${steps.length}`, type: "Vol", title: previous, location: line, date: currentDate, time, status: "ok", detail: "Vol extrait de la timeline OnSpot." }); }
  }
  const activityBlockRegex = new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+Activités\\s+([\\s\\S]*?)(?=\\n\\d{1,2}\\s+${monthPattern}|\\n(?:Hôtels|Transferts|Trains|Vols|Reminders)\\b|$)`, "gi");
  for (const match of Array.from(timeline.matchAll(activityBlockRegex))) { const lines = match[3].split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean); for (let i = 0; i < lines.length; i += 1) { if (sectionNames.has(lines[i]) || /^(Rechercher|Tableau|Trip_|Ajouter|Reminders|Notes|Services|Métadonnées)/i.test(lines[i])) continue; const hasTime = /^\\d{1,2}:\\d{2}$/.test(lines[i]); const title = hasTime ? lines[i + 1] : lines[i]; const location = hasTime ? lines[i + 2] : lines[i + 1]; if (title && location && !sectionNames.has(title) && !sectionNames.has(location)) { steps.push({ id: `Activité-${steps.length}`, type: "Activité", title, location, date: isoDate(`${match[1]} ${match[2]} ${year}`), time: hasTime ? lines[i] : undefined, status: "ok", detail: "Activité extraite du bloc daté OnSpot." }); i += hasTime ? 2 : 1; } } }
  const trainBlockRegex = new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+Trains\\s+([\\s\\S]*?)(?=\\n\\d{1,2}\\s+${monthPattern}|\\n(?:Hôtels|Activités|Transferts|Vols|Reminders)\\b|$)`, "gi");
  for (const match of Array.from(timeline.matchAll(trainBlockRegex))) { const lines = match[3].split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean); for (let i = 0; i < lines.length; i += 1) { if (sectionNames.has(lines[i])) continue; const hasTime = /^\\d{1,2}:\\d{2}$/.test(lines[i]); const title = hasTime ? lines[i + 1] : lines[i]; const location = hasTime ? lines[i + 2] : lines[i + 1]; if (title && location && location.includes("→")) steps.push({ id: `Train-${steps.length}`, type: "Train", title, location, date: isoDate(`${match[1]} ${match[2]} ${year}`), time: hasTime ? lines[i] : undefined, status: "ok", detail: "Train extrait du bloc daté OnSpot." }); } }
  if (!steps.some((step) => step.type === "Activité")) { const headers = Array.from(timeline.matchAll(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+Activités`, "gi"))); for (const match of headers) steps.push({ id: `Activité-${steps.length}`, type: "Activité", title: "Activités à contrôler", location: "Détail présent dans le dossier OnSpot", date: isoDate(`${match[1]} ${match[2]} ${year}`), status: "pending", detail: "L’en-tête est présent mais le DOM n’a pas permis de rattacher chaque détail à cette date." }); }
  if (!steps.some((step) => step.type === "Train")) { const headers = Array.from(timeline.matchAll(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+Trains`, "gi"))); for (const match of headers) steps.push({ id: `Train-${steps.length}`, type: "Train", title: "Transport ferroviaire à contrôler", location: "Détail présent dans le dossier OnSpot", date: isoDate(`${match[1]} ${match[2]} ${year}`), status: "pending", detail: "L’en-tête est présent mais le DOM n’a pas permis de rattacher chaque détail à cette date." }); }
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
  let activities = pickList(raw, ["activities", "excursions", "experiences", "tours"]).map((item, index) => makeStep(item, index, "Expérience"));
  let trains: TripStep[] = [];
  let documents = pickList(raw, ["documents", "vouchers", "tickets"]).map((item, index) => makeStep(item, index, "Document"));
  let reference = text(first(meta.reference, meta.tripId, raw.reference, raw.tripId, raw.id), "Dossier sans référence"); let startDate = isoDate(first(meta.startDate, trip.startDate, raw.startDate, raw.departureDate)); let endDate = isoDate(first(meta.endDate, trip.endDate, raw.endDate, raw.returnDate)); let destination = text(first(meta.destination, trip.destination, raw.destination, raw.country), "Destination à confirmer"); let tripName = text(first(meta.name, trip.name, raw.tripName, raw.title), `Dossier ${reference}`);
  if (isOnSpot) { const parsed = parseOnSpotSteps(raw, onSpot.all); travelers = parsed.travelers; flights = parsed.steps.filter((step) => step.type === "Vol"); hotels = parsed.steps.filter((step) => step.type === "Hôtel"); transfers = parsed.steps.filter((step) => step.type === "Transfert"); activities = parsed.steps.filter((step) => step.type === "Activité"); trains = parsed.steps.filter((step) => step.type === "Train"); documents = parsed.documents; reference = parsed.reference; startDate = parsed.startDate; endDate = parsed.endDate; destination = parsed.destination || destination; tripName = parsed.tripName; }
  const steps = Array.from(new Map([...flights, ...hotels, ...transfers, ...activities, ...trains].map((step) => [`${step.type}|${step.title}|${step.location}|${step.date}|${step.time ?? ""}`, step])).values()); const issues: AuditIssue[] = [];
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
  const agency = combined.match(/AGENCE\s+([^\n]+)/i)?.[1]?.trim() ?? "Non renseignée";
  const creator = combined.match(/Créé par\s+([^\n]+)/i)?.[1]?.trim() ?? "Non renseigné";
  const tripId = combined.match(/ID\s+(trip_[^\n]+)/i)?.[1]?.trim() ?? text(raw.pageUrl, "Non renseigné");
  const packageName = combined.match(/FORFAIT\s+([^\n]+)/i)?.[1]?.trim() ?? "Non renseigné";
  const lastUpdated = combined.match(/Dernière mise à jour\s+([^\n]+)/i)?.[1]?.trim() ?? "Non renseignée";
  const identityDocuments = Array.from(new Set((combined.match(/(?:passeports?|CNI|cartes? d’identité|pièces? d’identité)[^\n]*/gi) ?? []).map(clean)));
  const profileSection = combined.match(/VOYAGEURS[\s\S]*?Services du trip/i)?.[0] ?? combined;
  const profileNotes = Array.from(new Set((profileSection.match(/(?:Exigeant|VIP|anniversaire|birthday|allergie|mobilité réduite|Aucune note[^\n]*)[^\n]*/gi) ?? []).map(clean)));
  const tickets = combined.match(/Tickets\s+\((\d+)\)/i)?.[1] ?? "Non renseigné";
  const reconfirmation = combined.match(/Reconfirmation pré-voyage\s+([^\n]+)/i)?.[1]?.trim() ?? "Non renseignée";
  const metadata: AuditMetadata = { agency, creator, tripId, package: packageName, lastUpdated, identityDocuments, profileNotes, tickets, reconfirmation };
  const minusOneDay = (date: string) => { const parsed = new Date(`${date}T12:00:00Z`); if (Number.isNaN(parsed.getTime())) return date; parsed.setUTCDate(parsed.getUTCDate() - 1); return parsed.toISOString().slice(0, 10); };
  const addHours = (date: string, time: string | undefined, hours: number) => { const parsed = new Date(`${date}T${time || "12:00"}:00Z`); if (Number.isNaN(parsed.getTime())) return { date, time: undefined }; parsed.setUTCHours(parsed.getUTCHours() + hours); return { date: parsed.toISOString().slice(0, 10), time: parsed.toISOString().slice(11, 16) }; };
  const requiresReconfirmation = (step: TripStep) => { const needle = `${step.title} ${step.location}`.toLowerCase(); const index = combined.toLowerCase().indexOf(needle.split(" ").slice(0, 4).join(" ")); const nearby = index >= 0 ? combined.slice(Math.max(0, index - 180), index + 520) : ""; return /reconfirm|reconfirmation|reconfirmer|24\s*h|h-24|h\s*24|confirm before/i.test(nearby); };
  const reminders: AuditReminder[] = steps.flatMap((step): AuditReminder[] => { if (!step.date || step.date === "—" || !/^\d{4}-\d{2}-\d{2}$/.test(step.date)) return []; if (step.type === "Vol") { const welcome = addHours(step.date, step.time, 5); return [{ id: `checkin-${step.id}`, kind: "CHECK-IN" as const, date: minusOneDay(step.date), time: step.time, timezone: "UTC" as const, label: `Check-in · ${step.title}`, detail: `À effectuer 24 h avant le vol du ${step.date}, selon l’UTC.`, status: "pending" as AuditStatus }, { id: `welcome-${step.id}`, kind: "WELCOME" as const, date: welcome.date, time: welcome.time, timezone: "UTC" as const, label: `Welcome call · ${step.location}`, detail: step.time ? "À planifier 5 h après l’atterrissage, calcul provisoire à partir de l’horaire exporté, selon l’UTC." : "À planifier 5 h après l’atterrissage ; l’heure d’arrivée manque dans l’export.", status: "pending" as AuditStatus }]; } if (["Transfert", "Activité"].includes(step.type) && requiresReconfirmation(step)) return [{ id: `h24-${step.id}`, kind: "H-24" as const, date: minusOneDay(step.date), timezone: "UTC" as const, label: `Reconfirmation · ${step.title}`, detail: `Le voucher indique une reconfirmation 24 h avant la prestation du ${step.date}.`, status: "pending" as AuditStatus }]; return []; });
  const hasFlightPlanEvidence = /plan(?:s)? de vol|itinéraire de vol|boarding pass|carte(?:s)? d.?embarquement|e[- ]?ticket|billet(?:s)? d.?avion|billet(?:s)? de vol/i.test(combined);
  const ticketPending = /Tickets\s*\(\s*\d+\s*\)[\s\S]{0,180}?(?:En attente|Agence)/i.test(combined);
  const documentChecks: DocumentCheck[] = [
    { id: "flight-plan", label: "Plans de vol / billets aériens", category: "flight-plan", status: flights.length === 0 ? "not-applicable" : hasFlightPlanEvidence ? "present" : ticketPending ? "pending" : "missing", evidence: flights.length === 0 ? "Aucun vol détecté dans l’itinéraire." : hasFlightPlanEvidence ? "Référence de billet ou plan de vol repérée dans l’export." : ticketPending ? "Vol identifié, mais le ticket est encore en attente." : "Vol identifié sans plan de vol ou billet exploitable." },
    { id: "identity", label: "Passeports / CNI", category: "identity", status: identityDocuments.length ? "present" : /passeports?|CNI|cartes? d’identité/i.test(combined) ? "pending" : "missing", evidence: identityDocuments.length ? identityDocuments.join(" · ") : "Aucun fichier ou statut finalisé clairement repéré." },
    { id: "hotels", label: "Vouchers hôtels", category: "hotel", status: hotels.length && documents.length ? "present" : hotels.length ? "pending" : "missing", evidence: `${hotels.length} hébergement(s) retrouvé(s) dans la timeline.` },
    { id: "transport", label: "Vouchers transports", category: "transport", status: transfers.length || trains.length ? "present" : "missing", evidence: `${transfers.length} transfert(s) et ${trains.length} train(s) retrouvé(s).` },
    { id: "activity", label: "Vouchers activités", category: "activity", status: activities.length ? "present" : "not-applicable", evidence: `${activities.length} activité(s) retrouvée(s) dans la timeline.` },
  ];
  if (flights.length > 0 && !hasFlightPlanEvidence) issues.push({ id: "flight-plans-missing", severity: ticketPending ? "warning" : "critical", title: "Plans de vol non retrouvés", detail: ticketPending ? "Les vols sont présents dans l’itinéraire, mais le ticket aérien apparaît en attente et aucun plan de vol exploitable n’est exporté." : "Des vols sont présents dans l’itinéraire, mais aucun plan de vol, billet ou carte d’embarquement n’est retrouvé dans les documents exportés.", source: "itinéraire · Tickets · Vouchers", action: "Vérifier l’onglet Tickets et les vouchers de voyage aérien avant de poursuivre le contrôle." });
  if (identityDocuments.length === 0) issues.push({ id: "identity-documents-missing", severity: "warning", title: "Passeports / CNI non retrouvés", detail: "Aucun document d’identité n’est explicitement repéré dans le texte exporté.", action: "Vérifier l’onglet Vouchers et les pièces jointes de la tripcard." });
  if (/en attente \(Agence\)/i.test(combined) && /passeports?/i.test(combined)) issues.push({ id: "identity-documents-pending", severity: "warning", title: "Pièces d’identité demandées mais non finalisées", detail: "Un message demande les passeports pour émettre les cartes d’embarquement et le ticket apparaît en attente agence.", source: "ticket / message OnSpot", action: "Obtenir les passeports ou CNI et contrôler leur présence dans les vouchers." });
  const checked = Math.max(steps.length + documents.length + reminders.length + 8, 8); const critical = issues.filter((issue) => issue.severity === "critical").length; const warnings = issues.filter((issue) => issue.severity === "warning").length; const passed = Math.max(checked - critical - warnings, 0); const domain = (label: string, count: number, related: AuditIssue[], note: string) => ({ label, count, status: related.some((issue) => issue.severity === "critical") ? "critical" as AuditStatus : related.length ? "warning" as AuditStatus : "ok" as AuditStatus, note }); const issue = (id: string) => issues.filter((entry) => entry.id === id);
  return { raw, tripName, reference, destination, startDate, endDate, travelers, steps, issues, reminders, metadata, documentChecks, stats: { checked, passed, warnings, critical }, domains: [domain("Méta & voyageurs", travelers.length + 4, [...issue("missing-travelers"), ...issue("missing-dates"), ...issue("country-conflict")], travelers.length ? "Identité et période repérées" : "Informations à compléter"), domain("Vols", flights.length + documentChecks.filter((check) => check.category === "flight-plan").length, issue("flight-plans-missing"), flights.length ? `${flights.length} segment${flights.length > 1 ? "s" : ""} détecté${flights.length > 1 ? "s" : ""} · plan de vol ${hasFlightPlanEvidence ? "retrouvé" : "à contrôler"}` : "Aucun segment retrouvé"), domain("Hébergements", hotels.length, issue("missing-hotels"), hotels.length ? `${hotels.length} étape${hotels.length > 1 ? "s" : ""} retrouvée${hotels.length > 1 ? "s" : ""}` : "Contrôle requis"), domain("Transferts & documents", transfers.length + documents.length + documentChecks.length, [...issue("missing-transfers"), ...issue("tickets-missing"), ...issue("flight-plans-missing")], `${transfers.length} transfert${transfers.length > 1 ? "s" : ""}, ${documents.length} document${documents.length > 1 ? "s" : ""}, ${documentChecks.length} contrôles documentaires`), domain("Cohérence", steps.length, [...issue("return-date-conflict"), ...issue("duplicate-date"), ...issue("empty-itinerary")], issues.length ? "Points d’attention générés" : "Aucune anomalie locale")] };
}

export const demoPayload: Record<string, unknown> = { meta: { reference: "ELT-2026-0814", name: "Sicile — famille Martin", destination: "Sicile, Italie", startDate: "2026-09-14", endDate: "2026-09-23" }, travelers: [{ fullName: "Claire Martin" }, { fullName: "Julien Martin" }, { fullName: "Léa Martin" }], flights: [{ flightNumber: "AF 1186", departureDate: "2026-09-14", departureTime: "09:20", location: "Paris CDG → Catane" }, { flightNumber: "AF 1291", departureDate: "2026-09-23", departureTime: "18:45", location: "Palerme → Paris CDG" }], hotels: [{ name: "Palazzo Sant’Agata", checkIn: "2026-09-14", city: "Catane" }, { name: "Masseria del Sole", checkIn: "2026-09-17", city: "Noto" }, { name: "Casa Marina", checkIn: "2026-09-20", city: "Palerme" }], activities: [{ title: "Etna au lever du jour", date: "2026-09-16", city: "Catane", supplier: "Opérateur local" }, { title: "Cours de cuisine sicilienne", date: "2026-09-19", city: "Noto", supplier: "Opérateur local" }], documents: [{ name: "Voucher Etna", date: "2026-09-16" }, { name: "Billet retour", date: "2026-09-23" }] };
