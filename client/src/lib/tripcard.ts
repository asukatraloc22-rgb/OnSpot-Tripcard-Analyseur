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
const formatDate = (value: unknown, yearHint = new Date().getUTCFullYear()) => { if (!value) return ""; if (typeof value === "object") { const o = asObject(value); return formatDate(first(o.start, o.from, o.date), yearHint); } const raw = String(value).trim(); const iso = raw.match(/^(20\d{2})-(\d{2})-(\d{2})/); if (iso) { const candidate = `${iso[1]}-${iso[2]}-${iso[3]}`; return isoDate(candidate); } const short = raw.match(/^(\d{1,2})\s+(janv?\.?|févr?\.?|mars|avr(?:il)?\.?|mai|juin|juil?\.?|août|sept?\.?|oct(?:obre)?\.?|nov(?:embre)?\.?|déc(?:embre)?)$/i); if (short) { const months: Record<string, string> = { jan: "01", janv: "01", févr: "02", mars: "03", avr: "04", mai: "05", juin: "06", juil: "07", août: "08", sept: "09", oct: "10", nov: "11", déc: "12" }; const key = short[2].replace(".", "").slice(0, 4).toLowerCase(); const month = months[key] || months[key.slice(0, 3)]; if (month) return isoDate(`${yearHint}-${month}-${short[1].padStart(2, "0")}`); } return ""; };
const isoDate = (value: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""; const parsed = new Date(`${value}T12:00:00Z`); return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? "" : value; };
const isLikelyTraveler = (value: string) => value.length >= 4 && value.length <= 90 && !/\d|→|->|@/.test(value) && !/(?:hotel|hôtel|palazzo|driver|chauffeur|private|luxury|car|transfer|transfert|tour|walking|cathedral|airport|milano|milan|como|lugano|duomo|restaurant|activity|activité|voucher|room|suite|king|sedan|daytrip|shopper)/i.test(value);
const dateShift = (value: string, amount: number) => { const date = new Date(`${value}T12:00:00Z`); if (Number.isNaN(date.getTime())) return value; date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
export function formatDateFr(value: string) { const valid = isoDate(value); if (!valid) return "À vérifier"; const match = valid.match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}/${match[2]}/${match[1]}` : "À vérifier"; }

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
function dateRange(start: string, end: string) { const safeStart = isoDate(start); const safeEnd = isoDate(end || start) || safeStart; if (!safeStart || !safeEnd) return []; const output: string[] = []; const current = new Date(`${safeStart}T12:00:00Z`); const last = new Date(`${safeEnd}T12:00:00Z`); if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime()) || current > last) return []; for (let guard = 0; current <= last && guard < 370; guard += 1) { output.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); } return output; }
function extractDates(value: string) { return value.match(/20\d{2}-\d{2}-\d{2}/g) || []; }
function parseCapturedItinerary(value: unknown, yearHint: number): AnyRecord[] { const source = typeof value === "string" ? value : Object.values(asObject(value)).filter(v => typeof v === "string").join("\n"); const lines = source.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean); const month = /^(\d{1,2})\s+(janv?\.?|févr?\.?|mars|avr(?:il)?\.?|mai|juin|juil?\.?|août|sept?\.?|oct(?:obre)?\.?|nov(?:embre)?\.?|déc(?:embre)?)$/i; const months: Record<string, string> = { jan: "01", janv: "01", févr: "02", mars: "03", avr: "04", mai: "05", juin: "06", juil: "07", août: "08", sept: "09", oct: "10", nov: "11", déc: "12" }; const sections: Record<string, string> = { hôtels: "hotel", hotels: "hotel", hôtel: "hotel", hotel: "hotel", vols: "flight", vol: "flight", activités: "activity", activité: "activity", activities: "activity", transferts: "transfer", transfert: "transfer", trains: "train", train: "train", locations: "car-rental" }; const ignored = /^(rechercher|ctrl ?k|tableau de bord|trips?|tickets?|rappels?|reminders?|ajouter|modifier|supprimer|télécharger|download|vouchers?|documents?|tous|tout|all|notes?|services?|métadonnées|voyageurs?)/i; const output: AnyRecord[] = []; let date = ""; let type = "other"; for (let index = 0; index < lines.length; index += 1) { const line = lines[index]; const dateMatch = line.match(month); if (dateMatch) { const key = dateMatch[2].replace(".", "").slice(0, 4).toLowerCase(); date = `${yearHint}-${months[key] || months[key.slice(0, 3)]}-${dateMatch[1].padStart(2, "0")}`; type = "other"; continue; } const section = line.toLowerCase().replace(/[：:]/g, "").trim(); if (sections[section]) { type = sections[section]; continue; } if (!date || ignored.test(line) || line.length < 4 || line.length > 220) continue; const next = lines[index + 1] || ""; if (ignored.test(next) || next.length > 260 || month.test(next)) continue; const location = next && !/^\d{1,2}:\d{2}$/.test(next) ? next : "Lieu à vérifier"; output.push({ id: `captured-${output.length + 1}`, type, date, time: /^\d{1,2}:\d{2}$/.test(line) ? line : null, title: /^\d{1,2}:\d{2}$/.test(line) ? next : line, location, source: "itinerary.captured-text", extractionConfidence: "medium", extractionEvidence: "Texte d’onglet capturé par l’extension ; à confirmer avec le DOM." }); if (location !== "Lieu à vérifier") index += 1; } return output; }

export function normalizeTripPayload(raw: unknown): TripDocument {
  const outer = asObject(raw); const nested = [outer.payload, outer.data, outer.tripCard, outer.tripcard].map(asObject).find(value => Object.keys(value).length > 0); const root = nested ? { ...outer, ...nested } : outer; const trip = asObject(root.trip || root.dossier || root); const metadata = asObject(trip.metadata || root.metadata || root.meta);
  const travelers = flexibleList(trip.travelers || trip.voyageurs || root.travelers).map(v => typeof v === "string" ? { name: v, fullName: v } : v).filter(v => isLikelyTraveler(text(v.fullName, v.name))).map(v => ({ ...v, name: text(v.name, v.fullName), fullName: text(v.fullName, v.name) }));
  const yearHint = Number(text(root.generatedAt, root.createdAt).slice(0, 4)) || new Date().getUTCFullYear();
  const rootDates = asObject(root.dates); const rawServices = list(firstArray(trip.itinerary, trip.services, root.itinerary, Array.isArray(root.services) ? root.services : undefined, root.steps, asObject(root.data).services));
  const grouped: AnyRecord[] = ["flights","hotels","activities","transfers","trains","carRentals","locations","ferries","boats"].flatMap(key => list(root[key]).map(item => ({ ...item, type: item.type || key })));
  const capturedTextServices = parseCapturedItinerary(root.itinerary, yearHint);
  const sourceItems = rawServices.length ? rawServices : grouped.length ? grouped : capturedTextServices;
  const itinerary: ItineraryItem[] = sourceItems.map((item, index) => {
    const location = text(item.location, item.city, item.address, item.route, item.origin && item.destination ? `${item.origin} → ${item.destination}` : "");
    const date = formatDate(first(item.date, item.startDate, item.departureDate, item.checkIn, item.from), yearHint);
    const endDate = formatDate(first(item.endDate, item.arrivalDate, item.checkOut, item.to), yearHint);
    const type = canonicalType(item.type || item.kind || item.category || item.serviceType);
    const title = text(item.displayTitle, item.hotelName, item.activityName, item.experienceName, item.flightNumber, item.trainNumber, item.transferName, item.title, item.name, item.label, item.subject, "Prestation sans titre");
    const subtitle = text(item.subtitle, item.roomType, item.room, item.board, item.mealPlan, item.class, item.vehicle, item.category, item.details, item.description);
    const notes = text(item.notes, item.description, item.instructions, item.details, item.extractionEvidence);
    const reconfirmationEvidence = [notes, item.voucherText, item.confirmationInstructions].find(value => /reconfirm|re-confirm|24\s*h|24\s*hour|24h|veille/i.test(String(value || ""))) || "";
    return { id: text(item.id, item.reference, `${type}-${index + 1}`), type, category: text(item.category, item.kind, type), title, displayTitle: title, subtitle, originalTitle: text(item.title, item.name, item.label), location, city: text(item.city, cityFrom(location)), date, endDate, time: text(item.time, item.departureTime, item.startTime, item.checkInTime), endTime: text(item.endTime, item.arrivalTime, item.checkOutTime), departure: text(item.departure, item.departureLocation, item.origin, item.fromLocation), arrival: text(item.arrival, item.arrivalLocation, item.destination, item.toLocation), reference: text(item.confirmationNumber, item.confirmation, item.pnr, item.reference, item.bookingReference), notes, status: text(item.status, item.confirmationStatus, item.extractionConfidence === "high" ? "Confirmé par extraction" : "À vérifier"), sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String) : [text(item.source, "JSON service")], hasProof: Boolean(item.voucherId || item.documentId || item.confirmationNumber || item.confirmation || item.pnr), reconfirmationRequired: Boolean(reconfirmationEvidence), reconfirmationEvidence: String(reconfirmationEvidence), duplicateKey: [type, date, title.toLowerCase(), location.toLowerCase(), text(item.reference, item.confirmationNumber)].join("|").replace(/\s+/g, " "), dayKey: date, nightCoverage: dateRange(date, endDate || date), linkedVoucherIds: [], raw: item };
  });
  const startDates = itinerary.flatMap(i => [i.date, ...extractDates(i.notes)]).filter(isoDate).sort();
  const endDates = itinerary.flatMap(i => [i.endDate, ...i.nightCoverage]).filter(isoDate).sort();
  const startDate = formatDate(first(metadata.startDate, rootDates.start, asObject(trip.dates).start, startDates[0]), yearHint); const endDate = formatDate(first(metadata.endDate, rootDates.end, asObject(trip.dates).end, endDates[endDates.length - 1], startDate), yearHint);
  const hotels = itinerary.filter(item => item.type === "Hôtel").sort((a, b) => a.date.localeCompare(b.date));
  hotels.forEach((hotel, index) => { const nextHotel = hotels[index + 1]?.date; const lastNight = hotel.endDate || (nextHotel ? dateShift(nextHotel, -1) : endDate); hotel.nightCoverage = dateRange(hotel.date, lastNight || hotel.date); });
  const destination = text(asObject(trip.destination).name, trip.destination, root.destination, root.country, list(trip.destinations).map(v => typeof v === "string" ? v : text(v.name, v.label)).filter(Boolean).join(" · "), metadata.destination, metadata.country, metadata.countryName, Array.from(new Set(itinerary.map(i => i.city).filter(Boolean))).join(" · "), "Destination à identifier");
  const rawVouchers = list(firstArray(trip.vouchers, trip.documents, root.vouchers, root.documents));
  const vouchers: VoucherItem[] = rawVouchers.map((item, index) => { const excerpt = text(item.text, item.excerpt, item.content); return { id: text(item.id, item.name, `voucher-${index + 1}`), name: text(item.name, item.title, item.filename, item.fileName, "Document sans nom"), kind: text(item.kind, item.mimeType, "Document"), category: text(item.category, "Non classé"), url: text(item.url, item.href, item.downloadUrl), text: excerpt, status: text(item.extractionStatus, item.status, "Présent"), extractionStatus: text(item.extractionStatus, "unknown"), sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs.map(String) : [], linkedServiceIds: [], detectedDates: extractDates(`${item.name || ""} ${excerpt}`), detectedNames: [], raw: item }; });
  for (const voucher of vouchers) for (const item of itinerary) if (voucher.detectedDates.includes(item.date) || voucher.text.toLowerCase().includes(item.title.toLowerCase().slice(0, 18))) { voucher.linkedServiceIds.push(item.id); item.linkedVoucherIds.push(voucher.id); item.hasProof = true; }
  const tickets = list(root.tickets || trip.tickets).map((item, index) => { const current = asObject(item.current); const classification = asObject(item.classification); const messages = list(item.messages); return { id: text(item.id, `ticket-${index + 1}`), number: text(item.ticketNumber, item.number, item.id, `#${index + 1}`), status: text(current.status, item.status, "À traiter"), priority: text(current.priority, item.priority, "Normal"), subject: text(current.subject, classification.subject, item.subject, "Ticket sans objet"), category: text(current.category, classification.category, classification.type, "Non classé"), summary: text(item.summary, messages[messages.length - 1]?.text, classification.resolution, "Aucun résumé disponible."), messages, events: list(item.events), reminders: list(item.reminders), attachments: list(item.attachments), raw: item }; });
  const presence = asObject(metadata.ticketsPresence); const count = Number(presence.count || 0); for (let i = tickets.length; i < count; i += 1) tickets.push({ id: `detected-ticket-${i + 1}`, number: `Ticket ${i + 1}`, status: "Présent dans l’extension", priority: "À examiner", subject: "Ticket capturé — détail à importer", category: "Non classé", summary: text(presence.evidence, "Détail du ticket à importer."), messages: [], events: [], reminders: [], attachments: [], raw: { detectedOnly: true, evidence: presence.evidence } });
  const days = projectDays(startDate, endDate, itinerary);
  const warnings = days.flatMap(day => day.warnings); const notes = text(root.operatorNotes && JSON.stringify(root.operatorNotes), trip.notes, root.notes); const roadbook = text(root.roadbook, trip.roadbook, root.roadBook, root.itineraryText, root.vouchersSummary, "");
  const rawReference = text(trip.cardNumber, trip.reference, root.reference, root.tripId, metadata.reference, "sans référence"); const reference = /^trip\s/i.test(rawReference) ? rawReference : `Trip ${rawReference}`;
  const compactServiceNotes = Object.keys(asObject(root.services)).length ? Object.entries(asObject(root.services)).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "";
  const extractionNotes = !rawServices.length && !grouped.length ? ["L’export contient les métadonnées et les noms de documents, mais aucune prestation détaillée dans services/itinerary. Refaire une capture avec les onglets de l’itinéraire ouverts."] : [];
  const serviceNames = itinerary.flatMap(item => [item.title, item.location]).filter(Boolean).map(value => value.toLowerCase().trim());
  const cleanTravelers = travelers.filter(traveler => { const name = String(traveler.name || traveler.fullName || "").toLowerCase().trim(); return name && !serviceNames.some(service => name === service || (name.length > 8 && service.includes(name))); });
  return { raw: root, meta: { reference, tripId: text(trip.id, root.internalId, root.tripId, metadata.tripId, "—"), packageName: text(trip.package, trip.plan, root.package, "Elite"), destination, period: startDate ? `${formatDateFr(startDate)} → ${formatDateFr(endDate)}` : "Période à identifier", agency: text(asObject(trip.agency).name, trip.agency, root.agency, metadata.agency, "Agence à identifier"), startDate, endDate, zones: Array.from(new Set(itinerary.map(i => i.city).filter(Boolean))), profileNotes: [...(Array.isArray(metadata.profileNotes) ? metadata.profileNotes.map(String) : []), ...extractionNotes, ...(compactServiceNotes ? [compactServiceNotes] : [])], travelers: cleanTravelers }, itinerary, vouchers, tickets, notes, roadbook, rawText: JSON.stringify(root, null, 2), days, localWarnings: warnings };
}

export function projectDays(startDate: string, endDate: string, items: ItineraryItem[]): DayProjection[] {
  const dates = dateRange(startDate, endDate || startDate); const keys = dates.length ? dates : Array.from(new Set(items.map(i => isoDate(i.date)).filter(Boolean))).sort();
  return keys.map(date => { const events = items.filter(item => item.date === date || item.nightCoverage.includes(date)).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")); const night = events.find(item => item.type === "Hôtel") || null; const transport = events.filter(item => ["Vol", "Train"].includes(item.type)); const transfers = events.filter(item => item.type === "Transfert"); const activities = events.filter(item => ["Activité", "Ferry / bateau", "Location voiture"].includes(item.type)); const warnings: string[] = []; const timed = events.filter(e => e.time); for (let i = 1; i < timed.length; i += 1) if (timed[i].time === timed[i - 1].time) warnings.push(`Chevauchement possible à ${timed[i].time} : ${timed[i - 1].title} / ${timed[i].title}`); if (!events.length) warnings.push("Journée sans prestation identifiée — à vérifier."); const parsed = new Date(`${date}T12:00:00Z`); const label = Number.isNaN(parsed.getTime()) ? "Date à vérifier" : parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" }); return { date, label, city: Array.from(new Set(events.map(e => e.city).filter(Boolean))).join(" · ") || "Zone à vérifier", night, events, transport, transfers, activities, warnings, empty: !events.length }; });
}

export function summarizeTravelers(travelers: AnyRecord[]) { return travelers.map((traveler, index) => text(traveler.name, traveler.fullName, traveler.firstName && traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : "", `Voyageur ${index + 1}`)).join(" · "); }
export function buildVoucherSummary(vouchers: VoucherItem[]) { return vouchers.length ? vouchers.map((v, i) => `${i + 1}. ${v.name} — ${v.category} — ${v.status}${v.linkedServiceIds.length ? ` — lié à ${v.linkedServiceIds.join(", ")}` : " — rattachement à vérifier"}${v.text ? `\nExtrait : ${v.text.slice(0, 900)}` : ""}`).join("\n") : "Aucun voucher ou document identifié dans le JSON."; }
export function buildTripSummary(document: TripDocument) { const types = Array.from(new Set(document.itinerary.map(i => i.type))).join(", "); return `Le dossier ${document.meta.reference} concerne ${summarizeTravelers(document.meta.travelers) || "des voyageurs non renseignés"} et se déroule à ${document.meta.destination}, du ${formatDateFr(document.meta.startDate)} au ${formatDateFr(document.meta.endDate)}. Il comprend ${document.itinerary.length} prestation(s), ${document.vouchers.length} document(s) et ${document.tickets.length} ticket(s). Types détectés : ${types || "à identifier"}.`; }
export function buildAiContext(document: TripDocument, voucherSummary: string, builtItinerary: unknown, tickets: TicketItem[], operatorNotes: string) { return { dossier: document.meta, joursLocaux: document.days, prestations: document.itinerary, vouchers: voucherSummary, itineraireConstruit: builtItinerary, tickets, notesOperateur: operatorNotes || document.notes, alertesLocales: document.localWarnings }; }
