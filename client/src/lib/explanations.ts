import type { AuditReport, AuditCheck, TripStep } from "./audit";
import type { Ticket } from "./tickets";

export type EvidenceRef = {
  source: string;
  text: string;
  certainty: "confirmed" | "missing" | "inferred";
};

export type OperationalAction = {
  id: string;
  priority: "now" | "next" | "monitor";
  label: string;
  owner: string;
  deadline: string;
  why: string;
  evidence?: string;
};

export type TicketExplanation = {
  ticketId: string;
  oneLine: string;
  subject: string;
  tripElement: string;
  initialSituation: string;
  currentSituation: string;
  rootCause: string;
  impact: "blocking" | "risk" | "minor" | "unknown";
  impactLabel: string;
  actionsDone: string[];
  remaining: string[];
  nextAction: OperationalAction | null;
  evidence: EvidenceRef[];
  missingEvidence: string[];
  chronology: Array<{ at: string; label: string; detail: string; branch: "client" | "agency" | "supplier" | "internal" | "system" }>;
};

export type TripNarrative = {
  headline: string;
  overview: string;
  composition: string;
  particularities: string[];
  operationalState: string;
  openPoints: string[];
  resolvedPoints: string[];
  dayReads: Array<{ dayIndex: number; date: string; summary: string; steps: string[]; attention: string[] }>;
  actions: OperationalAction[];
  agencyReport: { subject: string; body: string };
};

const clean = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const first = (...values: unknown[]) => values.map(clean).find(Boolean) ?? "";
const statusText = (ticket: Ticket) => ticket.current.status || "statut non exporté";
const actorBranch = (value: string): TicketExplanation["chronology"][number]["branch"] => {
  const text = value.toLowerCase();
  if (/agency|agence/.test(text)) return "agency";
  if (/supplier|fournisseur|operator|prestataire/.test(text)) return "supplier";
  if (/system|autom/.test(text)) return "system";
  if (/client|customer|traveler|voyageur/.test(text)) return "client";
  return "internal";
};

function ticketElement(ticket: Ticket, report: AuditReport) {
  const needle = `${ticket.current.subject ?? ""} ${ticket.classification.subject ?? ""} ${ticket.current.category ?? ""}`.toLowerCase();
  const match = report.steps.find(step => `${step.title} ${step.type} ${step.location}`.toLowerCase().split(/\s+/).some(token => token.length > 4 && needle.includes(token)));
  return match ? `${match.type} · ${match.title}${match.date && match.date !== "—" ? ` · ${match.date}` : ""}` : first(ticket.current.category, "Élément du voyage non rattaché");
}

function actionFor(ticket: Ticket, index: number): OperationalAction | null {
  const remaining = ticket.whatRemains.filter(Boolean);
  if (!remaining.length && ticket.episode === "resolved") return null;
  const label = first(ticket.nextAction, remaining[0], "Qualifier le ticket et obtenir la preuve manquante.");
  const waiting = /agency|agence|supplier|fournisseur/i.test(statusText(ticket));
  return { id: `${ticket.id}-next`, priority: ticket.episode === "reopened" || /urgent|immediate|immédiat/i.test(ticket.current.priority ?? "") ? "now" : index < 3 ? "next" : "monitor", label, owner: waiting ? "Agence / fournisseur" : first(ticket.current.assignees[0], "Agent Elite"), deadline: ticket.reminders.find(item => item.status === "overdue") ? "Déjà échue — traiter maintenant" : ticket.reminders.find(item => item.status === "active")?.dueAt ?? "À fixer après qualification", why: "Cette action est déduite du statut, des rappels et des éléments non clôturés exportés.", evidence: ticket.current.status };
}

export function explainTicket(ticket: Ticket, report: AuditReport, index = 0): TicketExplanation {
  const subject = first(ticket.current.subject, ticket.classification.subject, ticket.current.category, "Ticket sans objet explicite");
  const element = ticketElement(ticket, report);
  const messages = ticket.messages.filter(message => message.text);
  const latest = messages.at(-1);
  const cause = first(ticket.classification.rootCause, "Cause non explicitement établie dans l’export.");
  const resolution = first(ticket.classification.resolution);
  const actionsDone = [resolution, ...ticket.events.filter(event => event.kind !== "message").map(event => event.summary), ...ticket.statusTransitions.slice(-3).map(item => `Statut : ${item.from ?? "début"} → ${item.to}`)].filter(Boolean).slice(0, 6);
  const missingEvidence = [
    !ticket.current.subject && "Objet précis du ticket",
    !messages.length && "Conversation ou message source",
    !resolution && ticket.episode === "resolved" && "Preuve de la résolution",
    ticket.attachments.some(item => item.extractionStatus === "error") && "Lecture manuelle d’une pièce jointe en erreur",
  ].filter(Boolean) as string[];
  const remaining = ticket.whatRemains.length ? ticket.whatRemains : ticket.episode === "resolved" ? ["Aucune action restante détectée ; conserver la preuve de résolution."] : ["Qualifier le problème et confirmer le prochain interlocuteur."];
  const chronology = [
    ...ticket.statusTransitions.map(item => ({ at: item.at ?? "Date non exportée", label: `Statut : ${item.from ?? "début"} → ${item.to}`, detail: item.actor ? `Transition effectuée par ${item.actor}.` : "Transition enregistrée dans l’export.", branch: actorBranch(item.actor ?? item.to) })),
    ...messages.map(message => ({ at: message.createdAt ?? "Date non exportée", label: message.author || "Message", detail: message.text, branch: actorBranch(message.author ?? message.visibility) })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const impact: TicketExplanation["impact"] = ticket.episode === "reopened" || /urgent|immediate|immédiat/i.test(ticket.current.priority ?? "") ? "blocking" : ticket.episode === "resolved" ? "minor" : ticket.episode === "waiting" ? "risk" : "unknown";
  const impactLabel = impact === "blocking" ? "Le traitement peut exposer le voyage à un blocage." : impact === "risk" ? "Le voyage n’est pas nécessairement bloqué, mais une dépendance externe reste ouverte." : impact === "minor" ? "Le ticket est clôturé ou sans blocage actif détecté." : "Impact à confirmer à partir d’une preuve opérationnelle.";
  return { ticketId: ticket.id, oneLine: `${subject} — ${ticket.episode === "resolved" ? "résolu" : `état : ${statusText(ticket)}`}. ${remaining[0] ?? "Aucune action restante."}`, subject, tripElement: element, initialSituation: first(messages[0]?.text, "Situation initiale non décrite dans l’export."), currentSituation: latest ? `Dernier élément connu : ${latest.text}` : `État actuel exporté : ${statusText(ticket)}.`, rootCause: cause, impact, impactLabel, actionsDone, remaining, nextAction: actionFor(ticket, index), evidence: [{ source: "Statut ticket", text: statusText(ticket), certainty: "confirmed" }, ...(latest ? [{ source: "Dernier message", text: latest.text, certainty: "confirmed" as const }] : [])], missingEvidence, chronology };
}

function stepsByDay(report: AuditReport) {
  const groups = new Map<string, TripStep[]>();
  report.steps.forEach(step => { const key = step.date && step.date !== "—" ? step.date : "Date à confirmer"; groups.set(key, [...(groups.get(key) ?? []), step]); });
  return Array.from(groups.entries()).map(([date, steps], dayIndex) => ({ dayIndex, date, steps }));
}

export function buildTripNarrative(report: AuditReport, explanations = report.tickets.map((ticket, index) => explainTicket(ticket, report, index))): TripNarrative {
  const types = Array.from(new Set(report.steps.map(step => step.type))).filter(Boolean);
  const destination = report.destination !== "Destination à confirmer" ? report.destination : "destination à confirmer";
  const particularities = [
    report.travelers.length > 1 ? `${report.travelers.length} voyageurs identifiés.` : report.travelers.length === 1 ? "Un voyageur identifié." : "Voyageurs non renseignés.",
    types.length ? `Le séjour combine ${types.join(", ")}.` : "La composition détaillée reste à confirmer.",
    report.flightDetails.some(flight => !flight.pnr) && "Au moins un segment aérien n’a pas de PNR prouvé dans les documents exportés.",
    report.reminders.length > 0 && `${report.reminders.length} rappel(s) opérationnel(s) sont calculés.`,
  ].filter(Boolean) as string[];
  const openPoints = [...report.issues.filter(issue => issue.severity !== "ok").map(issue => issue.title), ...explanations.filter(item => item.impact !== "minor").map(item => item.oneLine)].slice(0, 12);
  const resolvedPoints = explanations.filter(item => item.impact === "minor").map(item => item.oneLine).slice(0, 12);
  const actions = [...report.issues.filter(issue => issue.action).map((issue, index) => ({ id: `audit-${issue.id}`, priority: issue.severity === "critical" ? "now" as const : "next" as const, label: issue.action ?? issue.title, owner: "Agent Elite", deadline: issue.severity === "critical" ? "Avant toute confirmation client" : "Avant départ", why: issue.detail, evidence: issue.source })), ...explanations.map(item => item.nextAction).filter(Boolean) as OperationalAction[]].slice(0, 15);
  const dayReads = stepsByDay(report).map(group => ({ dayIndex: group.dayIndex, date: group.date, summary: group.steps.length ? `${group.steps.length} prestation(s) prévue(s)${group.steps.some(step => step.status !== "ok") ? " ; au moins un point demande une vérification." : "."}` : "Aucune prestation structurée dans l’export.", steps: group.steps.map(step => `${step.type} · ${step.title}`), attention: group.steps.filter(step => step.status !== "ok").map(step => `${step.title} : ${step.detail ?? "statut à vérifier"}`) }));
  const headline = `${report.tripName} · ${destination} · ${report.startDate} → ${report.endDate}`;
  const overview = `Ce voyage concerne ${report.travelers.length ? report.travelers.join(", ") : "des voyageurs non identifiés"} et se déroule à ${destination}, du ${report.startDate} au ${report.endDate}. Il comprend ${report.steps.length} prestation(s) structurée(s) et ${report.tickets.length} ticket(s) capturé(s).`;
  const composition = types.length ? `Le séjour est composé de ${types.join(", ")}.` : "La composition du séjour doit encore être confirmée à partir des vouchers.";
  const operationalState = openPoints.length ? `${openPoints.length} point(s) nécessitent une lecture ou une action. Le premier sujet à traiter est : ${openPoints[0]}.` : "Aucun point bloquant supplémentaire n’est ressorti des éléments structurés exportés.";
  const reportLines = [`Objet : Retour opérationnel — ${report.tripName}`, ``, `Ce voyage concerne ${report.travelers.length ? report.travelers.join(", ") : "des voyageurs non identifiés"} et porte sur ${destination}, du ${report.startDate} au ${report.endDate}.`, composition, ``, `Points rencontrés : ${openPoints.length ? openPoints.join(" ; ") : "aucun incident ouvert détecté dans l’export"}.`, `Résolutions / éléments stabilisés : ${resolvedPoints.length ? resolvedPoints.join(" ; ") : "aucune résolution explicite suffisamment documentée."}`, ``, `Retour opérationnel : ${operationalState}`, ``, `Ce compte rendu est fondé uniquement sur les données exportées et doit être complété lorsque les preuves ou réponses manquantes seront reçues.`];
  return { headline, overview, composition, particularities, operationalState, openPoints, resolvedPoints, dayReads, actions, agencyReport: { subject: `Retour opérationnel — ${report.tripName}`, body: reportLines.join("\n") } };
}
