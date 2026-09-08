export type TicketStatus = string;
export type TicketVisibility = "customer" | "internal" | "system" | "unknown";

export type TicketMessage = {
  id: string;
  text: string;
  author?: string;
  createdAt?: string;
  visibility: TicketVisibility;
  source?: string;
  attachmentRefs?: string[];
};

export type TicketEvent = {
  id: string;
  kind: "message" | "assignment" | "status" | "priority" | "reminder" | "attachment" | "escalation" | "system" | "unknown";
  createdAt?: string;
  actor?: string;
  summary: string;
  sourceRefs?: string[];
};

export type TicketReminder = {
  id: string;
  text?: string;
  status: "active" | "completed" | "cancelled" | "overdue" | "unknown";
  dueAt?: string;
  timezone?: string;
  completedAt?: string;
  sourceRefs?: string[];
};

export type TicketAttachment = {
  id: string;
  name: string;
  kind: string;
  url?: string;
  category?: string;
  extractionStatus?: string;
  excerpt?: string;
};

export type Ticket = {
  id: string;
  ticketNumber: string;
  tripRef?: string;
  current: {
    status: TicketStatus;
    priority?: string;
    category?: string;
    subject?: string;
    source?: string;
    assignees: string[];
    lastResponseAt?: string;
    lastResponseFrom?: string;
  };
  classification: {
    type?: string;
    category?: string;
    subject?: string;
    intents: string[];
    rootCause?: string;
    resolution?: string;
    facetsNeedReview: string[];
  };
  messages: TicketMessage[];
  events: TicketEvent[];
  statusTransitions: Array<{ from?: string; to: string; at?: string; actor?: string }>;
  reminders: TicketReminder[];
  attachments: TicketAttachment[];
  linkedTickets: string[];
  episode: "new" | "active" | "waiting" | "resolved" | "reopened" | "unknown";
  whatRemains: string[];
  nextAction?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown, fallback = "") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const first = (...values: unknown[]) => values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function normalizeStatus(value: unknown) {
  const raw = asString(value, "UNKNOWN");
  return raw.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function eventId(prefix: string, index: number, value: unknown) {
  const source = asRecord(value);
  return asString(first(source.id, source.eventId, source.created_at, source.createdAt), `${prefix}-${index + 1}`);
}

function normalizeMessage(value: unknown, index: number): TicketMessage {
  const item = asRecord(value);
  const text = clean(asString(first(item.text, item.body, item.content, item.message), ""));
  return {
    id: eventId("message", index, value),
    text,
    author: asString(first(asRecord(item.author).name, item.author, item.created_by, item.createdBy), ""),
    createdAt: asString(first(item.created_at, item.createdAt, item.timestamp), "") || undefined,
    visibility: item.visibility === "internal" || item.visibility === "system" || item.visibility === "customer" ? item.visibility : "unknown",
    source: asString(first(item.source, item.channel), "") || undefined,
    attachmentRefs: asArray(item.attachmentRefs ?? item.attachments).map(entry => asString(asRecord(entry).id ?? entry)).filter(Boolean),
  };
}

function normalizeEvent(value: unknown, index: number): TicketEvent {
  const item = asRecord(value);
  const kind = asString(first(item.kind, item.type, item.event_type), "unknown").toLowerCase();
  const allowed: TicketEvent["kind"][] = ["message", "assignment", "status", "priority", "reminder", "attachment", "escalation", "system", "unknown"];
  return {
    id: eventId("event", index, value),
    kind: allowed.includes(kind as TicketEvent["kind"]) ? kind as TicketEvent["kind"] : "unknown",
    createdAt: asString(first(item.created_at, item.createdAt, item.timestamp), "") || undefined,
    actor: asString(first(asRecord(item.actor).name, item.actor, item.author), "") || undefined,
    summary: clean(asString(first(item.summary, item.text, item.description, item.message), "Événement ticket")),
    sourceRefs: asArray(item.sourceRefs).map(String),
  };
}

function normalizeReminder(value: unknown, index: number): TicketReminder {
  const item = asRecord(value);
  const rawStatus = asString(first(item.status, item.state), "unknown").toLowerCase();
  const status: TicketReminder["status"] = rawStatus.includes("complete") || rawStatus.includes("done") ? "completed" : rawStatus.includes("overdue") ? "overdue" : rawStatus.includes("cancel") ? "cancelled" : rawStatus.includes("active") || rawStatus.includes("pending") ? "active" : "unknown";
  return {
    id: eventId("reminder", index, value),
    text: clean(asString(first(item.text, item.reminder_text, item.description), "")) || undefined,
    status,
    dueAt: asString(first(item.dueAt, item.due_at, item.due), "") || undefined,
    timezone: asString(first(item.timezone, item.reminderTimezone), "") || undefined,
    completedAt: asString(first(item.completedAt, item.completed_at), "") || undefined,
    sourceRefs: asArray(item.sourceRefs).map(String),
  };
}

function normalizeAttachment(value: unknown, index: number): TicketAttachment {
  const item = asRecord(value);
  const name = asString(first(item.name, item.document_name, item.filename, item.fileName), `Pièce jointe ${index + 1}`);
  return {
    id: eventId("attachment", index, value),
    name,
    kind: asString(first(item.kind, item.type, item.mimeType), "file"),
    url: asString(first(item.url, item.href), "") || undefined,
    category: asString(item.category, "") || undefined,
    extractionStatus: asString(first(item.extractionStatus, item.extraction_status), "") || undefined,
    excerpt: asString(first(item.excerpt, item.text), "") || undefined,
  };
}

function inferEpisode(status: string, transitions: Ticket["statusTransitions"], messages: TicketMessage[]) : Ticket["episode"] {
  const normalized = status.toLowerCase();
  const resolved = /resolved|solved|closed|clôturé|résolu/.test(normalized);
  const active = /pending|open|new|progress|attente|ouvert|cours/.test(normalized);
  const hadResolved = transitions.some(item => /resolved|solved|closed|clôturé|résolu/i.test(item.to));
  const reopened = hadResolved && (active || messages.length > 0);
  if (reopened) return "reopened";
  if (resolved) return "resolved";
  if (/agency|supplier|traveler|back office|front office|attente/.test(normalized)) return "waiting";
  if (/new|nouveau/.test(normalized)) return "new";
  if (active) return "active";
  return "unknown";
}

function deriveRemaining(ticket: Ticket): string[] {
  const remains: string[] = [];
  const current = ticket.current.status.toLowerCase();
  if (/agency|agence|supplier|fournisseur/.test(current)) remains.push("Obtenir la réponse attendue de l’agence ou du fournisseur.");
  if (/traveler|voyageur/.test(current)) remains.push("Obtenir ou confirmer l’information auprès du voyageur.");
  if (ticket.reminders.some(reminder => reminder.status === "active" || reminder.status === "overdue")) remains.push("Traiter les rappels encore actifs ou échus.");
  if (!ticket.messages.some(message => message.text)) remains.push("Lire ou compléter le contexte conversationnel du ticket.");
  if (ticket.attachments.some(attachment => attachment.extractionStatus === "error")) remains.push("Vérifier manuellement les pièces jointes dont l’extraction a échoué.");
  if (!remains.length && ticket.episode === "resolved") remains.push("Aucune action restante détectée ; conserver la preuve de résolution.");
  return remains;
}

function isPlaceholderTicket(ticket: Ticket): boolean {
  const subject = `${ticket.current.subject ?? ""} ${ticket.classification.subject ?? ""}`.trim();
  const messageText = ticket.messages.map(message => message.text).join(" ").trim();
  const eventText = ticket.events.map(event => event.summary).join(" ").trim();
  const statusText = ticket.current.status ?? "";
  const hasMeaningfulSubject = Boolean(subject && !/ticket\s*(à|a)\s*qualifier|sans objet|no subject|untitled|qualifier le ticket/i.test(subject));
  const hasMeaningfulEvidence = Boolean(messageText || eventText || ticket.attachments.length || /agency|agence|traveler|voyageur|supplier|fournisseur|urgent|immediate|immédiat|waiting|pending|active|resolved|closed|ouvert|clôturé|résolu/i.test(statusText));
  return !hasMeaningfulSubject && !hasMeaningfulEvidence;
}

export function normalizeTicket(value: unknown, index = 0): Ticket {
  const item = asRecord(value);
  const current = asRecord(item.current ?? item.statusDetails ?? item);
  const classification = asRecord(item.classification ?? item);
  const transitions = asArray(item.statusTransitions ?? item.status_history ?? item.statusHistory).map(entry => {
    const row = asRecord(entry);
    return {
      from: asString(first(row.from, row.previous, row.oldStatus), "") || undefined,
      to: asString(first(row.to, row.status, row.newStatus), "UNKNOWN"),
      at: asString(first(row.at, row.createdAt, row.created_at, row.timestamp), "") || undefined,
      actor: asString(first(asRecord(row.actor).name, row.actor, row.author), "") || undefined,
    };
  });
  const status = normalizeStatus(first(current.status, item.status, "UNKNOWN"));
  const messages = asArray(item.messages ?? item.replies ?? item.conversation).map(normalizeMessage).filter(message => message.text);
  const events = asArray(item.events ?? item.activities ?? item.activity).map(normalizeEvent);
  const reminders = asArray(item.reminders ?? item.reminder).map(normalizeReminder);
  const attachments = asArray(item.attachments ?? item.documents).map(normalizeAttachment);
  const ticket: Ticket = {
    id: asString(first(item.id, item.ticketId), `ticket-${index + 1}`),
    ticketNumber: asString(first(item.ticketNumber, item.ticket_number, item.number), `#${index + 1}`),
    tripRef: asString(first(item.tripRef, item.tripId, item.trip_card_number, asRecord(item.trip).card_number), "") || undefined,
    current: {
      status,
      priority: normalizeStatus(first(current.priority, item.priority, "")) || undefined,
      category: asString(first(current.category, item.category), "") || undefined,
      subject: asString(first(current.subject, item.subject), "") || undefined,
      source: asString(first(current.source, item.source), "") || undefined,
      assignees: asArray(first(current.assignees, item.assignees, item.assignee)).map(entry => asString(asRecord(entry).name ?? entry)).filter(Boolean),
      lastResponseAt: asString(first(current.lastResponseAt, item.last_response_at, item.lastResponseAt), "") || undefined,
      lastResponseFrom: asString(first(current.lastResponseFrom, item.last_response_from, item.lastResponseFrom), "") || undefined,
    },
    classification: {
      type: asString(first(classification.type, item.ticket_type), "") || undefined,
      category: asString(first(classification.category, item.category), "") || undefined,
      subject: asString(first(classification.subject, item.subject), "") || undefined,
      intents: asArray(first(classification.intents, item.intents)).map(String),
      rootCause: asString(first(classification.rootCause, classification.root_cause, item.rootCause, item.root_cause), "") || undefined,
      resolution: asString(first(classification.resolution, item.resolution), "") || undefined,
      facetsNeedReview: asArray(first(classification.facetsNeedReview, classification.facets_need_review, item.facetsNeedReview)).map(String),
    },
    messages,
    events,
    statusTransitions: transitions,
    reminders,
    attachments,
    linkedTickets: asArray(first(item.linkedTickets, item.linked_tickets)).map(entry => asString(asRecord(entry).ticketNumber ?? asRecord(entry).id ?? entry)).filter(Boolean),
    episode: "unknown",
    whatRemains: [],
  };
  ticket.episode = inferEpisode(status, transitions, messages);
  ticket.whatRemains = deriveRemaining(ticket);
  ticket.nextAction = ticket.whatRemains[0];
  return ticket;
}

export function isMeaningfulTicket(ticket: Ticket) {
  return !isPlaceholderTicket(ticket);
}

const isTicketLike = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["id", "ticketId", "ticketNumber", "ticket_number", "number", "status", "current", "messages", "events", "attachments", "linkedTickets", "tripRef", "trip_id"].some((key) => key in record);
};

const collectTicketCandidates = (value: unknown, seen = new WeakSet<object>()): unknown[] => {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value as object)) return [];
  seen.add(value as object);

  if (Array.isArray(value)) {
    const directTicketObjects = value.filter(isTicketLike);
    if (directTicketObjects.length) return directTicketObjects;
    return value.flatMap((item) => collectTicketCandidates(item, seen));
  }

  const record = value as Record<string, unknown>;
  if (isTicketLike(record)) return [record];

  const nested = Object.values(record).flatMap((item) => collectTicketCandidates(item, seen));
  if (nested.length) return nested;

  return Object.entries(record)
    .filter(([key]) => /ticket|tickets|item|items|result|results|data|records/i.test(key))
    .flatMap(([, item]) => collectTicketCandidates(item, seen));
};

export function extractTickets(raw: Record<string, unknown>): Ticket[] {
  const candidates = collectTicketCandidates(raw)
    .map((item) => normalizeTicket(item))
    .filter(Boolean);

  const merged = new Map<string, Ticket>();
  for (const candidate of candidates) {
    const key = candidate.id || candidate.ticketNumber;
    if (!key) continue;
    if (isPlaceholderTicket(candidate)) continue;
    merged.set(key, candidate);
  }

  return Array.from(merged.values()).sort((a, b) => (b.current.lastResponseAt ?? "").localeCompare(a.current.lastResponseAt ?? ""));
}

export function mergeTickets(existing: Ticket[], incoming: Ticket[]): Ticket[] {
  const byId = new Map<string, Ticket>();
  const index = (ticket: Ticket) => {
    if (ticket.id) byId.set(`id:${ticket.id}`, ticket);
    if (ticket.ticketNumber) byId.set(`number:${ticket.ticketNumber}`, ticket);
  };
  existing.forEach(index);
  for (const next of incoming) {
    const previous = byId.get(`id:${next.id}`) ?? byId.get(`number:${next.ticketNumber}`);
    if (!previous) {
      index(next);
      continue;
    }
    const mergeUnique = <T extends { id?: string }>(left: T[], right: T[]) => {
      const result = new Map(left.map(item => [item.id ?? JSON.stringify(item), item]));
      right.forEach(item => result.set(item.id ?? JSON.stringify(item), item));
      return Array.from(result.values());
    };
    const merged = normalizeTicket({ ...previous, ...next, current: { ...previous.current, ...next.current }, classification: { ...previous.classification, ...next.classification }, messages: mergeUnique(previous.messages, next.messages), events: mergeUnique(previous.events, next.events), reminders: mergeUnique(previous.reminders, next.reminders), attachments: mergeUnique(previous.attachments, next.attachments), statusTransitions: [...previous.statusTransitions, ...next.statusTransitions] });
    Array.from(byId.entries()).forEach(([alias, value]) => { if (value === previous) byId.delete(alias); });
    index(merged);
  }
  return Array.from(new Set(byId.values())).sort((a, b) => (b.current.lastResponseAt ?? "").localeCompare(a.current.lastResponseAt ?? ""));
}

export function ticketStats(tickets: Ticket[]) {
  return {
    total: tickets.length,
    active: tickets.filter(ticket => ["new", "active", "waiting", "reopened"].includes(ticket.episode)).length,
    resolved: tickets.filter(ticket => ticket.episode === "resolved").length,
    urgent: tickets.filter(ticket => /urgent|immediate|immédiat/i.test(ticket.current.priority ?? "")).length,
    waitingAgency: tickets.filter(ticket => /agency|agence|supplier|fournisseur/i.test(ticket.current.status)).length,
  };
}
