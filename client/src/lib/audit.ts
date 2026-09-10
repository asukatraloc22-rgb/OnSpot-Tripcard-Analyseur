/* TripCard ELITE — moteur local de contrôle. Liquid Glass OnSpot: preuves explicites, règles déterministes, aucune conclusion sans source. */

import { extractTickets, type Ticket } from "./tickets";

export type AuditStatus = "ok" | "warning" | "critical" | "pending";
export type AuditIssue = { id: string; severity: Exclude<AuditStatus, "pending">; title: string; detail: string; source?: string; action?: string };
export type EliteFlag = { id: string; severity: "blocking" | "warning" | "info"; label: string; description: string; action: string; responsible?: string; evidence?: string };
export type EliteReminderPlan = { id: string; label: string; owner: string; timing: string; trigger: string; count?: number };
export type ElitePlan = { flags: EliteFlag[]; reminderPlan: EliteReminderPlan[]; responsibilities: { agentElite: string[]; mayara: string[]; automatic: string[] }; internalNote: { target: string; required: boolean; content: string; placeholders: string[] }; proactiveSuggestions: { required: number; suggestions: Array<{ id: string; status: string; type: string; content: string }> }; summary: { blocking: number; warning: number; info: number } };
export type TripStep = { id: string; type: string; title: string; location: string; date?: string; time?: string; arrivalDate?: string; arrivalTime?: string; status: AuditStatus; detail?: string };
export type AuditReminder = { id: string; kind: "H-24" | "CHECK-IN" | "WELCOME"; date: string; time?: string; timezone: string; label: string; detail: string; status: AuditStatus; localDate?: string; localTime?: string; localTimezone?: string };
export type AuditMetadata = { agency: string; creator: string; tripId: string; package: string; lastUpdated: string; identityDocuments: string[]; profileNotes: string[]; tickets: string; reconfirmation: string };
export type DocumentCheck = { id: string; label: string; category: "flight-plan" | "identity" | "hotel" | "transport" | "activity" | "other"; status: "present" | "missing" | "pending" | "not-applicable"; evidence: string };
export type AuditCheck = { id: string; domain: string; label: string; status: AuditStatus; finding: string; evidence: string; action?: string };
export type FlightDetail = { flightId: string; flightNumber: string; route: string; departureDate?: string; departureTime?: string; arrivalDate?: string; arrivalTime?: string; pnr: string; pnrEvidence: string; sourceName?: string; sourceExcerpt?: string; action?: string };
export type AuditReport = { raw: Record<string, unknown>; tripName: string; reference: string; destination: string; startDate: string; endDate: string; travelers: string[]; steps: TripStep[]; issues: AuditIssue[]; reminders: AuditReminder[]; metadata: AuditMetadata; documentChecks: DocumentCheck[]; checks: AuditCheck[]; flightDetails: FlightDetail[]; tickets: Ticket[]; elite: ElitePlan; stats: { checked: number; passed: number; warnings: number; critical: number }; domains: { label: string; count: number; status: AuditStatus; note: string }[] };

const emptyMetadata = (): AuditMetadata => ({ agency: "Non renseignée", creator: "Non renseigné", tripId: "Non renseigné", package: "Non renseigné", lastUpdated: "Non renseignée", identityDocuments: [], profileNotes: [], tickets: "Non renseigné", reconfirmation: "Non renseignée" });
const emptyElitePlan = (): ElitePlan => ({ flags: [], reminderPlan: [], responsibilities: { agentElite: [], mayara: [], automatic: [] }, internalNote: { target: "Internal — OnSpot only", required: false, content: "", placeholders: [] }, proactiveSuggestions: { required: 0, suggestions: [] }, summary: { blocking: 0, warning: 0, info: 0 } });
const defaultDomains = () => ["Méta & voyageurs", "Vols", "Hébergements", "Transferts & documents", "Cohérence"].map((label) => ({ label, count: 0, status: "pending" as AuditStatus, note: "À contrôler" }));
function normalizeElite(value: unknown): ElitePlan {
  const source = recordOf(value); const fallback = emptyElitePlan();
  const flags = arrayFrom(source.flags).map((flag) => { const item = recordOf(flag); const severity = text(item.severity, "info") as EliteFlag["severity"]; return { id: text(item.id, "elite-flag"), severity: ["blocking", "warning", "info"].includes(severity) ? severity : "info", label: text(item.label, "Point Elite"), description: text(item.description, "Contrôle Elite à vérifier."), action: text(item.action, "Vérifier le dossier."), responsible: text(item.responsible, "Agent Elite"), evidence: text(item.evidence, "") || undefined }; });
  const reminderPlan = arrayFrom(source.reminderPlan).map((reminder) => { const item = recordOf(reminder); return { id: text(item.id, "elite-reminder"), label: text(item.label, "Rappel Elite"), owner: text(item.owner, "Agent Elite"), timing: text(item.timing, "À programmer"), trigger: text(item.trigger, "manual"), count: typeof item.count === "number" ? item.count : undefined }; });
  const responsibilities = recordOf(source.responsibilities); const note = recordOf(source.internalNote); const suggestions = recordOf(source.proactiveSuggestions);
  return { flags, reminderPlan, responsibilities: { agentElite: arrayFrom(responsibilities.agentElite).map(String), mayara: arrayFrom(responsibilities.mayara).map(String), automatic: arrayFrom(responsibilities.automatic).map(String) }, internalNote: { target: text(note.target, fallback.internalNote.target), required: note.required !== false, content: text(note.content, ""), placeholders: arrayFrom(note.placeholders).map(String) }, proactiveSuggestions: { required: typeof suggestions.required === "number" ? suggestions.required : 0, suggestions: arrayFrom(suggestions.suggestions).map((suggestion, index) => { const item = recordOf(suggestion); return { id: text(item.id, `suggestion-${index + 1}`), status: text(item.status, "to_add"), type: text(item.type, "other"), content: text(item.content, "") }; }) }, summary: { blocking: flags.filter((flag) => flag.severity === "blocking").length, warning: flags.filter((flag) => flag.severity === "warning").length, info: flags.filter((flag) => flag.severity === "info").length } };
}

export function normalizeReport(value: unknown): AuditReport | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<AuditReport> & Record<string, unknown>;
  if (!Array.isArray(source.steps) || !Array.isArray(source.issues)) return null;
  if ((!Array.isArray(source.reminders) || !Array.isArray(source.documentChecks) || !Array.isArray(source.checks) || !Array.isArray(source.flightDetails)) && source.raw && typeof source.raw === "object") return analyzeTrip(source.raw as Record<string, unknown>);
  const metadataSource = recordOf(source.metadata);
  const metadata = {
    ...emptyMetadata(),
    ...metadataSource,
    identityDocuments: arrayFrom(metadataSource.identityDocuments).map(String),
    profileNotes: arrayFrom(metadataSource.profileNotes).map(String),
  };
  const reminders = Array.isArray(source.reminders) ? source.reminders.map((reminder) => ({ ...reminder, timezone: "UTC" as const })) : [];
  const stats = { checked: 0, passed: 0, warnings: 0, critical: 0, ...(source.stats && typeof source.stats === "object" ? source.stats : {}) };
  const domains = Array.isArray(source.domains) ? source.domains : defaultDomains();
  const documentChecks = Array.isArray(source.documentChecks) ? source.documentChecks : [];
  const checks = Array.isArray(source.checks) ? source.checks : [];
  const flightDetails = Array.isArray(source.flightDetails) ? source.flightDetails : [];
  return { raw: (source.raw && typeof source.raw === "object" ? source.raw : {}) as Record<string, unknown>, tripName: text(source.tripName, "Dossier sans titre"), reference: text(source.reference, "Dossier sans référence"), destination: text(source.destination, "Destination à confirmer"), startDate: text(source.startDate, "—"), endDate: text(source.endDate, "—"), travelers: Array.isArray(source.travelers) ? source.travelers.map(String) : [], steps: source.steps as TripStep[], issues: source.issues as AuditIssue[], reminders: reminders as AuditReminder[], metadata: metadata as AuditMetadata, documentChecks: documentChecks as DocumentCheck[], checks: checks as AuditCheck[], flightDetails: Array.isArray(source.flightDetails) ? source.flightDetails : [], tickets: Array.isArray(source.tickets) ? source.tickets as Ticket[] : extractTickets((source.raw && typeof source.raw === "object" ? source.raw : {}) as Record<string, unknown>), elite: normalizeElite(source.elite ?? recordOf(source.raw).elite), stats, domains: domains as AuditReport["domains"] };
}

const text = (value: unknown, fallback = "Non renseigné") => { if (typeof value === "string" && value.trim()) return value.trim(); if (typeof value === "number") return String(value); return fallback; };
const arrayFrom = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const first = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
const recordOf = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const monthNumber: Record<string, string> = { jan: "01", janv: "01", févr: "02", fevr: "02", mars: "03", avr: "04", mai: "05", juin: "06", juil: "07", août: "08", aout: "08", sept: "09", oct: "10", nov: "11", déc: "12", dec: "12" };
const airportTimeZones: Record<string, string> = { CDG: "Europe/Paris", ORY: "Europe/Paris", NCE: "Europe/Paris", LYS: "Europe/Paris", LAS: "America/Los_Angeles", LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", JFK: "America/New_York", EWR: "America/New_York", MIA: "America/New_York", ORD: "America/Chicago", DFW: "America/Chicago", DEN: "America/Denver", YYZ: "America/Toronto", YUL: "America/Toronto", LHR: "Europe/London", LGW: "Europe/London", FCO: "Europe/Rome", CTA: "Europe/Rome", PMO: "Europe/Rome", VCE: "Europe/Rome", ATH: "Europe/Athens", LIS: "Europe/Lisbon", MAD: "Europe/Madrid", BCN: "Europe/Madrid", AMS: "Europe/Amsterdam", ZRH: "Europe/Zurich", VIE: "Europe/Vienna", DBV: "Europe/Zagreb", ZAG: "Europe/Zagreb", NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo", ICN: "Asia/Seoul", BKK: "Asia/Bangkok", SIN: "Asia/Singapore", DPS: "Asia/Makassar", DXB: "Asia/Dubai", DOH: "Asia/Qatar", JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg", RAK: "Africa/Casablanca", CAI: "Africa/Cairo", MRU: "Indian/Mauritius", SEZ: "Indian/Mahe", PPT: "Pacific/Tahiti", AKL: "Pacific/Auckland", SYD: "Australia/Sydney", MEL: "Australia/Melbourne", CUN: "America/Cancun", MEX: "America/Mexico_City", SJO: "America/Costa_Rica", HAV: "America/Havana", PUJ: "America/Santo_Domingo" };
const destinationTimeZones: Array<[RegExp, string]> = [[/italie|sicile/i, "Europe/Rome"], [/japon/i, "Asia/Tokyo"], [/croatie|bosnie/i, "Europe/Zagreb"], [/las vegas|californie|usa|états-unis/i, "America/Los_Angeles"], [/new york|floride/i, "America/New_York"], [/thaïlande|thailande/i, "Asia/Bangkok"], [/indonésie|indonesie|bali/i, "Asia/Makassar"], [/singapour/i, "Asia/Singapore"], [/émirats|emirats|dubaï|dubai/i, "Asia/Dubai"], [/maroc/i, "Africa/Casablanca"], [/maurice/i, "Indian/Mauritius"], [/seychelles/i, "Indian/Mahe"], [/polynésie|polynesie|tahiti/i, "Pacific/Tahiti"], [/australie/i, "Australia/Sydney"], [/nouvelle-zélande|nouvelle zelande/i, "Pacific/Auckland"], [/mexique/i, "America/Mexico_City"]];

function isoDate(value: unknown) {
  const valueText = text(value, "");
  const iso = valueText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const french = valueText.match(/(\d{1,2})\s+((?:janv?|févr?|mars|avr(?:il)?|mai|juin|juil?|août|sept?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?))(?:\s+(\d{2,4}))?/i);
  if (french) { const month = monthNumber[french[2].replace(".", "").toLowerCase()]; if (month) return `${french[3] ? (french[3].length === 2 ? `20${french[3]}` : french[3]) : "2026"}-${month}-${french[1].padStart(2, "0")}`; }
  return valueText || "—";
}

function destinationAirport(location = "") { return location.split("→").at(-1)?.trim().match(/\b[A-Z]{3}\b/)?.[0] ?? ""; }
function timezoneForDestination(destination: string, location = "") { const airport = destinationAirport(location); return airportTimeZones[airport] ?? destinationTimeZones.find(([matcher]) => matcher.test(destination))?.[1] ?? ""; }
function utcParts(date: Date, timeZone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {}); return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) }; }
function isoDateFromParts(parts: { year: number; month: number; day: number }) { return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`; }
function localWallToUtc(parts: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string) { let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute); const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute); for (let i = 0; i < 4; i += 1) { const observed = utcParts(new Date(guess), timeZone); const observedValue = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute); const delta = target - observedValue; if (delta === 0) break; guess += delta; } return new Date(guess); }
function welcomeSchedule(arrivalDate: string, arrivalTime: string, timeZone: string) {
  const match = `${arrivalDate}T${arrivalTime}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/); if (!match) return null;
  const arrivalHour = Number(match[4]); const deferToMorning = arrivalHour + 5 >= 20;
  const localWall = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), arrivalHour, Number(match[5]))); localWall.setUTCHours(localWall.getUTCHours() + 5);
  if (deferToMorning) { localWall.setUTCDate(localWall.getUTCDate() + 1); localWall.setUTCHours(9, 0, 0, 0); }
  const local = { year: localWall.getUTCFullYear(), month: localWall.getUTCMonth() + 1, day: localWall.getUTCDate(), hour: localWall.getUTCHours(), minute: localWall.getUTCMinutes() };
  const utc = localWallToUtc(local, timeZone); return { localDate: isoDateFromParts(local), localTime: `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`, utcDate: utc.toISOString().slice(0, 10), utcTime: utc.toISOString().slice(11, 16), deferred: deferToMorning };
}
function pnrForFlight(flight: TripStep, documents: ExportedDocument[]) {
  const inTitle = flight.title.match(/(?:·|\s)([A-Z0-9]{6})\b/i)?.[1]?.toUpperCase();
  const number = flightNumber(flight.title);
  const document = documents.find((entry) => isFlightPlan(entry) && (!number || new RegExp(number.replace(" ", "\\s*"), "i").test(entry.excerpt)));
  const inDocument = document ? `${document.name}\n${document.excerpt}`.match(/(?:PNR|booking(?:\s+reference)?|référence(?:\s+de)?\s*(?:réservation|dossier)|confirmation(?:\s+code)?)\s*[:#-]?\s*([A-Z0-9]{5,8})/i)?.[1]?.toUpperCase() : undefined;
  const segmentIndex = document && number ? document.excerpt.search(new RegExp(number.replace(" ", "\\s*"), "i")) : -1;
  const sourceExcerpt = document ? clean(document.excerpt.slice(Math.max(0, segmentIndex - 160), Math.max(0, segmentIndex - 160) + 680)) : "";
  return { pnr: inDocument ?? inTitle ?? "", evidence: inDocument ? `PNR ${inDocument} lu dans ${document?.name}.` : inTitle ? `Code ${inTitle} lu dans le segment exporté.` : "Aucun PNR ou code de réservation complet trouvé pour ce segment.", document, sourceExcerpt };
}

function flightDetailFor(flight: TripStep, documents: ExportedDocument[]): FlightDetail {
  const pnr = pnrForFlight(flight, documents);
  return { flightId: flight.id, flightNumber: flightNumber(flight.title) || flight.title, route: flight.location, departureDate: flight.date, departureTime: flight.time, arrivalDate: flight.arrivalDate, arrivalTime: flight.arrivalTime, pnr: pnr.pnr, pnrEvidence: pnr.evidence, sourceName: pnr.document?.name, sourceExcerpt: pnr.sourceExcerpt, action: pnr.pnr ? undefined : "Demander à l’agence le PNR complet de ce segment et vérifier sa concordance avec le billet aérien." };
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
  const arrivalDate = isoDate(first(record.arrivalDate, record.arrival_date));
  const arrivalTime = text(first(record.arrivalTime, record.arrival_time), "");
  return { id: `${type}-${index}`, type, title, location, date, time: time || undefined, arrivalDate: arrivalDate === "—" ? undefined : arrivalDate, arrivalTime: arrivalTime || undefined, status: "ok", detail: text(first(record.description, record.notes, record.supplier), "Présence enregistrée dans le dossier.") };
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

type ExportedDocument = { name: string; kind: string; category: string; url: string; excerpt: string; extractionStatus: string };

const fullDocumentText = (document: ExportedDocument) => `${document.name}\n${document.excerpt}`.toLowerCase();
const isFlightPlanDocument = (document: ExportedDocument) => /(?:numéro de billet|votre e-ticket|compagnie émettrice|boarding pass|carte d.?embarquement|flight itinerary|billet d.?avion)/i.test(`${document.name}\n${document.excerpt}`);
const isIdentityDocument = (document: ExportedDocument) => /(?:^|[^a-z])(?:passeport|passport|cni|carte nationale d.?identité)(?:[^a-z]|$)/i.test(document.name) || /(?:document number|numéro de passeport|passport number|passeport n°|carte nationale d.?identité)/i.test(document.excerpt);
const isHotelDocument = (document: ExportedDocument) => /(?:^|\n)\s*(?:hotel|hôtel)\s*:/i.test(document.excerpt) || /(?:reservation|booking)[\s\S]{0,180}(?:room|chambre|check.?in|check.?out|plan repas)/i.test(document.excerpt);
const isTransportDocument = (document: ExportedDocument) => /(?:pickup date|pickup time|dropoff address|limo|transfer|transfert|chauffeur|train|ferry|car rental)/i.test(fullDocumentText(document));
const isActivityDocument = (document: ExportedDocument) => /(?:tour\/activity|tour\/?activity|restaurant reservation|activity date|activité|excursion|reservation confirmation)/i.test(fullDocumentText(document));

function exportDocuments(raw: Record<string, unknown>): ExportedDocument[] {
  return arrayFrom(raw.documents).map((item, index) => {
    const record = recordOf(item);
    return { name: text(record.name, `Document ${index + 1}`), kind: text(record.kind, "fichier"), category: text(record.category, "voucher"), url: text(record.url, ""), excerpt: text(first(record.excerpt, record.text), ""), extractionStatus: text(record.extractionStatus, "ok") };
  }).filter((document) => document.extractionStatus !== "error");
}

function exportSteps(raw: Record<string, unknown>): TripStep[] {
  const year = text(raw.generatedAt, new Date().getUTCFullYear().toString()).match(/20\d{2}/)?.[0] ?? new Date().getUTCFullYear().toString();
  const typeMap: Record<string, string> = { flight: "Vol", hotel: "Hôtel", transfer: "Transfert", activity: "Activité", train: "Train", "car-rental": "Location voiture", ferry: "Ferry" };
  return arrayFrom(raw.services).map((item, index) => {
    const record = recordOf(item);
    const sourceDate = isoDate(record.date);
    const date = /^2000-/.test(sourceDate) ? `${year}-${sourceDate.slice(5)}` : sourceDate;
    const type = typeMap[text(record.type, "other").toLowerCase()] ?? text(record.type, "Prestation");
    return { id: text(record.id, `${type}-${index}`), type, title: text(record.title, `${type} ${index + 1}`), location: text(first(record.location, record.address, record.city), "Lieu à confirmer"), date, time: text(record.time, "") || undefined, arrivalDate: isoDate(first(record.arrivalDate, record.arrival_date)) === "—" ? undefined : isoDate(first(record.arrivalDate, record.arrival_date)), arrivalTime: text(first(record.arrivalTime, record.arrival_time), "") || undefined, status: "ok" as AuditStatus, detail: `Prestation structurée exportée depuis ${text(record.source, "l’extension OnSpot")}.` };
  }).filter((step) => step.date !== "—");
}

function travelerCountFromText(value: string) { return Number(value.match(/Voyageurs\s*\((\d+)\)/i)?.[1] ?? 0); }

function analyzeLegacyTrip(raw: Record<string, unknown>): AuditReport {
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
  const ticketRecords = extractTickets(raw);
  const minusOneDay = (date: string) => { const parsed = new Date(`${date}T12:00:00Z`); if (Number.isNaN(parsed.getTime())) return date; parsed.setUTCDate(parsed.getUTCDate() - 1); return parsed.toISOString().slice(0, 10); };
  const requiresReconfirmation = (step: TripStep) => { const needle = `${step.title} ${step.location}`.toLowerCase(); const index = combined.toLowerCase().indexOf(needle.split(" ").slice(0, 4).join(" ")); const nearby = index >= 0 ? combined.slice(Math.max(0, index - 180), index + 520) : ""; return /reconfirm|reconfirmation|reconfirmer|24\s*h|h-24|h\s*24|confirm before/i.test(nearby); };
  const reminders: AuditReminder[] = steps.flatMap((step): AuditReminder[] => { if (!step.date || step.date === "—" || !/^\d{4}-\d{2}-\d{2}$/.test(step.date)) return []; if (step.type === "Vol") return [{ id: `checkin-${step.id}`, kind: "CHECK-IN" as const, date: minusOneDay(step.date), time: step.time, timezone: "UTC" as const, label: `Check-in · ${step.title}`, detail: `À effectuer 24 h avant le vol du ${step.date}, selon l’UTC.`, status: "pending" as AuditStatus }]; if (["Transfert", "Activité"].includes(step.type) && requiresReconfirmation(step)) return [{ id: `h24-${step.id}`, kind: "H-24" as const, date: minusOneDay(step.date), timezone: "UTC" as const, label: `Reconfirmation · ${step.title}`, detail: `Le voucher indique une reconfirmation 24 h avant la prestation du ${step.date}.`, status: "pending" as AuditStatus }]; return []; });
  const outboundDate = startDate !== "—" ? startDate : flights.map((flight) => flight.date).filter(Boolean).sort()[0];
  const outboundArrival = flights.filter((flight) => flight.date === outboundDate && flight.arrivalDate && flight.arrivalTime).sort((a, b) => `${a.arrivalDate}${a.arrivalTime}`.localeCompare(`${b.arrivalDate}${b.arrivalTime}`)).at(-1);
  const welcomeZone = outboundArrival ? timezoneForDestination(destination, outboundArrival.location) : "";
  const welcome = outboundArrival?.arrivalDate && outboundArrival.arrivalTime && welcomeZone ? welcomeSchedule(outboundArrival.arrivalDate, outboundArrival.arrivalTime, welcomeZone) : null;
  if (outboundArrival && welcome) reminders.push({ id: `welcome-${outboundArrival.id}`, kind: "WELCOME", date: welcome.utcDate, time: welcome.utcTime, timezone: "UTC", localDate: welcome.localDate, localTime: welcome.localTime, localTimezone: welcomeZone, label: `Welcome call · ${outboundArrival.location}`, detail: welcome.deferred ? `L’échéance H+5 dépasse 20:00 à destination : appel reporté à 09:00 le ${welcome.localDate}, heure locale (${welcomeZone}).` : `À effectuer à ${welcome.localTime} le ${welcome.localDate}, heure locale de destination (${welcomeZone}).`, status: "pending" });
  const hasFlightPlanEvidence = /plan(?:s)? de vol|itinéraire de vol|boarding pass|carte(?:s)? d.?embarquement|e[- ]?ticket|billet(?:s)? d.?avion|billet(?:s)? de vol/i.test(combined);
  const ticketPending = /Tickets\s*\(\s*\d+\s*\)[\s\S]{0,180}?(?:En attente|Agence)/i.test(combined);
  const documentChecks: DocumentCheck[] = [
    { id: "flight-plan", label: "Plans de vol / billets aériens", category: "flight-plan", status: flights.length === 0 ? "not-applicable" : hasFlightPlanEvidence ? "present" : ticketPending ? "pending" : "missing", evidence: flights.length === 0 ? "Aucun vol détecté dans l’itinéraire." : hasFlightPlanEvidence ? "Référence de billet ou plan de vol repérée dans l’export." : ticketPending ? "Vol identifié, mais le ticket est encore en attente." : "Vol identifié sans plan de vol ou billet exploitable." },
    { id: "identity", label: "Passeports / CNI", category: "identity", status: identityDocuments.length ? "present" : /passeports?|CNI|cartes? d’identité/i.test(combined) ? "pending" : "missing", evidence: identityDocuments.length ? identityDocuments.join(" · ") : "Aucun fichier ou statut finalisé clairement repéré." },
    { id: "hotels", label: "Vouchers hôtels", category: "hotel", status: hotels.length && documents.length ? "present" : hotels.length ? "pending" : "missing", evidence: `${hotels.length} hébergement(s) retrouvé(s) dans la timeline.` },
    { id: "transport", label: "Vouchers transports", category: "transport", status: transfers.length || trains.length ? "present" : "missing", evidence: `${transfers.length} transfert(s) et ${trains.length} train(s) retrouvé(s).` },
    { id: "activity", label: "Vouchers activités", category: "activity", status: activities.length ? "present" : "not-applicable", evidence: `${activities.length} activité(s) retrouvée(s) dans la timeline.` },
  ];
  if (flights.length > 0 && !hasFlightPlanEvidence) issues.push({ id: "flight-plans-missing", severity: ticketPending ? "warning" : "critical", title: "Plans de vol non retrouvés", detail: ticketPending ? "Les vols sont présents dans l’itinéraire, mais le billet aérien apparaît non finalisé et aucun plan de vol exploitable n’est exporté." : "Des vols sont présents dans l’itinéraire, mais aucun plan de vol, billet ou carte d’embarquement n’est retrouvé parmi les documents exportés.", source: "itinéraire · documents joints", action: "Demander à l’agence le plan de vol ou billet aérien complet, puis réexporter le dossier avant de poursuivre le contrôle." });
  if (identityDocuments.length === 0) issues.push({ id: "identity-documents-missing", severity: "warning", title: "Passeports / CNI non retrouvés", detail: "Aucun document d’identité n’est explicitement repéré dans le texte exporté.", action: "Vérifier l’onglet Vouchers et les pièces jointes de la tripcard." });
  if (/en attente \(Agence\)/i.test(combined) && /passeports?/i.test(combined)) issues.push({ id: "identity-documents-pending", severity: "warning", title: "Pièces d’identité demandées mais non finalisées", detail: "Un message demande les passeports pour émettre les cartes d’embarquement et le ticket apparaît en attente agence.", source: "ticket / message OnSpot", action: "Obtenir les passeports ou CNI et contrôler leur présence dans les vouchers." });
  const checked = Math.max(steps.length + documents.length + reminders.length + 8, 8); const critical = issues.filter((issue) => issue.severity === "critical").length; const warnings = issues.filter((issue) => issue.severity === "warning").length; const passed = Math.max(checked - critical - warnings, 0); const domain = (label: string, count: number, related: AuditIssue[], note: string) => ({ label, count, status: related.some((issue) => issue.severity === "critical") ? "critical" as AuditStatus : related.length ? "warning" as AuditStatus : "ok" as AuditStatus, note }); const issue = (id: string) => issues.filter((entry) => entry.id === id);
  return { raw, tripName, reference, destination, startDate, endDate, travelers, steps, issues, reminders, metadata, documentChecks, checks: [], flightDetails: flights.map((flight) => flightDetailFor(flight, [])), tickets: ticketRecords, elite: normalizeElite(recordOf(raw.elite)), stats: { checked, passed, warnings, critical }, domains: [domain("Méta & voyageurs", travelers.length + 4, [...issue("missing-travelers"), ...issue("missing-dates"), ...issue("country-conflict")], travelers.length ? "Identité et période repérées" : "Informations à compléter"), domain("Vols", flights.length + documentChecks.filter((check) => check.category === "flight-plan").length, issue("flight-plans-missing"), flights.length ? `${flights.length} segment${flights.length > 1 ? "s" : ""} détecté${flights.length > 1 ? "s" : ""} · plan de vol ${hasFlightPlanEvidence ? "retrouvé" : "à contrôler"}` : "Aucun segment retrouvé"), domain("Hébergements", hotels.length, issue("missing-hotels"), hotels.length ? `${hotels.length} étape${hotels.length > 1 ? "s" : ""} retrouvée${hotels.length > 1 ? "s" : ""}` : "Contrôle requis"), domain("Transferts & documents", transfers.length + documents.length + documentChecks.length, [...issue("missing-transfers"), ...issue("flight-plans-missing")], `${transfers.length} transfert${transfers.length > 1 ? "s" : ""}, ${documents.length} document${documents.length > 1 ? "s" : ""}, ${documentChecks.length} contrôles documentaires`), domain("Cohérence", steps.length, [...issue("return-date-conflict"), ...issue("duplicate-date"), ...issue("empty-itinerary")], issues.length ? "Points d’attention générés" : "Aucune anomalie locale")] };
}

const check = (id: string, domain: string, label: string, status: AuditStatus, finding: string, evidence: string, action?: string): AuditCheck => ({ id, domain, label, status, finding, evidence, action });
const timeInMinutes = (value?: string) => { const match = (value ?? "").match(/^(\d{1,2}):(\d{2})$/); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };
const flightNumber = (value: string) => value.match(/\b([A-Z]{2})\s?(\d{2,4})\b/i)?.slice(1).join(" ").toUpperCase() ?? "";
const isFlightPlan = (document: ExportedDocument) => /(?:numéro de billet|votre e-ticket|compagnie émettrice|boarding pass|carte d.?embarquement|flight itinerary|billet d.?avion)/i.test(`${document.name}\n${document.excerpt}`);
const isIdentity = (document: ExportedDocument) => /(?:^|[^a-z])(?:passeport|passport|cni|carte nationale d.?identité)(?:[^a-z]|$)/i.test(document.name) || /(?:document number|numéro de passeport|passport number|passeport n°|carte nationale d.?identité)/i.test(document.excerpt);
const isHotelVoucher = (document: ExportedDocument) => /(?:^|\n)\s*(?:hotel|hôtel)\s*:/i.test(document.excerpt) || /(?:reservation|booking)[\s\S]{0,180}(?:room|chambre|check.?in|check.?out|plan repas)/i.test(document.excerpt);
const isTransportVoucher = (document: ExportedDocument) => /(?:pickup date|pickup time|dropoff address|limo|transfer|transfert|chauffeur|train|ferry|car rental)/i.test(`${document.name}\n${document.excerpt}`);
const isActivityVoucher = (document: ExportedDocument) => /(?:tour\/activity|tour\/?activity|restaurant reservation|activity date|activité|excursion|reservation confirmation)/i.test(`${document.name}\n${document.excerpt}`);

function serviceMatchesDocument(step: TripStep, document: ExportedDocument) {
  if (step.type === "Vol") { const number = flightNumber(step.title); return Boolean(number && new RegExp(number.replace(" ", "\\s*"), "i").test(document.excerpt)); }
  const content = `${document.name}\n${document.excerpt}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = step.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{4,}/g) ?? [];
  const terms = words.filter((word) => !["reservation", "confirmation", "service", "hotel", "las", "vegas", "room", "chambre", "king", "view", "from", "with"].includes(word));
  return terms.filter((word) => content.includes(word)).length >= Math.min(2, Math.max(1, terms.length));
}

function enrichArrivals(steps: TripStep[], documents: ExportedDocument[], fallbackYear: string) {
  return steps.map((step) => {
    if (step.type !== "Vol") return step;
    const number = flightNumber(step.title);
    const document = documents.find((entry) => isFlightPlan(entry) && new RegExp(number.replace(" ", "\\s*"), "i").test(entry.excerpt));
    if (!document) return step;
    const start = document.excerpt.search(new RegExp(number.replace(" ", "\\s*"), "i"));
    const departureStart = document.excerpt.slice(0, Math.max(0, start)).toLowerCase().lastIndexOf("départ");
    const departureFragment = document.excerpt.slice(Math.max(0, departureStart), start + 120);
    const departure = departureFragment.match(/Départ\s*:\s*([^\n]{0,75}?)(?:Heure\s*:\s*)(\d{1,2})h(\d{2})/i);
    const fragment = document.excerpt.slice(Math.max(0, start), start + 700);
    const arrival = fragment.match(/Arrivée\s*:\s*([^\n]{0,75}?)(?:Heure\s*:\s*)(\d{1,2})h(\d{2})/i);
    const departureDate = departure ? isoDate(`${departure[1]} ${fallbackYear}`) : step.date;
    const arrivalDate = arrival ? isoDate(`${arrival[1]} ${fallbackYear}`) : step.arrivalDate;
    return { ...step, date: departureDate === "—" ? step.date : departureDate, time: departure ? `${departure[2].padStart(2, "0")}:${departure[3]}` : step.time, arrivalDate: arrivalDate === "—" ? step.date : arrivalDate, arrivalTime: arrival ? `${arrival[2].padStart(2, "0")}:${arrival[3]}` : step.arrivalTime };
  });
}

export function analyzeTrip(raw: Record<string, unknown>): AuditReport {
  const structured = exportSteps(raw);
  if (!structured.length) {
    const legacy = analyzeLegacyTrip(raw);
    const documents = exportDocuments(raw);
    const identityDocuments = documents.filter(isIdentity);
    const documentChecks = legacy.documentChecks.map((item) => item.id !== "identity" ? item : { ...item, status: identityDocuments.length ? "present" as const : "pending" as const, evidence: identityDocuments.length ? identityDocuments.map((document) => document.name).join(" · ") : "Aucune pièce jointe d’identité vérifiable ; les simples mentions textuelles sont ignorées." });
    const metadata = { ...legacy.metadata, identityDocuments: identityDocuments.map((document) => document.name) };
    const issues = legacy.issues.filter((issue) => issue.id !== "duplicate-date" && !issue.id.startsWith("identity-documents"));
    return { ...legacy, metadata, documentChecks, issues, tickets: extractTickets(raw), elite: normalizeElite(recordOf(raw.elite)), flightDetails: legacy.steps.filter((step) => step.type === "Vol").map((flight) => flightDetailFor(flight, documents.filter(isFlightPlan))), checks: [check("legacy-export", "Export", "Structure des données", "pending", "Export historique analysé en mode de compatibilité.", "La collection services[] est absente.", "Réexporter avec l’extension à jour pour activer les contrôles par preuve."), check("legacy-identity", "Documents", "Passeports / CNI réellement joints", identityDocuments.length ? "ok" : "pending", identityDocuments.length ? `${identityDocuments.length} fichier(s) d’identité joint(s) identifié(s).` : "Aucun fichier d’identité vérifiable dans cet export historique.", identityDocuments.length ? identityDocuments.map((document) => document.name).join(" · ") : "Les mentions de passeport/CNI dans le texte ne sont pas traitées comme des documents.", identityDocuments.length ? undefined : "Réexporter le dossier avec l’extension 2.0.2 ou vérifier les pièces jointes dans OnSpot.")] };
  }

  const legacy = analyzeLegacyTrip(raw);
  const documents = exportDocuments(raw);
  const year = text(raw.generatedAt, new Date().getUTCFullYear().toString()).match(/20\d{2}/)?.[0] ?? new Date().getUTCFullYear().toString();
  const steps = enrichArrivals(structured, documents, year);
  const travelers = arrayFrom(raw.travelers).map(String).filter(Boolean);
  const flights = steps.filter((step) => step.type === "Vol");
  const hotels = steps.filter((step) => step.type === "Hôtel");
  const transports = steps.filter((step) => ["Transfert", "Train", "Ferry", "Location voiture"].includes(step.type));
  const activities = steps.filter((step) => step.type === "Activité");
  const flightDocuments = documents.filter(isFlightPlan);
  const identityDocuments = documents.filter(isIdentity);
  const hotelDocuments = documents.filter(isHotelVoucher);
  const transportDocuments = documents.filter((document) => isTransportVoucher(document) && !isFlightPlan(document));
  const activityDocuments = documents.filter((document) => isActivityVoucher(document) && !isFlightPlan(document));
  const metadataRecord = recordOf(raw.metadata);
  const combined = `${onSpotText(raw).all}\n${text(metadataRecord.ticketsText, "")}`;
  const expectedPax = travelerCountFromText(combined);
  const metadata: AuditMetadata = { ...legacy.metadata, agency: text(first(metadataRecord.agency, legacy.metadata.agency), "Non renseignée"), tripId: text(first(metadataRecord.tripId, legacy.metadata.tripId), "Non renseigné"), profileNotes: Array.from(new Set([...arrayFrom(metadataRecord.profileNotes).map(String), ...legacy.metadata.profileNotes])), identityDocuments: identityDocuments.map((document) => document.name) };
  const ticketRecords = extractTickets(raw);
  const elite = normalizeElite(recordOf(raw.elite));
  const checks: AuditCheck[] = [
    check("metadata", "Dossier", "Référence et identifiant TripCard", legacy.reference !== "Dossier sans référence" && metadata.tripId !== "Non renseigné" ? "ok" : "pending", legacy.reference !== "Dossier sans référence" ? "Référence et identifiant sont exportés." : "Référence de réservation ou identifiant TripCard incomplet.", `Référence : ${legacy.reference} · Trip ID : ${metadata.tripId}.`, "Compléter ou vérifier les métadonnées du dossier."),
    check("dates", "Dossier", "Période globale du voyage", legacy.startDate !== "—" && legacy.endDate !== "—" ? "ok" : "critical", legacy.startDate !== "—" && legacy.endDate !== "—" ? "Dates de départ et de retour trouvées." : "La période globale ne peut pas être confirmée.", `Départ : ${legacy.startDate} · retour : ${legacy.endDate}.`, "Vérifier le bandeau TripCard, les vols et les vouchers."),
    check("travelers", "Voyageurs", "Nombre et liste des voyageurs", expectedPax && travelers.length < expectedPax ? "pending" : travelers.length ? "ok" : "critical", expectedPax && travelers.length < expectedPax ? `Le dossier indique ${expectedPax} voyageurs, mais l’export ne nomme que ${travelers.length}.` : travelers.length ? `${travelers.length} voyageur(s) nommément exporté(s).` : "Aucun voyageur nommé n’est exploitable.", expectedPax ? `Bandeau : ${expectedPax} · noms exportés : ${travelers.length}.` : `${travelers.length} nom(s) exporté(s).`, expectedPax > travelers.length ? "Déplier la liste Voyageurs dans OnSpot puis réexporter avant toute validation nominative." : undefined),
    check("profile", "Voyageurs", "Notes profil et attentions", metadata.profileNotes.length ? "ok" : "pending", metadata.profileNotes.length ? `${metadata.profileNotes.length} attention(s) exportée(s).` : "Aucune note profil exploitable n’a été exportée.", metadata.profileNotes.length ? metadata.profileNotes.join(" · ") : "Bloc Notes vide ou absent dans l’export.", metadata.profileNotes.length ? undefined : "Vérifier manuellement les notes client ; leur absence d’export ne prouve pas qu’il n’y en a pas."),
    check("identity", "Documents", "Passeports / CNI réellement joints", identityDocuments.length ? "ok" : "pending", identityDocuments.length ? `${identityDocuments.length} fichier(s) d’identité joint(s) et explicitement identifié(s).` : "Aucun fichier de passeport ou CNI n’est joint dans cet export.", identityDocuments.length ? identityDocuments.map((document) => document.name).join(" · ") : "Les mentions dans des vouchers sont ignorées : elles ne prouvent jamais une pièce d’identité jointe.", identityDocuments.length ? undefined : "Vérifier si les pièces sont requises, puis les joindre ou les exporter si nécessaire."),
    check("flight-plan", "Vols", "Plans de vol / billets aériens", flights.length === 0 ? "pending" : flightDocuments.length ? "ok" : "critical", flights.length === 0 ? "Aucun vol structuré n’est exporté." : flightDocuments.length ? `${flightDocuments.length} billet(s) ou plan(s) de vol avec marqueurs aéronautiques fiables.` : "Des vols sont présents sans billet aérien ou plan de vol exploitable.", flightDocuments.length ? flightDocuments.map((document) => document.name).join(" · ") : "Aucun fichier ne fournit de numéro de billet, compagnie émettrice ou segment de vol.", flights.length ? (flightDocuments.length ? undefined : "Ajouter le billet aérien aux vouchers puis réexporter.") : "Contrôler l’onglet Vols de l’itinéraire."),
    check("flight-pnr", "Vols", "PNR complet pour chaque segment", flights.length === 0 ? "pending" : flights.every((flight) => Boolean(pnrForFlight(flight, flightDocuments).pnr)) ? "ok" : "pending", flights.length === 0 ? "Aucun segment aérien à contrôler." : flights.every((flight) => Boolean(pnrForFlight(flight, flightDocuments).pnr)) ? `${flights.length} PNR ou code de réservation complet(s) identifié(s).` : `${flights.filter((flight) => !pnrForFlight(flight, flightDocuments).pnr).length} segment(s) sans PNR complet exploitable.`, flights.map((flight) => `${flight.title} : ${pnrForFlight(flight, flightDocuments).evidence}`).join(" · "), flights.some((flight) => !pnrForFlight(flight, flightDocuments).pnr) ? "Demander à l’agence le PNR complet de chaque segment aérien et vérifier sa concordance avec le billet." : undefined),
  ];
  const addCoverageCheck = (id: string, domain: string, label: string, services: TripStep[], evidence: ExportedDocument[]) => {
    if (!services.length) return checks.push(check(id, domain, label, "ok", "Non applicable : aucune prestation de ce type n’est exportée.", "services[] ne contient aucune prestation concernée."));
    const missing = services.filter((service) => !evidence.some((document) => serviceMatchesDocument(service, document)));
    checks.push(check(id, domain, label, missing.length ? "pending" : "ok", missing.length ? `${missing.length} prestation(s) ne peuvent pas être rapprochées d’un voucher avec suffisamment de certitude.` : `${services.length} prestation(s) comparée(s) à un voucher exploitable.`, missing.length ? `À rapprocher : ${missing.map((service) => `${service.title} (${service.date})`).join(" · ")}.` : evidence.map((document) => document.name).join(" · "), missing.length ? "Vérifier ou joindre le voucher de chaque prestation listée." : undefined));
  };
  addCoverageCheck("hotel-vouchers", "Hébergements", "Vouchers hôtels par chambre / date", hotels, hotelDocuments);
  addCoverageCheck("transport-vouchers", "Transports", "Vouchers transferts, trains, ferries ou voitures", transports, transportDocuments);
  addCoverageCheck("activity-vouchers", "Activités", "Vouchers activités et réservations", activities, activityDocuments);
  const conflicts: AuditCheck[] = [];
  const timed = steps.filter((step) => step.date && step.date !== "—" && timeInMinutes(step.time) !== null);
  for (let i = 0; i < timed.length; i += 1) for (let j = i + 1; j < timed.length; j += 1) if (timed[i].date === timed[j].date && timed[i].time === timed[j].time && timed[i].type !== timed[j].type) conflicts.push(check(`same-time-${i}-${j}`, "Cohérence", "Prestations distinctes au même horaire", "critical", `${timed[i].title} et ${timed[j].title} sont prévus à ${timed[i].time} le ${timed[i].date}.`, `${timed[i].type} : ${timed[i].title} · ${timed[j].type} : ${timed[j].title}.`, "Vérifier les horaires contractuels et corriger le dossier concerné."));
  for (const transfer of transports) for (const flight of flights) { const number = flightNumber(flight.title); if (number && transfer.date === flight.date && new RegExp(number.replace(" ", "\\s*"), "i").test(`${transfer.title} ${transfer.location}`) && /departing|départ/i.test(transfer.location) && timeInMinutes(transfer.time) !== null && timeInMinutes(flight.time) !== null && timeInMinutes(transfer.time)! >= timeInMinutes(flight.time)!) conflicts.push(check(`transfer-after-flight-${transfer.id}`, "Cohérence", "Transfert associé postérieur au départ du vol", "critical", `Le transfert associé au ${number} commence à ${transfer.time}, après le départ du vol à ${flight.time}.`, `${transfer.title} · ${transfer.location} · ${transfer.date}.`, "Faire corriger l’heure de prise en charge ou le segment aérien associé.")); }
  checks.push(...conflicts, check("timeline", "Cohérence", "Séquence des prestations horaires", conflicts.length ? "critical" : "ok", conflicts.length ? `${conflicts.length} conflit(s) horaire(s) objectivé(s).` : `${timed.length} prestation(s) horodatée(s) contrôlée(s) ; aucun conflit démontré.`, conflicts.length ? conflicts.map((item) => item.evidence).join(" · ") : "Le simple fait d’avoir plusieurs prestations le même jour ne génère plus d’alerte.", conflicts.length ? "Traiter les conflits listés." : undefined), check("locations", "Cohérence", "Adresses, lieux et distances", "pending", "Aucune distance n’est certifiée sans coordonnées ou calcul d’itinéraire fiable.", `${steps.filter((step) => step.location && step.location !== "Lieu à confirmer").length}/${steps.length} lieu(x) exporté(s).`, "Vérifier les adresses critiques manuellement ou activer ultérieurement un calcul d’itinéraire optionnel."));
  const minusOneDay = (date: string) => { const value = new Date(`${date}T12:00:00Z`); if (Number.isNaN(value.getTime())) return date; value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); };
  const reminders: AuditReminder[] = flights.flatMap((flight) => !flight.date || flight.date === "—" ? [] : [{ id: `checkin-${flight.id}`, kind: "CHECK-IN" as const, date: minusOneDay(flight.date), time: flight.time, timezone: "UTC" as const, label: `Check-in · ${flight.title}`, detail: `À effectuer 24 h avant le départ du ${flight.date}, selon l’UTC.`, status: "pending" as AuditStatus }]);
  const reconfirmationDocuments = [...transportDocuments, ...activityDocuments].filter((document) => /reconfirm|reconfirmation|reconfirmer|confirm before|24\s*h|h-24/i.test(document.excerpt));
  for (const service of [...activities, ...transports]) if (service.date && reconfirmationDocuments.some((document) => serviceMatchesDocument(service, document))) reminders.push({ id: `h24-${service.id}`, kind: "H-24", date: minusOneDay(service.date), timezone: "UTC", label: `Reconfirmation · ${service.title}`, detail: `Le voucher associé demande une reconfirmation 24 h avant le ${service.date}.`, status: "pending" });
  const outboundDate = legacy.startDate !== "—" ? legacy.startDate : flights.map((flight) => flight.date).filter(Boolean).sort()[0];
  const outboundCandidates = flights.filter((flight) => flight.date === outboundDate && flight.arrivalDate && flight.arrivalTime);
  const sameDayArrivals = outboundCandidates.filter((flight) => flight.arrivalDate === outboundDate);
  const outboundArrival = (sameDayArrivals.length ? sameDayArrivals : outboundCandidates).sort((a, b) => `${a.arrivalDate}${a.arrivalTime}`.localeCompare(`${b.arrivalDate}${b.arrivalTime}`)).at(-1);
  const welcomeTimezone = outboundArrival ? timezoneForDestination(legacy.destination, outboundArrival.location) : "";
  const welcome = outboundArrival?.arrivalDate && outboundArrival.arrivalTime && welcomeTimezone ? welcomeSchedule(outboundArrival.arrivalDate, outboundArrival.arrivalTime, welcomeTimezone) : null;
  if (outboundArrival && welcome) reminders.push({ id: `welcome-${outboundArrival.id}`, kind: "WELCOME", date: welcome.utcDate, time: welcome.utcTime, timezone: "UTC", localDate: welcome.localDate, localTime: welcome.localTime, localTimezone: welcomeTimezone, label: `Welcome call · ${outboundArrival.location}`, detail: welcome.deferred ? `L’échéance H+5 dépasse 20:00 à destination : appel reporté à 09:00 le ${welcome.localDate}, heure locale (${welcomeTimezone}).` : `À effectuer 5 h après l’arrivée finale, soit ${welcome.localTime} le ${welcome.localDate}, heure locale (${welcomeTimezone}).`, status: "pending" });
  checks.push(check("reminders", "Rappels", "Check-in UTC et welcome call local", flights.length && (!outboundArrival || !welcome) ? "pending" : "ok", flights.length ? `${reminders.filter((reminder) => reminder.kind === "CHECK-IN").length} check-in et ${reminders.filter((reminder) => reminder.kind === "WELCOME").length} welcome call calculé(s).` : "Aucun rappel aérien requis.", welcome && outboundArrival ? `Arrivée du premier trajet : ${outboundArrival.arrivalDate} ${outboundArrival.arrivalTime} locale · appel ${welcome.localDate} ${welcome.localTime} (${welcomeTimezone}) / ${welcome.utcDate} ${welcome.utcTime} UTC.` : outboundArrival ? `Fuseau local non déterminé pour ${outboundArrival.location}.` : "Aucune heure d’arrivée finale du trajet aller exploitable : aucun welcome call n’est inventé.", flights.length && !welcome ? "Compléter l’heure d’arrivée et la destination finale, puis vérifier le fuseau local avant de programmer le welcome call." : undefined));
  const issues = checks.filter((item) => item.status === "critical" || (item.status === "pending" && item.action)).map((item): AuditIssue => ({ id: item.id, severity: item.status === "critical" ? "critical" : "warning", title: item.label, detail: item.finding, source: item.evidence, action: item.action }));
  const documentChecks: DocumentCheck[] = [{ id: "flight-plan", label: "Plans de vol / billets aériens", category: "flight-plan", status: flights.length ? (flightDocuments.length ? "present" : "missing") : "not-applicable", evidence: flightDocuments.length ? flightDocuments.map((document) => document.name).join(" · ") : "Aucun billet aérien joint avec segments exploitables." }, { id: "identity", label: "Passeports / CNI joints", category: "identity", status: identityDocuments.length ? "present" : "pending", evidence: identityDocuments.length ? identityDocuments.map((document) => document.name).join(" · ") : "Aucune pièce d’identité jointe ; les mentions textuelles sont ignorées." }, { id: "hotels", label: "Vouchers hôtels", category: "hotel", status: hotels.length ? (hotelDocuments.length ? "present" : "pending") : "not-applicable", evidence: `${hotelDocuments.length} voucher(s) exploitable(s) pour ${hotels.length} hébergement(s).` }, { id: "transport", label: "Vouchers transports", category: "transport", status: transports.length ? (transportDocuments.length ? "present" : "pending") : "not-applicable", evidence: `${transportDocuments.length} voucher(s) exploitable(s) pour ${transports.length} transport(s).` }, { id: "activity", label: "Vouchers activités", category: "activity", status: activities.length ? (activityDocuments.length ? "present" : "pending") : "not-applicable", evidence: `${activityDocuments.length} voucher(s) exploitable(s) pour ${activities.length} activité(s).` }];
  const flightDetails = flights.map((flight) => flightDetailFor(flight, flightDocuments));
  const labels = ["Dossier", "Voyageurs", "Documents", "Vols", "Hébergements", "Transports", "Activités", "Cohérence", "Rappels"];
  const domains = labels.map((label) => { const entries = checks.filter((item) => item.domain === label); return { label, count: entries.length, status: entries.some((item) => item.status === "critical") ? "critical" as AuditStatus : entries.some((item) => item.status === "pending") ? "warning" as AuditStatus : "ok" as AuditStatus, note: entries.length ? `${entries.filter((item) => item.status === "ok").length}/${entries.length} contrôle(s) conforme(s)` : "Non applicable" }; });
  return { raw, tripName: legacy.tripName, reference: text(first(raw.reference, legacy.reference), "Dossier sans référence"), destination: legacy.destination, startDate: legacy.startDate, endDate: legacy.endDate, travelers, steps, issues, reminders, metadata, documentChecks, checks, flightDetails, tickets: ticketRecords, elite, stats: { checked: checks.length, passed: checks.filter((item) => item.status === "ok").length, warnings: checks.filter((item) => item.status === "pending").length, critical: checks.filter((item) => item.status === "critical").length }, domains };
}

export const demoPayload: Record<string, unknown> = { meta: { reference: "ELT-2026-0814", name: "Sicile — famille Martin", destination: "Sicile, Italie", startDate: "2026-09-14", endDate: "2026-09-23" }, travelers: ["Claire Martin", "Julien Martin", "Léa Martin"], flights: [{ flightNumber: "AF 1186 · K4L8M2", departureDate: "2026-09-14", departureTime: "09:20", arrivalDate: "2026-09-14", arrivalTime: "11:50", location: "CDG → CTA" }, { flightNumber: "AF 1291 · K4L8M2", departureDate: "2026-09-23", departureTime: "18:45", arrivalDate: "2026-09-23", arrivalTime: "21:25", location: "PMO → CDG" }], hotels: [{ name: "Palazzo Sant’Agata", checkIn: "2026-09-14", city: "Catane" }, { name: "Masseria del Sole", checkIn: "2026-09-17", city: "Noto" }, { name: "Casa Marina", checkIn: "2026-09-20", city: "Palerme" }], activities: [{ title: "Etna au lever du jour", date: "2026-09-16", city: "Catane", supplier: "Opérateur local" }, { title: "Cours de cuisine sicilienne", date: "2026-09-19", city: "Noto", supplier: "Opérateur local" }], documents: [{ name: "Plan_de_vol_AF_Sicile.pdf", category: "flight-plan", excerpt: "Billet d’avion · PNR : K4L8M2\nAF 1186 · CDG → CTA\nDépart : 14 sept. · Heure : 09h20\nArrivée : 14 sept. · Heure : 11h50\nAF 1291 · PMO → CDG\nDépart : 23 sept. · Heure : 18h45\nArrivée : 23 sept. · Heure : 21h25", extractionStatus: "ok" }, { name: "Voucher Etna", date: "2026-09-16" }, { name: "Billet retour", date: "2026-09-23" }] };

// À ajouter ou adapter dans client/src/lib/audit.ts

export function extractTravelers(payload: any): string[] {
  // 1. Priorité au tableau simple root "travelers"
  if (Array.isArray(payload?.travelers) && payload.travelers.length > 0) {
    const valid = payload.travelers.filter(
      (t: unknown) => typeof t === "string" && t.trim().length > 0
    );
    if (valid.length > 0) return valid;
  }

  // 2. Repli sur metadata.travelerProfiles si renseigné
  if (Array.isArray(payload?.metadata?.travelerProfiles) && payload.metadata.travelerProfiles.length > 0) {
    const profiles = payload.metadata.travelerProfiles
      .map((p: any) => (typeof p === "string" ? p : p?.name || p?.fullName))
      .filter(Boolean);
    if (profiles.length > 0) return profiles;
  }

  // 3. Sécurité : Ne JAMAIS lire payload.services ici pour éviter la pollution par les hôtels
  return ["Voyageur Principal (Nom non extrait)"];
}
// === CORRECTIFS SÉCURITÉ VOYAGEURS & NORMALISATION PAYLOAD ===

export function extractTravelersSafely(payload: any): string[] {
  if (!payload) return ["Voyageur Principal"];
  
  // 1. Priorité absolue au tableau "travelers" de la racine du JSON
  if (Array.isArray(payload.travelers) && payload.travelers.length > 0) {
    const cleanNames = payload.travelers.filter(
      (t: unknown) => typeof t === "string" && t.trim().length > 0
    );
    if (cleanNames.length > 0) return cleanNames;
  }

  // 2. Repli sur travelerProfiles si existant
  if (Array.isArray(payload.metadata?.travelerProfiles) && payload.metadata.travelerProfiles.length > 0) {
    return payload.metadata.travelerProfiles
      .map((p: any) => (typeof p === "string" ? p : p?.name || p?.fullName))
      .filter(Boolean);
  }

  // 3. INTERDICTION STRICTE : Ne jamais basculer sur payload.services (zone Hôtels/Services)
  return ["Voyageur Principal (Nom non extrait)"];
}

export function normalizePayload(data: any): any {
  if (!data || typeof data !== "object") return data;

  // A. Suppression des doublons de services (activités / transferts en double)
  if (Array.isArray(data.services)) {
    const seen = new Set<string>();
    data.services = data.services.filter((service: any) => {
      const key = `${service.type}-${service.date}-${service.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // B. Correction des inversions de lieux (Paris vs Munich sur les vans)
    data.services.forEach((service: any) => {
      if ((service.type === "transfer" || service.type === "activity") && service.title && service.location) {
        if (service.title.includes("Paris") && service.location.includes("Munich")) {
          service.location = "Paris, France";
        }
      }
    });
  }

  // C. Sécurisation directe du tableau voyageurs racine
  data.travelers = extractTravelersSafely(data);

  return data;
}
