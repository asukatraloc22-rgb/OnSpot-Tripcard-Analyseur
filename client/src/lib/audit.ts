/* TripCard ELITE — logique de contrôle locale. Design reminder: Swiss editorial hierarchy, paper dossier clarity, explicit operational statuses. */

export type AuditStatus = "ok" | "warning" | "critical" | "pending";

export type AuditIssue = {
  id: string;
  severity: Exclude<AuditStatus, "pending">;
  title: string;
  detail: string;
  source?: string;
  action?: string;
};

export type TripStep = {
  id: string;
  type: string;
  title: string;
  location: string;
  date?: string;
  time?: string;
  status: AuditStatus;
  detail?: string;
};

export type AuditReport = {
  raw: Record<string, unknown>;
  tripName: string;
  reference: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: string[];
  steps: TripStep[];
  issues: AuditIssue[];
  stats: { checked: number; passed: number; warnings: number; critical: number };
  domains: { label: string; count: number; status: AuditStatus; note: string }[];
};

const text = (value: unknown, fallback = "Non renseigné") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const arrayFrom = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const first = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

function pickList(raw: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const direct = raw[key];
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object") {
      const nested = Object.values(direct as Record<string, unknown>).find(Array.isArray);
      if (nested) return nested as unknown[];
    }
  }
  return [];
}

function isoDate(value: unknown) {
  const valueText = text(value, "");
  const match = valueText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return valueText || "—";
}

function makeStep(item: unknown, index: number, type: string): TripStep {
  const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const location = text(first(record.location, record.city, record.destination, record.address, record.hotelCity), "Lieu à identifier");
  const title = text(first(record.title, record.name, record.hotelName, record.activity, record.service, record.flightNumber), `${type} ${index + 1}`);
  const date = isoDate(first(record.date, record.startDate, record.checkIn, record.departureDate, record.pickupDate));
  const time = text(first(record.time, record.departureTime, record.pickupTime, record.checkInTime), "");
  return { id: `${type}-${index}`, type, title, location, date, time: time || undefined, status: "ok", detail: text(first(record.description, record.notes, record.supplier), "Présence enregistrée dans le dossier.") };
}

export function analyzeTrip(raw: Record<string, unknown>): AuditReport {
  const meta = (raw.meta && typeof raw.meta === "object" ? raw.meta : {}) as Record<string, unknown>;
  const trip = (raw.trip && typeof raw.trip === "object" ? raw.trip : {}) as Record<string, unknown>;
  const travelerList = pickList(raw, ["travelers", "passengers", "pax", "clients"]);
  const travelers = travelerList.map((item) => {
    if (typeof item === "string") return item;
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return text(first(record.name, record.fullName, [record.firstName, record.lastName].filter(Boolean).join(" ")), "Voyageur");
  }).filter(Boolean);

  const flights = pickList(raw, ["flights", "flightSegments", "air"]).map((item, index) => makeStep(item, index, "Vol"));
  const hotels = pickList(raw, ["hotels", "accommodations", "lodging"]).map((item, index) => makeStep(item, index, "Hôtel"));
  const transfers = pickList(raw, ["transfers", "transport", "groundTransport"]).map((item, index) => makeStep(item, index, "Transfert"));
  const activities = pickList(raw, ["activities", "excursions", "experiences", "tours"]).map((item, index) => makeStep(item, index, "Expérience"));
  const documents = pickList(raw, ["documents", "vouchers", "tickets"]).map((item, index) => makeStep(item, index, "Document"));
  const steps = [...flights, ...hotels, ...transfers, ...activities];

  const issues: AuditIssue[] = [];
  const startDate = isoDate(first(meta.startDate, trip.startDate, raw.startDate, raw.departureDate));
  const endDate = isoDate(first(meta.endDate, trip.endDate, raw.endDate, raw.returnDate));
  const destination = text(first(meta.destination, trip.destination, raw.destination, raw.country), "Destination à confirmer");
  const reference = text(first(meta.reference, meta.tripId, raw.reference, raw.tripId, raw.id), "Dossier sans référence");
  const tripName = text(first(meta.name, trip.name, raw.tripName, raw.title), `Dossier ${reference}`);

  if (travelers.length === 0) issues.push({ id: "missing-travelers", severity: "warning", title: "Voyageurs non identifiés", detail: "Aucun nom de passager n’a été trouvé dans les champs reconnus.", action: "Vérifier l’onglet voyageurs de la tripcard." });
  if (startDate === "—" || endDate === "—") issues.push({ id: "missing-dates", severity: "critical", title: "Dates du voyage incomplètes", detail: "La période de voyage ne peut pas être confirmée à partir des données importées.", action: "Comparer avec l’itinéraire et les billets émis." });
  if (steps.length === 0) issues.push({ id: "empty-itinerary", severity: "critical", title: "Aucune étape d’itinéraire détectée", detail: "Le JSON ne contient pas de liste reconnue de vols, hôtels, transferts ou expériences.", action: "Contrôler la copie depuis l’extension OnSpot Audit Assistant." });
  if (hotels.length === 0) issues.push({ id: "missing-hotels", severity: "warning", title: "Hébergement non retrouvé", detail: "Aucun hébergement n’est présent dans les collections analysées.", action: "Vérifier les vouchers hôtels et les nuits intermédiaires." });
  if (transfers.length === 0 && steps.length > 0) issues.push({ id: "missing-transfers", severity: "warning", title: "Transferts non retrouvés", detail: "Aucun transfert n’est identifié. Cela peut être normal, mais doit être confirmé sur le dossier.", action: "Contrôler les vouchers de transport et les arrivées tardives." });

  const normalizedDates = steps.map((step) => step.date).filter((date) => date && date !== "—");
  const duplicateDates = normalizedDates.filter((date, index) => normalizedDates.indexOf(date) !== index);
  if (duplicateDates.length > 0) issues.push({ id: "duplicate-date", severity: "warning", title: "Plusieurs prestations le même jour", detail: `Les dates ${Array.from(new Set(duplicateDates)).join(", ")} comportent plusieurs prestations.`, action: "Vérifier les horaires et les temps de transfert." });

  const checked = Math.max(steps.length + documents.length + 4, 4);
  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const passed = Math.max(checked - critical - warnings, 0);
  const domain = (label: string, count: number, related: AuditIssue[], note: string) => ({ label, count, status: related.some((issue) => issue.severity === "critical") ? "critical" as AuditStatus : related.length ? "warning" as AuditStatus : "ok" as AuditStatus, note });
  const issue = (id: string) => issues.filter((entry) => entry.id === id);

  return {
    raw, tripName, reference, destination, startDate, endDate, travelers, steps, issues,
    stats: { checked, passed, warnings, critical },
    domains: [
      domain("Méta & voyageurs", travelers.length + 4, [...issue("missing-travelers"), ...issue("missing-dates")], travelers.length ? "Identité et période repérées" : "Informations à compléter"),
      domain("Vols", flights.length, [], flights.length ? `${flights.length} segment${flights.length > 1 ? "s" : ""} détecté${flights.length > 1 ? "s" : ""}` : "Aucun segment retrouvé"),
      domain("Hébergements", hotels.length, issue("missing-hotels"), hotels.length ? `${hotels.length} étape${hotels.length > 1 ? "s" : ""} retrouvée${hotels.length > 1 ? "s" : ""}` : "Contrôle requis"),
      domain("Transferts & documents", transfers.length + documents.length, issue("missing-transfers"), `${transfers.length} transfert${transfers.length > 1 ? "s" : ""}, ${documents.length} document${documents.length > 1 ? "s" : ""}`),
      domain("Cohérence", steps.length, [...issue("duplicate-date"), ...issue("empty-itinerary")], issues.length ? "Points d’attention générés" : "Aucune anomalie locale"),
    ],
  };
}

export const demoPayload: Record<string, unknown> = {
  meta: { reference: "ELT-2026-0814", name: "Sicile — famille Martin", destination: "Sicile, Italie", startDate: "2026-09-14", endDate: "2026-09-23" },
  travelers: [{ fullName: "Claire Martin" }, { fullName: "Julien Martin" }, { fullName: "Léa Martin" }],
  flights: [{ flightNumber: "AF 1186", departureDate: "2026-09-14", departureTime: "09:20", location: "Paris CDG → Catane" }, { flightNumber: "AF 1291", departureDate: "2026-09-23", departureTime: "18:45", location: "Palerme → Paris CDG" }],
  hotels: [{ name: "Palazzo Sant’Agata", checkIn: "2026-09-14", city: "Catane" }, { name: "Masseria del Sole", checkIn: "2026-09-17", city: "Noto" }, { name: "Casa Marina", checkIn: "2026-09-20", city: "Palerme" }],
  activities: [{ title: "Etna au lever du jour", date: "2026-09-16", city: "Catane", supplier: "Opérateur local" }, { title: "Cours de cuisine sicilienne", date: "2026-09-19", city: "Noto", supplier: "Opérateur local" }],
  documents: [{ name: "Voucher Etna", date: "2026-09-16" }, { name: "Billet retour", date: "2026-09-23" }],
};
