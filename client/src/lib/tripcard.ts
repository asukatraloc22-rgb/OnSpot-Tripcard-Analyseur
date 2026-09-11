export type AnyRecord = Record<string, any>;

export type TripMeta = {
  reference: string; tripId: string; packageName: string; destination: string; period: string; agency: string;
  startDate: string; endDate: string; zones: string[]; profileNotes: string[]; travelers: AnyRecord[];
};

export type ItineraryItem = {
  id: string; type: string; category: string; title: string; displayTitle: string; subtitle: string; originalTitle: string; location: string; city: string; date: string; endDate: string;
  time: string; endTime: string; departure: string; arrival: string; reference: string; notes: string; status: string;
  sourceRefs: string[]; hasProof: boolean; reconfirmationRequired: boolean; reconfirmationEvidence: string; duplicateKey: string; dayKey: string; nightCoverage: string[]; linkedVoucherIds: string[]; raw: AnyRecord;
};

export type VoucherItem = {
  id: string; name: string; kind: string; category: string; url: string; text: string; status: string; extractionStatus: string;
  sourceRefs: string[]; linkedServiceIds: string[]; detectedDates: string[]; detectedNames: string[]; raw: AnyRecord;
};

export type TicketItem = {
  id: string; number: string; status: string; priority: string; subject: string; category: string; summary: string;
  messages: AnyRecord[]; events: AnyRecord[]; reminders: AnyRecord[]; attachments: AnyRecord[]; raw: AnyRecord;
};

export type DayProjection = {
  date: string; label: string; city: string; night: ItineraryItem | null; events: ItineraryItem[];
  transport: ItineraryItem[]; transfers: ItineraryItem[]; activities: ItineraryItem[]; warnings: string[]; empty: boolean;
};

export type TripDocument = {
  raw: AnyRecord; meta: TripMeta; itinerary: ItineraryItem[]; vouchers: VoucherItem[]; tickets: TicketItem[]; notes: string;
  rawText: string; roadbook: string; days: DayProjection[]; localWarnings: string[];
};

const text = (...values: unknown[]) => { const value = values.find(v => v !== undefined && v !== null && String(v).trim() !== ""); return value === undefined ? "" : String(value).trim(); };
const list = (value: unknown): AnyRecord[] => Array.isArray(value) ? value.filter(item => item && typeof item === "object") as AnyRecord[] : [];
const flexibleList = (value: unknown): Array<AnyRecord | string> => Array.isArray(value) ? value.filter(item => typeof item === "string" || (item && typeof item === "object")) as Array<AnyRecord | string> : [];
const asObject = (value: unknown): AnyRecord => value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
const firstArray = (...values: unknown[]) => values.find(value => Array.isArray(value)) as unknown;
const first = (...values: unknown[]) => values.find(v => v !== undefined && v !== null && String(v).trim() !== "");
const formatDate = (value: unknown) => { if (!value) return ""; if (typeof value === "object") { const o = asObject(value); return text(o.start, o.from, o.date); } return String(value).trim().slice(0, 10); };
const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
export function formatDateFr(value: string) { if (!value) return "À vérifier"; const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}/${match[2]}/${match[1]}` : value; }

export function canonicalType(value: unknown) {
  const normalized = text(value).toLowerCase().replace(/[_-]/g, " ");
  if (/flight|vol|avion/.test(normalized)) return "Vol";
  if (/hotel|hébergement|accommodation|lodging/.test(normalized)) return "Hôtel";
  if (/transfer|transfert|navette|chauffeur/.test(normalized)) return "Transfert";
  if (/activity|activities|activité|excursion|experience|restaurant|dîner|dinner/.test(normalized)) return "Activité";
  if (/train|rail|express bus/.test(normalized)) return "Train";
  if (/car|location|rental/.test(normalized)) return "Location voiture";
  if (/ferry|bateau|boat|cruise|croisière/.test(normalized)) return "Ferry / bateau";
  return text(value, "Autre");
}

export function typeIcon(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (/flight|vol|avion/.test(normalized)) return "✈️";
  if (/hotel|hébergement|accommodation/.test(normalized)) return "🏨";
  if (/transfer|transfert|navette|chauffeur/.test(normalized)) return "🚐";
  if (/activity|activities|activité|excursion|experience|restaurant|dîner/.test(normalized)) return "🧭";
  if (/train|rail|bus/.test(normalized)) return "🚆";
  if (/car|location|rental/.test(normalized)) return "🚗";
  if (/ferry|bateau|boat|cruise|croisière/.test(normalized)) return "⛴️";
  return "📍";
}

function cityFrom(value: string) {
  const match = value.match(/(?:Tokyo|Kyoto|Nara|Kanazawa|Eiheiji|Kawaguchiko|Fukui|Tsuruga|Mishima|Haneda|Osaka|Marunouchi|Japan|Japon)/gi) || [];
  return Array.from(new Set(match.map(v => v.replace(/japan/i, "Japon")))).join(" · ");
}
function dateRange(start: string, end: string) { if (!start) return []; const output: string[] = []; const current = new Date(`${start}T12:00:00Z`); const last = new Date(`${(end || start)}T12:00:00Z`); for (let guard = 0; current <= last && guard < 370; guard += 1) { output.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); } return output; }
function extractDates(value: string) { return value.match(/20\d{2}-\d{2}-\d{2}/g) || []; }

export function normalizeTripPayload(raw: unknown): TripDocument {
  const root = asObject(raw); const trip = asObject(root.trip || root.dossier || root); const metadata = asObject(trip.metadata || root.metadata || root.meta);
  const travelers = flexibleList(trip.travelers || trip.voyageurs || root.travelers).map(v => typeof v === "string" ? { name: v, fullName: v } : v);
  const rawServices = list(firstArray(trip.itinerary, trip.services, root.itinerary, root.services, root.steps));
  const grouped: AnyRecord[] = ["flights","hotels","activities","transfers","trains","carRentals","locations","ferries","boats"].flatMap(key => list(root[key]).map(item => ({ ...item, type: item.type || key })));
  const sourceItems = rawServices.length ? rawServices : grouped;
  const itinerary: ItineraryItem[] = sourceItems.map((item, index) => {
    const location = text(item.location, item.city, item.address, item.route, item.origin && item.destination ? `${item.origin} → ${item.destination}` : "");
    const date = formatDate(first(item.date, item.startDate, item.departureDate, item.checkIn, item.from));
    const endDate = formatDate(first(item.endDate, item.arrivalDate, item.checkOut, item.to));
    const type = canonicalType(item.type || item.kind || item.category || item.serviceType);
    const title = text(item.displayTitle, item.hotelName, item.activityName, item.experienceName, item.flightNumber, item.trainNumber, item.transferName, item.title, item.name, item.label, item.subject, "Prestation sans titre");
    const subtitle = text(item.subtitle, item.roomType, item.room, item.board, item.mealPlan, item.class, item.vehicle, item.category, item.details, item.description);
    const notes = text(item.notes, item.description, item.instructions, item.details, item.extractionEvidence);
    const reconfirmationEvidence = [notes, item.voucherText, item.confirmationInstructions].find(value => /reconfirm|re-confirm|24\s*h|24\s*hour|24h|veille/i.test(String(value || ""))) || "";
    return { id: text(item.id, item.reference, `${type}-${index + 1}`), type, category: text(item.category, item.kind, type), title, displayTitle: title, subtitle, originalTitle: text(item.title, item.name, item.label), location, city: text(item.city, cityFrom(location)), date, endDate, time: text(item.time, item.departureTime, item.startTime, item.checkInTime), endTime: text(item.endTime, item.arrivalTime, item.checkOutTime), departure: text(item.departure, item.departureLocation, item.origin, item.fromLocation), arrival: text(item.arrival, item.arrivalLocation, item.destination, item.toLocation), reference: text(item.confirmationNumber, item.confirmation, item.pnr, item.reference, item.bookingReference), notes, status: text(item.status, item.confirmationStatus, item.extractionConfidence === "high" ? "Confirmé par extraction" : "À vérifier"), sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String) : [text(item.source, "JSON service")], hasProof: Boolean(item.voucherId || item.documentId || item.confirmationNumber || item.confirmation || item.pnr), reconfirmationRequired: Boolean(reconfirmationEvidence), reconfirmationEvidence: String(reconfirmationEvidence), duplicateKey: [type, date, title.toLowerCase(), location.toLowerCase(), text(item.reference, item.confirmationNumber)].join("|").replace(/\s+/g, " "), dayKey: date, nightCoverage: dateRange(date, endDate || date), linkedVoucherIds: [], raw: item };
  });
  const startDates = itinerary.flatMap(i => [i.date, ...extractDates(i.notes)]).filter(isoDate).sort();
  const endDates = itinerary.flatMap(i => [i.endDate, ...i.nightCoverage]).filter(isoDate).sort();
  const startDate = text(metadata.startDate, asObject(trip.dates).start, startDates[0]); const endDate = text(metadata.endDate, asObject(trip.dates).end, endDates[endDates.length - 1], startDate);
  const destination = text(asObject(trip.destination).name, trip.destination, list(trip.destinations).map(v => typeof v === "string" ? v : text(v.name, v.label)).filter(Boolean).join(" · "), metadata.destination, Array.from(new Set(itinerary.map(i => i.city).filter(Boolean))).join(" · "), "Destination à identifier");
  const rawVouchers = list(firstArray(trip.vouchers, trip.documents, root.vouchers, root.documents));
  const vouchers: VoucherItem[] = rawVouchers.map((item, index) => { const excerpt = text(item.text, item.excerpt, item.content); return { id: text(item.id, item.name, `voucher-${index + 1}`), name: text(item.name, item.title, item.filename, item.fileName, "Document sans nom"), kind: text(item.kind, item.mimeType, "Document"), category: text(item.category, "Non classé"), url: text(item.url, item.href, item.downloadUrl), text: excerpt, status: text(item.extractionStatus, item.status, "Présent"), extractionStatus: text(item.extractionStatus, "unknown"), sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String) : [], linkedServiceIds: [], detectedDates: extractDates(`${item.name || ""} ${excerpt}`), detectedNames: [], raw: item }; });
  for (const voucher of vouchers) for (const item of itinerary) if (voucher.detectedDates.includes(item.date) || voucher.text.toLowerCase().includes(item.title.toLowerCase().slice(0, 18))) { voucher.linkedServiceIds.push(item.id); item.linkedVoucherIds.push(voucher.id); item.hasProof = true; }
  const tickets = list(root.tickets || trip.tickets).map((item, index) => { const current = asObject(item.current); const classification = asObject(item.classification); const messages = list(item.messages); return { id: text(item.id, `ticket-${index + 1}`), number: text(item.ticketNumber, item.number, item.id, `#${index + 1}`), status: text(current.status, item.status, "À traiter"), priority: text(current.priority, item.priority, "Normal"), subject: text(current.subject, classification.subject, item.subject, "Ticket sans objet"), category: text(current.category, classification.category, classification.type, "Non classé"), summary: text(item.summary, messages[messages.length - 1]?.text, classification.resolution, "Aucun résumé disponible."), messages, events: list(item.events), reminders: list(item.reminders), attachments: list(item.attachments), raw: item }; });
  const presence = asObject(metadata.ticketsPresence); const count = Number(presence.count || 0); for (let i = tickets.length; i < count; i += 1) tickets.push({ id: `detected-ticket-${i + 1}`, number: `Ticket ${i + 1}`, status: "Présent dans l’extension", priority: "À examiner", subject: "Ticket capturé — détail à importer", category: "Non classé", summary: text(presence.evidence, "Détail du ticket à importer."), messages: [], events: [], reminders: [], attachments: [], raw: { detectedOnly: true, evidence: presence.evidence } });
  const days = projectDays(startDate, endDate, itinerary);
  const warnings = days.flatMap(day => day.warnings); const notes = text(root.operatorNotes && JSON.stringify(root.operatorNotes), trip.notes, root.notes); const roadbook = text(root.roadbook, trip.roadbook, root.roadBook, root.itineraryText, root.vouchersSummary, "");
  const rawReference = text(trip.cardNumber, trip.reference, root.reference, metadata.reference, "sans référence"); const reference = /^trip\s/i.test(rawReference) ? rawReference : `Trip ${rawReference}`;
  return { raw: root, meta: { reference, tripId: text(trip.id, root.tripId, metadata.tripId, "—"), packageName: text(trip.package, trip.plan, root.package, "Elite"), destination, period: startDate ? `${formatDateFr(startDate)} → ${formatDateFr(endDate)}` : "Période à identifier", agency: text(asObject(trip.agency).name, trip.agency, root.agency, metadata.agency, "Agence à identifier"), startDate, endDate, zones: Array.from(new Set(itinerary.map(i => i.city).filter(Boolean))), profileNotes: Array.isArray(metadata.profileNotes) ? metadata.profileNotes.map(String) : [], travelers }, itinerary, vouchers, tickets, notes, roadbook, rawText: JSON.stringify(root, null, 2), days, localWarnings: warnings };
}

export function projectDays(startDate: string, endDate: string, items: ItineraryItem[]): DayProjection[] {
  const dates = dateRange(startDate, endDate || startDate); const keys = dates.length ? dates : Array.from(new Set(items.map(i => i.date).filter(Boolean))).sort();
  return keys.map(date => { const events = items.filter(item => item.date === date || item.nightCoverage.includes(date)).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")); const night = events.find(item => item.type === "Hôtel") || null; const transport = events.filter(item => ["Vol", "Train"].includes(item.type)); const transfers = events.filter(item => item.type === "Transfert"); const activities = events.filter(item => ["Activité", "Ferry / bateau", "Location voiture"].includes(item.type)); const warnings: string[] = []; const timed = events.filter(e => e.time); for (let i = 1; i < timed.length; i += 1) if (timed[i].time === timed[i - 1].time) warnings.push(`Chevauchement possible à ${timed[i].time} : ${timed[i - 1].title} / ${timed[i].title}`); if (!events.length) warnings.push("Journée sans prestation identifiée — à vérifier."); return { date, label: new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" }), city: Array.from(new Set(events.map(e => e.city).filter(Boolean))).join(" · ") || "Zone à vérifier", night, events, transport, transfers, activities, warnings, empty: !events.length }; });
}

export function summarizeTravelers(travelers: AnyRecord[]) { return travelers.map((traveler, index) => text(traveler.name, traveler.fullName, traveler.firstName && traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : "", `Voyageur ${index + 1}`)).join(" · "); }
export function buildVoucherSummary(vouchers: VoucherItem[]) { return vouchers.length ? vouchers.map((v, i) => `${i + 1}. ${v.name} — ${v.category} — ${v.status}${v.linkedServiceIds.length ? ` — lié à ${v.linkedServiceIds.join(", ")}` : " — rattachement à vérifier"}${v.text ? `\nExtrait : ${v.text.slice(0, 900)}` : ""}`).join("\n") : "Aucun voucher ou document identifié dans le JSON."; }
export function buildTripSummary(document: TripDocument) { const types = Array.from(new Set(document.itinerary.map(i => i.type))).join(", "); return `Le dossier ${document.meta.reference} concerne ${summarizeTravelers(document.meta.travelers) || "des voyageurs non renseignés"} et se déroule à ${document.meta.destination}, du ${formatDateFr(document.meta.startDate)} au ${formatDateFr(document.meta.endDate)}. Il comprend ${document.itinerary.length} prestation(s), ${document.vouchers.length} document(s) et ${document.tickets.length} ticket(s). Types détectés : ${types || "à identifier"}.`; }
export function buildAiContext(document: TripDocument, voucherSummary: string, builtItinerary: unknown, tickets: TicketItem[], operatorNotes: string) { return { dossier: document.meta, joursLocaux: document.days, prestations: document.itinerary, vouchers: voucherSummary, itineraireConstruit: builtItinerary, tickets, notesOperateur: operatorNotes || document.notes, alertesLocales: document.localWarnings }; }
