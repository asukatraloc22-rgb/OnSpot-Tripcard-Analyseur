/* Liquid Glass OnSpot: mission = dossier, proof = checklist, action = décision agent, annotation = sources UTC. */
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardPaste,
  Clock3,
  FileJson,
  Flag,
  GitBranch,
  Gauge,
  Inbox,
  MapPin,
  MessageSquare,
  Paperclip,
  Plane,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeTrip,
  demoPayload,
  normalizeReport,
  type AuditCheck,
  type AuditIssue,
  type AuditReminder,
  type AuditReport,
  type AuditStatus,
  type DocumentCheck,
  type EliteFlag,
  type ElitePlan,
  type FlightDetail,
  type TripStep,
} from "@/lib/audit";
import { ticketStats, type Ticket } from "@/lib/tickets";
import { runAi360Analysis, type Ai360Result } from "@/lib/ai360";
import { buildTripNarrative, explainTicket } from "@/lib/explanations";

const markUrl = "/onspot-favicon.svg";
type Tab = "overview" | "checks" | "itinerary" | "documents" | "actions" | "tickets" | "timeline";
type Workspace = "audit" | "recent" | "rules";
type RecentStore = { savedAt: string; report: AuditReport };
type ChecklistFilter = "all" | "remaining" | "completed";
type StepFilter = "Tout" | "Vol" | "Activité" | "Hôtel" | "Ferry" | "Train" | "Restaurant" | "Location voiture" | "Transfert";
type ChecklistProgress = Record<string, boolean>;

const statusLabel = (status: AuditStatus) =>
  status === "ok"
    ? "Conforme"
    : status === "critical"
      ? "Bloquant"
      : "À vérifier";
const progressKey = (reference: string) => `tripcard:checklist-progress:${reference}`;
const readProgress = (reference: string): ChecklistProgress => {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(reference)) ?? "{}");
    return saved && typeof saved === "object" ? (saved as ChecklistProgress) : {};
  } catch {
    return {};
  }
};
const formatDate = (value: string) => {
  if (!value || value === "—") return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(parsed)
        .replace(".", "");
};
const countryFlag = (destination: string) => {
  const value = destination.toLocaleLowerCase("fr-FR");
  const flags: Array<[RegExp, string]> = [
    [/italie|sicile/, "🇮🇹"],
    [/japon/, "🇯🇵"],
    [/croatie/, "🇭🇷"],
    [/bosnie/, "🇧🇦"],
    [/états-unis|etats-unis|usa|las vegas|californie|new york|floride/, "🇺🇸"],
    [/canada/, "🇨🇦"],
    [/espagne/, "🇪🇸"],
    [/portugal/, "🇵🇹"],
    [/grèce|grece/, "🇬🇷"],
    [/royaume-uni|angleterre/, "🇬🇧"],
    [/thailande|thaïlande/, "🇹🇭"],
    [/indonésie|indonesie|bali/, "🇮🇩"],
    [/singapour/, "🇸🇬"],
    [/émirats|emirats|dubaï|dubai/, "🇦🇪"],
    [/maroc/, "🇲🇦"],
    [/maurice/, "🇲🇺"],
    [/seychelles/, "🇸🇨"],
    [/mexique/, "🇲🇽"],
    [/australie/, "🇦🇺"],
    [/nouvelle-zélande|nouvelle zelande/, "🇳🇿"],
  ];
  return flags.find(([regex]) => regex.test(value))?.[1] ?? "🌐";
};
const domainMap: Record<string, string[]> = {
  "Méta & voyageurs": ["Dossier", "Voyageurs"],
  Vols: ["Vols"],
  Hébergements: ["Hébergements"],
  "Transferts & documents": ["Documents", "Transports", "Activités"],
  Cohérence: ["Cohérence"],
  Rappels: ["Rappels"],
};

function StatusPill({ status }: { status: AuditStatus }) {
  const className =
    status === "ok"
      ? "status-pill status-ok"
      : status === "critical"
        ? "status-pill status-critical"
        : status === "warning"
          ? "status-pill status-warning"
          : "status-pill status-pending";
  return (
    <span className={className}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}
function stepEmoji(type: string) {
  if (type === "Vol") return "✈️";
  if (type === "Activité" || type === "Expérience") return "🎟️";
  if (type === "Hôtel") return "🏨";
  if (type === "Ferry") return "⛴️";
  if (type === "Train") return "🚆";
  if (type === "Restaurant") return "🍽️";
  if (type === "Location voiture") return "🚗";
  if (type === "Transfert") return "🚐";
  return "📍";
}
function StepIcon({ type }: { type: string }) {
  if (type === "Vol") return <Plane size={17} />;
  if (type === "Hôtel") return <Archive size={17} />;
  if (["Transfert", "Train", "Ferry", "Location voiture"].includes(type))
    return <ArrowDownToLine size={17} />;
  return <MapPin size={17} />;
}

function TripUnderstandingPanel({ narrative }: { narrative: ReturnType<typeof buildTripNarrative> }) {
  const copyAgencyReport = async () => {
    await navigator.clipboard.writeText(narrative.agencyReport.body);
    toast.success("Compte rendu agence copié", { description: "Le texte est prêt à être adapté et envoyé." });
  };
  return <section className="trip-understanding-panel">
    <div className="panel-heading"><div><p className="eyebrow">Lecture immédiate · dossier vivant</p><h2>Ce voyage concerne…</h2></div><span className="mono">SYNTHÈSE LOCALE</span></div>
    <p className="trip-understanding-lead">{narrative.overview}</p>
    <div className="trip-understanding-grid">
      <div><span className="fact-label">Composition du séjour</span><p>{narrative.composition}</p></div>
      <div><span className="fact-label">Situation opérationnelle</span><p>{narrative.operationalState}</p></div>
    </div>
    <div className="trip-understanding-columns">
      <div><h3>Particularités à garder en tête</h3>{narrative.particularities.map(item => <p className="understanding-line" key={item}>{item}</p>)}</div>
      <div><h3>Ce qui reste ouvert</h3>{narrative.openPoints.length ? narrative.openPoints.slice(0, 6).map(item => <p className="understanding-line attention" key={item}>{item}</p>) : <p className="understanding-line">Aucun point ouvert détecté.</p>}</div>
    </div>
    <details className="agency-report-details"><summary><span>Rapport agence prêt à l’emploi</span><button className="text-button" onClick={event => { event.preventDefault(); void copyAgencyReport(); }}>Copier le rapport</button></summary><div className="agency-report-copy"><b>{narrative.agencyReport.subject}</b><p>{narrative.agencyReport.body}</p></div></details>
  </section>;
}

function Ai360Panel({ report }: { report: AuditReport }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("tripcard:gemini-api-key") ?? "");
  const [model, setModel] = useState(() => localStorage.getItem("tripcard:gemini-model") ?? "gemini-flash-latest");
  const [result, setResult] = useState<Ai360Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputChars, setInputChars] = useState(0);
  const run = async () => {
    setBusy(true); setError("");
    try {
      localStorage.setItem("tripcard:gemini-api-key", apiKey.trim());
      localStorage.setItem("tripcard:gemini-model", model.trim());
      const response = await runAi360Analysis(report, { apiKey, model });
      setResult(response.result); setInputChars(response.estimatedInputChars);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analyse IA impossible."); }
    finally { setBusy(false); }
  };
  return <section className="ai360-panel">
    <div className="panel-heading"><div><p className="eyebrow">Copilote à la demande · preuves compactes</p><h2>Analyse IA 360°</h2></div><Sparkles size={22} /></div>
    <p className="checks-intro">Les contrôles locaux passent en premier. L’IA n’est appelée que lorsque vous le demandez et reçoit un paquet condensé, pas tous les vouchers bruts.</p>
    <div className="ai360-controls"><input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Clé Gemini locale" aria-label="Clé Gemini" /><input value={model} onChange={event => setModel(event.target.value)} placeholder="gemini-flash-latest" aria-label="Modèle Gemini" /><button className="button button-primary compact" onClick={run} disabled={busy || !apiKey.trim()}>{busy ? "Analyse en cours…" : "Analyser le dossier"}</button></div>
    {inputChars ? <p className="ai360-meta">Paquet envoyé : environ {inputChars.toLocaleString("fr-FR")} caractères · modèle {model}</p> : null}
    {error ? <div className="ai360-error">{error}</div> : null}
    {result ? <div className="ai360-result"><div className="ai360-verdict"><strong>{result.verdict === "bloquant" ? "Bloquant" : result.verdict === "attention" ? "À surveiller" : "Situation stable"}</strong><span>Confiance {Math.round(result.confidence * 100)} %</span></div><p>{result.situation}</p>{result.newInconsistencies.length ? <div><h3>Nouvelles incohérences</h3>{result.newInconsistencies.map(item => <article className="ai360-item" key={`${item.title}-${item.evidence}`}><b>{item.title}</b><span>{item.severity}</span><p>{item.whyItMatters}</p><small>Preuve : {item.evidence}</small></article>)}</div> : null}<div><h3>Actions ordonnées</h3>{result.actions.map(item => <article className="ai360-action" key={`${item.order}-${item.action}`}><b>{item.order}. {item.action}</b><span>{item.responsible} · {item.deadline}</span>{item.messageToSend ? <p>Message suggéré : {item.messageToSend}</p> : null}</article>)}</div></div> : null}
  </section>;
}

function IssueCard({
  issue,
  resolved,
  onResolve,
  onOpenProof,
}: {
  issue: AuditIssue;
  resolved: boolean;
  onResolve: () => void;
  onOpenProof: () => void;
}) {
  const className = resolved
    ? "issue-card issue-resolved"
    : issue.severity === "critical"
      ? "issue-card issue-critical"
      : "issue-card issue-warning";
  return (
    <article className={className}>
      <div className="issue-icon">
        {resolved ? (
          <Check size={17} />
        ) : issue.severity === "critical" ? (
          <X size={17} />
        ) : (
          <AlertTriangle size={17} />
        )}
      </div>
      <div className="issue-copy">
        <div className="issue-kicker">
          {resolved
            ? "Traité par l’agent"
            : issue.severity === "critical"
              ? "Action prioritaire"
              : "Point à vérifier"}
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.detail}</p>
        {issue.source && (
          <button className="issue-source proof-button" onClick={onOpenProof}>
            Preuve : {issue.source}
          </button>
        )}
        {issue.action && (
          <div className="issue-action">
            <Flag size={13} />
            {issue.action}
          </div>
        )}
      </div>
      <button className="resolve-button" onClick={onResolve}>
        {resolved ? "Rouvrir" : "Traiter"}
      </button>
    </article>
  );
}

function CheckCard({
  item,
  reviewed,
  onReview,
}: {
  item: AuditCheck;
  reviewed: boolean;
  onReview: () => void;
}) {
  const className =
    item.status === "ok"
      ? "check-card check-ok"
      : item.status === "critical"
        ? "check-card check-critical"
        : item.status === "warning"
          ? "check-card check-warning"
          : "check-card check-pending";
  return (
    <article className={`${className}${reviewed ? " check-reviewed" : ""}`}>
      <div className="check-card-head">
        <div>
          <span className="check-domain">{item.domain}</span>
          <h3>{item.label}</h3>
        </div>
        <StatusPill status={item.status} />
      </div>
      <div className="check-detail">
        <span>Ce qui a été contrôlé</span>
        <p>{item.finding}</p>
      </div>
      <div className="check-evidence">
        <Paperclip size={14} />
        <div>
          <span>Preuve lue dans l’export</span>
          <p>{item.evidence}</p>
        </div>
      </div>
      {item.action ? (
        <div className="check-action">
          <Flag size={13} />
          <div>
            <span>À demander / revérifier avec l’agence</span>
            <p>{item.action}</p>
          </div>
        </div>
      ) : (
        <div className="check-clear">
          <Check size={13} />
          Aucune relance nécessaire sur ce point avec les preuves disponibles.
        </div>
      )}
      <button
        className={reviewed ? "review-toggle reviewed" : "review-toggle"}
        onClick={onReview}
        aria-pressed={reviewed}
      >
        <span className="review-box">{reviewed ? <Check size={13} /> : null}</span>
        <span>{reviewed ? "Revu par l’agent" : "Marquer comme revu"}</span>
      </button>
    </article>
  );
}

function ReminderList({ reminders }: { reminders: AuditReminder[] }) {
  const label = (kind: AuditReminder["kind"]) =>
    kind === "CHECK-IN"
      ? "Check-in vol"
      : kind === "WELCOME"
        ? "Welcome call"
        : "Activité / transfert · H-24";
  const rowClass = (kind: AuditReminder["kind"]) =>
    kind === "CHECK-IN"
      ? "reminder-row reminder-check-in"
      : kind === "WELCOME"
        ? "reminder-row reminder-welcome"
        : "reminder-row reminder-h-24";
  const checkins = reminders.filter(item => item.kind === "CHECK-IN").length;
  const welcomes = reminders.filter(item => item.kind === "WELCOME").length;
  const reconfirmations = reminders.filter(item => item.kind === "H-24").length;
  return (
    <section className="reminder-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agenda opérationnel</p>
          <h2>Rappels à faire</h2>
        </div>
        <span className="mono">UTC + HEURE DESTINATION</span>
      </div>
      <div className="reminder-summary">
        <div>
          <b>{checkins}</b>
          <span>
            check-in vols
            <br />à H-24 UTC
          </span>
        </div>
        <div>
          <b>{welcomes}</b>
          <span>
            welcome call unique
            <br />
            trajet aller
          </span>
        </div>
        <div>
          <b>{reconfirmations}</b>
          <span>
            reconfirmations
            <br />
            selon voucher
          </span>
        </div>
      </div>
      {reminders.length ? (
        <div className="reminder-list">
          {reminders.map(item => (
            <div className={rowClass(item.kind)} key={item.id}>
              <div className="reminder-date">
                <b>{formatDate(item.date)}</b>
                <small>
                  {item.time ? `${item.time} UTC` : "Heure UTC à confirmer"}
                  {item.localTime ? (
                    <>
                      <br />
                      {item.localTime} locale
                    </>
                  ) : null}
                </small>
              </div>
              <div className="reminder-main">
                <span className="reminder-kind">
                  {label(item.kind)}
                  {item.localTimezone ? ` · ${item.localTimezone}` : ""}
                </span>
                <strong>
                  {item.label.replace(
                    /^(Check-in|Welcome call|Reconfirmation)\s*·\s*/,
                    ""
                  )}
                </strong>
                <p>{item.detail}</p>
              </div>
              <span className="reminder-status">À faire</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="clear-state">
          <Check size={20} />
          <div>
            <b>Aucun rappel calculable pour le moment.</b>
            <p>
              Un welcome call n’est jamais calculé sans arrivée exploitable et
              fuseau local de destination.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DocumentStatus({ status }: { status: DocumentCheck["status"] }) {
  const labels = {
    present: "Présent",
    missing: "Manquant",
    pending: "À vérifier",
    "not-applicable": "Non applicable",
  };
  const className =
    status === "present"
      ? "document-status document-present"
      : status === "missing"
        ? "document-status document-missing"
        : status === "pending"
          ? "document-status document-pending"
          : "document-status document-not-applicable";
  return (
    <span className={className}>
      <span />
      {labels[status]}
    </span>
  );
}
function StepRow({
  step,
  onOpenFlight,
}: {
  step: TripStep;
  onOpenFlight?: () => void;
}) {
  const isFlight = step.type === "Vol" && Boolean(onOpenFlight);
  return (
    <div className={isFlight ? "step-row step-row-flight" : "step-row"}>
      <div className="step-rail">
        <div className="step-icon" title={step.type}>
          <span className="step-emoji" aria-hidden="true">{stepEmoji(step.type)}</span>
          <StepIcon type={step.type} />
        </div>
        <div className="step-line" />
      </div>
      <div className="step-content">
        <div className="step-meta">
          <span>{step.type}</span>
          <span className="mono">
            {step.date && step.date !== "—"
              ? formatDate(step.date)
              : "Date à confirmer"}
            {step.time ? ` · ${step.time}` : ""}
          </span>
        </div>
        <h3>{step.title}</h3>
        <p>
          <MapPin size={13} />
          {step.location}
        </p>
        <small>{step.detail}</small>
      </div>
      <div className="step-row-actions">
        <StatusPill status={step.status} />
        {isFlight ? (
          <button className="flight-detail-trigger" onClick={onOpenFlight}>
            Voir PNR
            <ChevronRight size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FlightDetailDialog({
  flight,
  onClose,
}: {
  flight: FlightDetail;
  onClose: () => void;
}) {
  const hasPnr = Boolean(flight.pnr);
  return (
    <div className="raw-overlay flight-overlay" onClick={onClose}>
      <section
        className="flight-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flight-detail-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="flight-dialog-head">
          <div>
            <p className="eyebrow">Segment aérien · preuve locale</p>
            <h2 id="flight-detail-title">{flight.flightNumber}</h2>
            <p className="flight-route"><Plane size={15} />{flight.route}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer le détail du vol">
            <X size={17} />
          </button>
        </header>
        <section className={hasPnr ? "pnr-hero" : "pnr-hero pnr-missing"}>
          <div>
            <span className="mono">PNR / CODE DE RÉSERVATION</span>
            <strong>{hasPnr ? flight.pnr : "À obtenir"}</strong>
            <p>{flight.pnrEvidence}</p>
          </div>
          <StatusPill status={hasPnr ? "ok" : "pending"} />
        </section>
        <section className="flight-facts-grid" aria-label="Horaires du segment">
          <div><span>Départ</span><b>{flight.departureDate ? formatDate(flight.departureDate) : "Date à confirmer"}</b><small>{flight.departureTime || "Heure à confirmer"}</small></div>
          <div><span>Arrivée</span><b>{flight.arrivalDate ? formatDate(flight.arrivalDate) : "Date à confirmer"}</b><small>{flight.arrivalTime || "Heure à confirmer"}</small></div>
          <div><span>Source</span><b>{flight.sourceName || "Aucun plan de vol rattaché"}</b><small>{flight.sourceName ? "Fichier joint analysé localement" : "Le segment seul ne prouve pas le PNR"}</small></div>
        </section>
        <section className="flight-proof-panel">
          <div className="flight-proof-head"><Paperclip size={15} /><span>Extrait de preuve utilisé</span></div>
          {flight.sourceExcerpt ? <p>{flight.sourceExcerpt}</p> : <p className="muted-proof">Aucun extrait de billet aérien n’est disponible pour ce segment. Le PNR ne doit pas être deviné à partir de l’itinéraire.</p>}
        </section>
        {flight.action ? <section className="flight-action"><Flag size={15} /><div><span>À demander / vérifier avec l’agence</span><p>{flight.action}</p></div></section> : <section className="flight-clear"><Check size={15} />Le PNR est associé à une preuve documentaire exportée. Vérifiez sa concordance finale avec le billet avant départ.</section>}
      </section>
    </div>
  );
}

const ticketEpisodeLabel = (episode: Ticket["episode"]) => ({ new: "Nouveau", active: "En cours", waiting: "En attente", resolved: "Résolu", reopened: "Rouvert", unknown: "À qualifier" }[episode]);
const ticketEpisodeStatus = (episode: Ticket["episode"]): AuditStatus => episode === "resolved" ? "ok" : episode === "reopened" ? "critical" : episode === "unknown" ? "pending" : "warning";

function TicketCard({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const status = ticketEpisodeStatus(ticket.episode);
  return (
    <article className="ticket-card">
      <div className="ticket-card-top">
        <div>
          <span className="eyebrow">Ticket #{ticket.ticketNumber} · {ticket.current.category || "Sans catégorie"}</span>
          <h3>{ticket.current.subject || ticket.classification.subject || "Ticket à qualifier"}</h3>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="ticket-card-facts">
        <span className="ticket-chip"><GitBranch size={12} />{ticketEpisodeLabel(ticket.episode)}</span>
        <span className="ticket-chip"><Flag size={12} />{ticket.current.priority || "Priorité non exportée"}</span>
        {ticket.current.lastResponseFrom ? <span className="ticket-chip"><MessageSquare size={12} />{ticket.current.lastResponseFrom}</span> : null}
      </div>
      <p className="ticket-card-summary">{ticket.whatRemains[0] || "Aucune action restante détectée dans l’export."}</p>
      <div className="ticket-card-bottom">
        <span className="mono">{ticket.messages.length} message{ticket.messages.length > 1 ? "s" : ""} · {ticket.attachments.length} pièce{ticket.attachments.length > 1 ? "s" : ""}</span>
        <button className="text-button" onClick={onOpen}>Ouvrir le ticket <ChevronRight size={14} /></button>
      </div>
    </article>
  );
}

function TicketsPanel({ tickets, onOpen }: { tickets: Ticket[]; onOpen: (ticket: Ticket) => void }) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved" | "urgent">("all");
  const stats = ticketStats(tickets);
  const visible = tickets.filter(ticket => filter === "all" || filter === "active" && ["new", "active", "waiting", "reopened"].includes(ticket.episode) || filter === "resolved" && ticket.episode === "resolved" || filter === "urgent" && /urgent|immediate|immédiat/i.test(ticket.current.priority || ""));
  return (
    <div className="tab-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Dossier vivant · traitement opérationnel</p>
          <h2>Tickets du voyage</h2>
        </div>
        <span className="mono">{stats.total} CAPTURÉ{stats.total > 1 ? "S" : ""}</span>
      </div>
      <div className="ticket-summary-grid">
        <button className={filter === "active" ? "ticket-stat active" : "ticket-stat"} onClick={() => setFilter("active")}><b>{stats.active}</b><span>Actifs / en attente</span></button>
        <button className={filter === "urgent" ? "ticket-stat active" : "ticket-stat"} onClick={() => setFilter("urgent")}><b>{stats.urgent}</b><span>Urgents</span></button>
        <button className={filter === "active" ? "ticket-stat active" : "ticket-stat"} onClick={() => setFilter("active")}><b>{stats.waitingAgency}</b><span>En attente agence</span></button>
        <button className={filter === "resolved" ? "ticket-stat active" : "ticket-stat"} onClick={() => setFilter("resolved")}><b>{stats.resolved}</b><span>Résolus</span></button>
      </div>
      <div className="ticket-filter-row">
        {([["all", "Tous"], ["active", "À traiter"], ["urgent", "Urgents"], ["resolved", "Résolus"]] as const).map(([key, label]) => <button key={key} className={filter === key ? "filter-pill active" : "filter-pill"} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      {visible.length ? <div className="ticket-list">{visible.map(ticket => <TicketCard key={ticket.id} ticket={ticket} onOpen={() => onOpen(ticket)} />)}</div> : <div className="clear-state"><CheckCircle2 size={22} /><div><b>Aucun ticket dans ce filtre.</b><p>La capture ne contient pas de ticket correspondant à cette sélection.</p></div></div>}
    </div>
  );
}

function TicketTimeline({ tickets }: { tickets: Ticket[] }) {
  const rows = tickets.flatMap(ticket => [
    ...ticket.statusTransitions.map((item, index) => ({ id: `${ticket.id}-status-${index}`, at: item.at, kind: "Statut", title: `${item.from || "Début"} → ${item.to}`, body: item.actor ? `Par ${item.actor}` : "Transition enregistrée", ticket: ticket.ticketNumber })),
    ...ticket.messages.map(message => ({ id: `${ticket.id}-${message.id}`, at: message.createdAt, kind: "Message", title: message.author || "Message ticket", body: message.text, ticket: ticket.ticketNumber })),
    ...ticket.events.filter(event => event.kind !== "message").map(event => ({ id: `${ticket.id}-${event.id}`, at: event.createdAt, kind: event.kind, title: event.summary, body: event.actor ? `Par ${event.actor}` : "Événement système", ticket: ticket.ticketNumber })),
  ]).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  return (
    <div className="tab-panel">
      <div className="panel-heading"><div><p className="eyebrow">Chronologie unifiée · tickets et décisions</p><h2>Branches de résolution</h2></div><span className="mono">{rows.length} ÉVÉNEMENTS</span></div>
      <p className="checks-intro">Le tronc représente le voyage ; chaque événement est rattaché au ticket qui l’a produit. Une résolution suivie d’un nouveau message reste visible comme une réouverture, jamais comme une anomalie masquée.</p>
      {rows.length ? <div className="ticket-timeline">{rows.map(row => <div className="ticket-timeline-row" key={row.id}><div className="ticket-timeline-rail"><span /><i /></div><div className="ticket-timeline-copy"><div className="step-meta"><span>{row.kind} · ticket #{row.ticket}</span><span className="mono">{row.at || "Date non exportée"}</span></div><h3>{row.title}</h3><p>{row.body}</p></div></div>)}</div> : <div className="clear-state"><Clock3 size={22} /><div><b>Aucun événement ticket capturé.</b><p>Utilisez le mode ticket courant ou tickets du voyage dans l’extension.</p></div></div>}
    </div>
  );
}

function TicketDialog({ ticket, report, onClose }: { ticket: Ticket; report: AuditReport; onClose: () => void }) {
  const explanation = explainTicket(ticket, report);
  return <div className="raw-overlay" onClick={onClose}><section className="ticket-dialog ticket-dialog-explained" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="ticket-dialog-head"><div><p className="eyebrow">Ticket #{ticket.ticketNumber} · compréhension opérationnelle</p><h2>{explanation.subject}</h2><p>{explanation.tripElement} · {ticket.current.status} · {ticket.current.priority || "Priorité non exportée"}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer le détail ticket"><X size={17} /></button></div><div className="ticket-explanation-hero"><strong>{explanation.oneLine}</strong><span>{explanation.impactLabel}</span></div><div className="ticket-detail-grid"><div><span>Situation initiale</span><b>{explanation.initialSituation}</b></div><div><span>Situation actuelle</span><b>{explanation.currentSituation}</b></div><div><span>Cause</span><b>{explanation.rootCause}</b></div><div><span>Épisode</span><b>{ticketEpisodeLabel(ticket.episode)}</b></div></div><section className="ticket-next-action"><Flag size={16} /><div><span>Ce qu’il faut faire maintenant</span><p>{explanation.nextAction ? `${explanation.nextAction.label} · ${explanation.nextAction.owner} · ${explanation.nextAction.deadline}` : "Aucune action restante détectée."}</p><small>{explanation.nextAction?.why}</small></div></section><div className="ticket-explanation-columns"><div className="ticket-dialog-section"><p className="eyebrow">Actions déjà réalisées</p>{explanation.actionsDone.length ? explanation.actionsDone.map(item => <p className="understanding-line" key={item}>{item}</p>) : <p className="empty-line">Aucune action explicitement documentée.</p>}</div><div className="ticket-dialog-section"><p className="eyebrow">Reste à faire</p>{explanation.remaining.map(item => <p className="understanding-line attention" key={item}>{item}</p>)}{explanation.missingEvidence.map(item => <small className="missing-evidence" key={item}>Preuve manquante : {item}</small>)}</div></div><div className="ticket-dialog-section"><p className="eyebrow">Chronologie du ticket</p>{explanation.chronology.length ? explanation.chronology.map(item => <article className="ticket-message" key={`${item.at}-${item.label}`}><div><b>{item.label}</b><span>{item.at}</span></div><p>{item.detail}</p></article>) : <p className="empty-line">Aucun événement structuré dans cet export.</p>}</div><div className="ticket-dialog-section"><p className="eyebrow">Preuves et pièces jointes</p>{ticket.attachments.length ? ticket.attachments.map(attachment => <div className="ticket-attachment" key={attachment.id}><Paperclip size={14} /><span>{attachment.name}</span><small>{attachment.extractionStatus || attachment.kind}</small></div>) : <p className="empty-line">Aucune pièce jointe structurée.</p>}</div></section></div>;
}

function ElitePlanPanel({ plan }: { plan: ElitePlan }) {
  const severityLabel = (severity: EliteFlag["severity"]) => severity === "blocking" ? "Bloquant" : severity === "warning" ? "À vérifier" : "Info";
  return (
    <section className="elite-plan-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Référentiel Elite · preuves → décision</p>
          <h2>Drapeaux & responsabilités</h2>
        </div>
        <span className="mono">{plan.summary.blocking} BLOQUANT{plan.summary.blocking > 1 ? "S" : ""} · {plan.summary.warning} À VÉRIFIER</span>
      </div>
      {plan.flags.length ? <div className="elite-flag-list">{plan.flags.map(flag => (
        <article className={`elite-flag elite-flag-${flag.severity}`} key={flag.id}>
          <div className="elite-flag-top"><span className="ticket-chip"><Flag size={12} />{severityLabel(flag.severity)}</span><span className="mono">{flag.responsible || "Agent Elite"}</span></div>
          <h3>{flag.label}</h3>
          <p>{flag.description}</p>
          <strong>À faire : {flag.action}</strong>
          {flag.evidence ? <small>Preuve : {flag.evidence}</small> : null}
        </article>
      ))}</div> : <div className="clear-state"><CheckCircle2 size={22} /><div><b>Aucun drapeau Elite généré.</b><p>Le paquet ne contient pas encore de règles Elite exportées.</p></div></div>}
      <div className="elite-ops-grid">
        <div className="elite-ops-card"><p className="eyebrow">Rappels attendus</p>{plan.reminderPlan.map(reminder => <div className="elite-reminder-row" key={reminder.id}><b>{reminder.label}</b><span>{reminder.owner} · {reminder.timing}{reminder.count ? ` · ${reminder.count}` : ""}</span></div>)}</div>
        <div className="elite-ops-card"><p className="eyebrow">Note Internal — OnSpot only</p><p>{plan.internalNote.required ? "À préparer pour Mayara et l’équipe opérationnelle." : "Non requise dans cet export."}</p>{plan.internalNote.placeholders.map(item => <span className="elite-placeholder" key={item}>{item}</span>)}</div>
        <div className="elite-ops-card"><p className="eyebrow">Proactivité</p><p>{plan.proactiveSuggestions.required} suggestions minimum à ajouter.</p>{plan.proactiveSuggestions.suggestions.map(item => <span className="elite-placeholder" key={item.id}>{item.type} · {item.status === "to_add" ? "à ajouter" : item.status}</span>)}</div>
      </div>
    </section>
  );
}

function EmptyImport({
  onDemo,
  onPaste,
  inputRef,
}: {
  onDemo: () => void;
  onPaste: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="import-state">
      <div className="import-intro">
        <div className="import-symbol">
          <Inbox size={28} />
        </div>
        <p className="eyebrow">Nouveau contrôle · aucun dossier chargé</p>
        <h1>
          Vérifier un dossier,
          <br />
          <em>avant le départ.</em>
        </h1>
        <p className="lead">
          Importez le JSON autonome de l’extension OnSpot Audit Assistant.
          TripCard ELITE analyse localement les données et affiche toujours la
          preuve utilisée.
        </p>
        <div className="import-actions">
          <button
            className="button button-primary"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={17} />
            Importer un fichier JSON
          </button>
          <button className="button button-secondary" onClick={onPaste}>
            <ClipboardPaste size={17} />
            Coller depuis le presse-papiers
          </button>
        </div>
        <button className="demo-link" onClick={onDemo}>
          <Sparkles size={14} />
          Ouvrir le dossier de démonstration
        </button>
      </div>
      <div className="audit-frame">
        <div className="audit-frame-head">
          <span className="mono">TRAME DE CONTRÔLE · PREUVES V3</span>
          <span className="frame-status">
            <span />
            PRÊT À IMPORTER
          </span>
        </div>
        <div className="route-motif">
          <div className="route-start" />
          <div className="route-line" />
          <div className="route-stop">
            <MapPin size={13} />
          </div>
        </div>
        <div className="frame-grid">
          <div>
            <span className="frame-number">01</span>
            <b>Dossier & voyageurs</b>
            <small>Identité · dates · notes</small>
          </div>
          <div>
            <span className="frame-number">02</span>
            <b>Segments & PNR</b>
            <small>Vols · hôtels · vouchers</small>
          </div>
          <div>
            <span className="frame-number">03</span>
            <b>Cohérence prouvée</b>
            <small>Horaires · correspondances</small>
          </div>
          <div>
            <span className="frame-number">04</span>
            <b>Actions locales</b>
            <small>UTC · fuseau destination · H-24</small>
          </div>
        </div>
        <div className="frame-footer">
          <span className="mono">SOURCE</span>
          <b>JSON EXTENSION ONSPOT</b>
          <span className="ticket-perf" />
        </div>
      </div>
    </div>
  );
}

function RecentWorkspace({
  reports,
  onOpen,
  onRemove,
  onBack,
}: {
  reports: RecentStore[];
  onOpen: (report: AuditReport) => void;
  onRemove: (reference: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="workspace-view">
      <div className="workspace-hero">
        <div>
          <p className="eyebrow">Poste de contrôle · local</p>
          <h1>Dossiers récents</h1>
          <p>
            Les derniers audits sont conservés dans ce navigateur uniquement.
            Aucun dossier n’est partagé ou synchronisé automatiquement.
          </p>
        </div>
        <button className="button button-secondary compact" onClick={onBack}>
          Retour au contrôle
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="workspace-note">
        <Archive size={17} />
        <span>
          <b>
            {reports.length} dossier{reports.length > 1 ? "s" : ""} disponible
            {reports.length > 1 ? "s" : ""} localement.
          </b>{" "}
          Ouvrez un dossier pour reprendre ses preuves, actions et rappels.
        </span>
      </div>
      {reports.length ? (
        <div className="recent-list">
          {reports.map(({ report: item, savedAt }) => (
            <article
              className="recent-card"
              key={`${item.reference}-${savedAt}`}
            >
              <div className="recent-flag">{countryFlag(item.destination)}</div>
              <div className="recent-main">
                <span className="eyebrow">
                  {item.reference} · enregistré le{" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(savedAt))}
                </span>
                <h2>{item.tripName}</h2>
                <p>
                  <MapPin size={13} />
                  {item.destination} · {formatDate(item.startDate)} →{" "}
                  {formatDate(item.endDate)}
                </p>
                <small>
                  {item.stats.passed} conforme(s) · {item.stats.warnings} à
                  vérifier · {item.stats.critical} bloquant(s)
                </small>
              </div>
              <div className="recent-actions">
                <button
                  className="button button-primary compact"
                  onClick={() => onOpen(item)}
                >
                  Ouvrir
                  <ChevronRight size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Retirer ${item.reference}`}
                  onClick={() => onRemove(item.reference)}
                >
                  <X size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="clear-state">
          <Archive size={22} />
          <div>
            <b>Aucun dossier récent sur ce navigateur.</b>
            <p>
              Importez un JSON ou ouvrez la démonstration : le dossier
              apparaîtra ici pour une reprise locale rapide.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const ruleGroups = [
  {
    title: "Dossier & voyageurs",
    rules: [
      [
        "Métadonnées",
        "Référence, Trip ID, période, destination et agence doivent être visibles.",
      ],
      [
        "Voyageurs",
        "Le nombre du bandeau doit correspondre aux noms exportés ; toute différence est à compléter.",
      ],
      [
        "Notes client",
        "Les attentions et dates utiles doivent rester accessibles à l’agent.",
      ],
    ],
  },
  {
    title: "Vols & documents",
    rules: [
      [
        "Plan de vol",
        "Billet ou plan contenant segments, horaires et marqueurs aéronautiques.",
      ],
      [
        "PNR complet",
        "Un PNR ou code de réservation est attendu pour chaque segment de vol.",
      ],
      [
        "Passeport / CNI",
        "Seulement un fichier joint vérifiable, jamais une mention dans le texte d’un voucher.",
      ],
    ],
  },
  {
    title: "Prestations & cohérence",
    rules: [
      [
        "Vouchers",
        "Hôtel, transport et activité sont rapprochés d’un justificatif de même type.",
      ],
      [
        "Chronologie",
        "Seuls les conflits prouvés de date, horaire ou transfert sont signalés.",
      ],
      [
        "Distances",
        "Aucune distance n’est affirmée sans coordonnées ou calcul d’itinéraire fiable.",
      ],
    ],
  },
  {
    title: "Rappels",
    rules: [
      ["Check-in", "Un rappel H-24 UTC pour chaque départ aérien."],
      [
        "Welcome call",
        "Un seul appel après le trajet aller : H+5 locale, ou 09:00 locale le lendemain si H+5 atteint 20:00.",
      ],
      [
        "Reconfirmation",
        "Créée uniquement quand le voucher le demande explicitement.",
      ],
    ],
  },
];
function RulesWorkspace({
  onBack,
  onOpenAudit,
}: {
  onBack: () => void;
  onOpenAudit: () => void;
}) {
  return (
    <div className="workspace-view">
      <div className="workspace-hero">
        <div>
          <p className="eyebrow">Référentiel opérationnel · règles locales</p>
          <h1>Règles de contrôle</h1>
          <p>
            Chaque règle indique l’élément attendu, la preuve acceptable et ce
            qui doit être demandé à l’agence lorsqu’une donnée manque.
          </p>
        </div>
        <button className="button button-primary compact" onClick={onOpenAudit}>
          Ouvrir le contrôle
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="rule-grid">
        {ruleGroups.map(group => (
          <section className="rule-group" key={group.title}>
            <p className="eyebrow">{group.title}</p>
            {group.rules.map(([label, detail], index) => (
              <div className="rule-row" key={label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{label}</b>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="workspace-note">
        <ShieldCheck size={17} />
        <span>
          <b>Principe de restitution :</b> « Conforme » signifie qu’une preuve a
          été lue ; « À vérifier » indique précisément la donnée manquante et
          l’action à adresser à l’agence.
        </span>
      </div>
      <button className="text-button workspace-return" onClick={onBack}>
        Retour à la vue précédente
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

export default function Home() {
  const [report, setReport] = useState<AuditReport | null>(() => {
    try {
      if (new URLSearchParams(window.location.search).has("demo"))
        return analyzeTrip(demoPayload);
      const saved = localStorage.getItem("tripcard:last-report");
      return saved ? normalizeReport(JSON.parse(saved)) : null;
    } catch {
      localStorage.removeItem("tripcard:last-report");
      return null;
    }
  });
  const [workspace, setWorkspace] = useState<Workspace>("audit");
  const [tab, setTab] = useState<Tab>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "checks" || requested === "itinerary" || requested === "actions" || requested === "documents" ? requested : "overview";
  });
  const [selectedDomain, setSelectedDomain] = useState<string>("Tout");
  const [checklistFilter, setChecklistFilter] =
    useState<ChecklistFilter>("all");
  const [reviewedChecks, setReviewedChecks] = useState<ChecklistProgress>(
    () => (report ? readProgress(report.reference) : {})
  );
  const [resolved, setResolved] = useState<string[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<FlightDetail | null>(() => {
    const requestedFlight = new URLSearchParams(window.location.search).get("flight");
    return requestedFlight && report ? report.flightDetails.find(flight => flight.flightId === requestedFlight) ?? null : null;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stepFilter, setStepFilter] = useState<StepFilter>("Tout");
  const inputRef = useRef<HTMLInputElement>(null);
  const buildCompleteDossierCopy = (nextReport: AuditReport) => ({
    trip: {
      reference: nextReport.reference,
      tripName: nextReport.tripName,
      destination: nextReport.destination,
      startDate: nextReport.startDate,
      endDate: nextReport.endDate,
      travelers: nextReport.travelers,
      itinerary: nextReport.steps,
    },
    tickets: nextReport.tickets.map(ticket => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      episode: ticket.episode,
      current: ticket.current,
      classification: ticket.classification,
      messages: ticket.messages,
      events: ticket.events,
      statusTransitions: ticket.statusTransitions,
      reminders: ticket.reminders,
      attachments: ticket.attachments,
      linkedTickets: ticket.linkedTickets,
      whatRemains: ticket.whatRemains,
      nextAction: ticket.nextAction,
    })),
    summary: {
      totalSteps: nextReport.steps.length,
      totalTickets: nextReport.tickets.length,
      resolved: nextReport.tickets.filter(ticket => ticket.episode === "resolved").length,
      pending: nextReport.tickets.filter(ticket => ["new", "active", "waiting", "reopened", "unknown"].includes(ticket.episode)).length,
    },
  });
  const copyCompleteDossier = async () => {
    if (!report) {
      toast.info("Importez d’abord un dossier.");
      return;
    }

    const payload = buildCompleteDossierCopy(report);
    const json = JSON.stringify(payload, null, 2);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = json;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      toast.success("Dossier complet copié", {
        description: `${report.steps.length} étape(s) d’itinéraire · ${report.tickets.length} ticket(s) inclus.`,
      });
    } catch {
      toast.error("Copie impossible", {
        description: "Le navigateur a bloqué l’accès au presse-papiers. Copiez le JSON manuellement.",
      });
    }
  };
  const recentReports = useMemo<RecentStore[]>(() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem("tripcard:recent-reports") ?? "[]"
      );
      return Array.isArray(parsed)
        ? parsed
            .map(item => ({
              savedAt: String(item.savedAt),
              report: normalizeReport(item.report),
            }))
            .filter((item): item is { savedAt: string; report: AuditReport } =>
              Boolean(item.report)
            )
        : [];
    } catch {
      return [];
    }
  }, [report]);
  const storeRecent = (next: AuditReport) => {
    const existing = recentReports.filter(
      item => item.report.reference !== next.reference
    );
    localStorage.setItem(
      "tripcard:recent-reports",
      JSON.stringify(
        [
          { savedAt: new Date().toISOString(), report: next },
          ...existing,
        ].slice(0, 8)
      )
    );
  };
  const loadPayload = (payload: Record<string, unknown>, source: string) => {
    const next = analyzeTrip(payload);
    setReport(next);
    setWorkspace("audit");
    setTab("overview");
    setSelectedDomain("Tout");
    setChecklistFilter("all");
    setReviewedChecks(readProgress(next.reference));
    setResolved([]);
    setSelectedFlight(null);
    localStorage.setItem("tripcard:last-report", JSON.stringify(next));
    storeRecent(next);
    toast.success(`Dossier importé · ${source}`, {
      description: `${next.stats.critical} bloquant(s), ${next.stats.warnings} point(s) à vérifier.`,
    });
  };
  const openReport = (next: AuditReport) => {
    setReport(next);
    setWorkspace("audit");
    setTab("overview");
    setSelectedDomain("Tout");
    setChecklistFilter("all");
    setReviewedChecks(readProgress(next.reference));
    setSelectedFlight(null);
    localStorage.setItem("tripcard:last-report", JSON.stringify(next));
  };
  const removeRecent = (reference: string) => {
    const remaining = recentReports.filter(
      item => item.report.reference !== reference
    );
    localStorage.setItem("tripcard:recent-reports", JSON.stringify(remaining));
    setWorkspace("audit");
    setWorkspace("recent");
  };
  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadPayload(JSON.parse(String(reader.result)), file.name);
      } catch {
        toast.error("JSON illisible", {
          description: "Le fichier ne semble pas être un JSON valide.",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };
  const handlePaste = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value) throw new Error("empty");
      loadPayload(JSON.parse(value), "presse-papiers");
    } catch {
      toast.error("Impossible de lire le presse-papiers", {
        description: "Autorisez l’accès ou utilisez l’import de fichier JSON.",
      });
    }
  };
  const toggleReview = (id: string) => {
    if (!report) return;
    setReviewedChecks(current => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(progressKey(report.reference), JSON.stringify(next));
      return next;
    });
  };
  const resetReviews = () => {
    if (!report) return;
    setReviewedChecks({});
    localStorage.removeItem(progressKey(report.reference));
    toast.info("Suivi agent réinitialisé", {
      description: "Les verdicts automatiques et les preuves ne sont pas modifiés.",
    });
  };
  const filteredSteps = useMemo(
    () =>
      report?.steps.filter(step => {
        const matchesType = stepFilter === "Tout" || step.type === stepFilter || (stepFilter === "Activité" && step.type === "Expérience");
        const matchesSearch = `${step.title} ${step.location} ${step.type}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
      }) ?? [],
    [report, searchTerm, stepFilter]
  );
  const unresolved =
    report?.issues.filter(issue => !resolved.includes(issue.id)) ?? [];
  const score = report
    ? Math.round(
        (report.stats.passed / Math.max(report.stats.checked, 1)) * 100
      )
    : 0;
  const openChecks =
    report?.checks.filter(item => item.status !== "ok").length ?? 0;
  const tripNarrative = useMemo(() => report ? buildTripNarrative(report) : null, [report]);
  const domainChecks =
    report?.checks.filter(
      item =>
        selectedDomain === "Tout" ||
        (domainMap[selectedDomain] ?? [selectedDomain]).includes(item.domain)
    ) ?? [];
  const visibleChecks = domainChecks.filter(item =>
    checklistFilter === "all"
      ? true
      : checklistFilter === "completed"
        ? reviewedChecks[item.id]
        : !reviewedChecks[item.id]
  );
  const reviewedCount =
    report?.checks.filter(item => reviewedChecks[item.id]).length ?? 0;
  const checklistPercent = report
    ? Math.round((reviewedCount / Math.max(report.checks.length, 1)) * 100)
    : 0;
  const openDomain = (domain: string) => {
    setSelectedDomain(domain);
    setChecklistFilter("all");
    setTab("checks");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={markUrl} alt="OnSpot" />
          <div>
            <span className="brand-name">TripCard</span>
            <span className="brand-tier">ELITE</span>
          </div>
        </div>
        <div className="sidebar-caption">
          ONSPOT TRAVEL SOLUTIONS
          <br />
          <span>POSTE DE CONTRÔLE · CARSON CITY</span>
        </div>
        <nav className="side-nav">
          <button
            className={`side-nav-item ${workspace === "audit" ? "active" : ""}`}
            onClick={() => setWorkspace("audit")}
          >
            <Gauge size={17} />
            Contrôle en cours
          </button>
          <button
            className={`side-nav-item ${workspace === "recent" ? "active" : ""}`}
            onClick={() => setWorkspace("recent")}
          >
            <Archive size={17} />
            Dossiers récents
            <span className="nav-count">{recentReports.length}</span>
          </button>
          <button
            className={`side-nav-item ${workspace === "rules" ? "active" : ""}`}
            onClick={() => setWorkspace("rules")}
          >
            <ShieldCheck size={17} />
            Règles de contrôle
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="connection-mark">
            <span />
            Mode local actif
          </div>
          <p>Aucune donnée n’est envoyée sans votre action explicite.</p>
          <div className="agent-chip">
            <span className="avatar">P</span>
            <span>
              <b>Patrick</b>
              <small>Agent ELITE</small>
            </span>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="top-kicker">AUDIT DE VOYAGE</span>
            <span className="top-divider">/</span>
            <span className="mono">TRIPCARD ELITE</span>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span />
              Local · gratuit
            </span>
            <button
              className="icon-button"
              onClick={() =>
                report
                  ? setShowRaw(!showRaw)
                  : toast.info("Importez d’abord un dossier.")
              }
              aria-label="Afficher le JSON"
            >
              <FileJson size={17} />
            </button>
            <button
              className="button button-secondary compact"
              onClick={copyCompleteDossier}
              disabled={!report}
            >
              <ClipboardPaste size={15} />
              Copier le dossier complet
            </button>
            <button
              className="button button-primary compact"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={15} />
              Importer
            </button>
          </div>
        </header>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFile}
        />
        {workspace === "recent" ? (
          <RecentWorkspace
            reports={recentReports}
            onOpen={openReport}
            onRemove={removeRecent}
            onBack={() => setWorkspace("audit")}
          />
        ) : workspace === "rules" ? (
          <RulesWorkspace
            onBack={() => setWorkspace("audit")}
            onOpenAudit={() => {
              setWorkspace("audit");
              setTab("checks");
              setSelectedDomain("Tout");
            }}
          />
        ) : !report ? (
          <EmptyImport
            onDemo={() => loadPayload(demoPayload, "démo locale")}
            onPaste={handlePaste}
            inputRef={inputRef}
          />
        ) : (
          <>
            <section className="trip-header">
              <div className="trip-header-top">
                <div>
                  <span className="eyebrow">
                    Dossier contrôlé · {report.reference}
                  </span>
                  <h1>{report.tripName}</h1>
                  <p className="destination">
                    <span
                      className="destination-flag"
                      role="img"
                      aria-label={`Drapeau de ${report.destination}`}
                    >
                      {countryFlag(report.destination)}
                    </span>
                    <MapPin size={15} />
                    {report.destination}
                  </p>
                </div>
                <div className="score-stamp">
                  <div className="score-number">
                    {score}
                    <small>%</small>
                  </div>
                  <div>
                    <span>Lecture locale</span>
                    <b>
                      {report.stats.critical
                        ? "Action requise"
                        : openChecks
                          ? "À vérifier"
                          : "Conforme"}
                    </b>
                  </div>
                </div>
              </div>
              <div className="trip-facts">
                <button onClick={() => openDomain("Dossier")}>
                  <span className="fact-label">Période</span>
                  <b>
                    {formatDate(report.startDate)} <i>→</i>{" "}
                    {formatDate(report.endDate)}
                  </b>
                </button>
                <button onClick={() => openDomain("Voyageurs")}>
                  <span className="fact-label">Voyageurs</span>
                  <b>
                    <Users size={14} />
                    {report.travelers.length
                      ? report.travelers.join(" · ")
                      : "À identifier"}
                  </b>
                </button>
                <button onClick={() => openDomain("Tout")}>
                  <span className="fact-label">Contrôles</span>
                  <b>
                    <span className="mini-status" />
                    {report.stats.checked} règles exécutées
                  </b>
                </button>
                <button
                  className="reset-button"
                  onClick={() => {
                    setReport(null);
                    localStorage.removeItem("tripcard:last-report");
                  }}
                >
                  <RotateCcw size={14} />
                  Nouveau dossier
                </button>
              </div>
            </section>
            <div className="content-layout">
              <section className="content-column">
                <div className="tabs" role="tablist">
                  <button
                    className={tab === "overview" ? "tab active" : "tab"}
                    onClick={() => setTab("overview")}
                  >
                    Synthèse <span>{openChecks}</span>
                  </button>
                  <button
                    className={tab === "checks" ? "tab active" : "tab"}
                    onClick={() => {
                      setTab("checks");
                      setSelectedDomain("Tout");
                    }}
                  >
                    Contrôles <span>{report.checks.length}</span>
                  </button>
                  <button
                    className={tab === "itinerary" ? "tab active" : "tab"}
                    onClick={() => setTab("itinerary")}
                  >
                    Itinéraire <span>{report.steps.length}</span>
                  </button>
                  <button
                    className={tab === "documents" ? "tab active" : "tab"}
                    onClick={() => setTab("documents")}
                  >
                    Documents <span>{report.documentChecks.length}</span>
                  </button>
                  <button
                    className={tab === "actions" ? "tab active" : "tab"}
                    onClick={() => setTab("actions")}
                  >
                    Actions <span>{unresolved.length || "·"}</span>
                  </button>
                  <button
                    className={tab === "tickets" ? "tab active" : "tab"}
                    onClick={() => setTab("tickets")}
                  >
                    Tickets <span>{report.tickets.length || "·"}</span>
                  </button>
                  <button
                    className={tab === "timeline" ? "tab active" : "tab"}
                    onClick={() => setTab("timeline")}
                  >
                    Timeline <span>{report.tickets.reduce((total, ticket) => total + ticket.messages.length + ticket.events.length + ticket.statusTransitions.length, 0) || "·"}</span>
                  </button>
                </div>
                {tab === "tickets" ? <TicketsPanel tickets={report.tickets} onOpen={setSelectedTicket} /> : null}
                {tab === "timeline" ? <TicketTimeline tickets={report.tickets} /> : null}
                {tab === "overview" ? (
                    <div className="overview-stack">
                    <div className="section-intro">
                      <div>
                        <p className="eyebrow">Lecture opérationnelle</p>
                        <h2>
                          Un constat, une preuve,
                          <br />
                          <em>une décision agent.</em>
                        </h2>
                      </div>
                      <span className="mono">MOTEUR LOCAL · RÈGLES V3</span>
                    </div>
                    {tripNarrative ? <TripUnderstandingPanel narrative={tripNarrative} /> : null}
                    <Ai360Panel report={report} />
                    <div className="domain-grid">
                      {report.domains.map(domain => (
                        <button
                          key={domain.label}
                          className="domain-card"
                          onClick={() => openDomain(domain.label)}
                        >
                          <div className="domain-top">
                            <StatusPill status={domain.status} />
                            <ChevronRight size={16} />
                          </div>
                          <h3>{domain.label}</h3>
                          <p>{domain.note}</p>
                          <span className="domain-count">
                            {domain.count} <small>contrôles</small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="control-strip">
                      <button onClick={() => openDomain("Dossier")}>
                        <span className="fact-label">Métadonnées</span>
                        <b>{report.metadata.agency}</b>
                        <small>
                          {report.reference} · {report.metadata.package}
                        </small>
                      </button>
                      <button onClick={() => openDomain("Documents")}>
                        <span className="fact-label">Identité jointe</span>
                        <b
                          className={
                            report.metadata.identityDocuments.length
                              ? ""
                              : "amber-text"
                          }
                        >
                          {report.metadata.identityDocuments.length
                            ? "Fichier(s) trouvé(s)"
                            : "Non prouvée"}
                        </b>
                        <small>
                          {report.metadata.identityDocuments.length
                            ? report.metadata.identityDocuments.join(" · ")
                            : "Mention textuelle ignorée"}
                        </small>
                      </button>
                      <button onClick={() => openDomain("Voyageurs")}>
                        <span className="fact-label">Profil client</span>
                        <b>
                          {report.metadata.profileNotes.length
                            ? "Attention signalée"
                            : "À consulter"}
                        </b>
                        <small>
                          {report.metadata.profileNotes[0] ||
                            "Aucune note exportée"}
                        </small>
                      </button>
                      <button onClick={() => setTab("actions")}>
                        <span className="fact-label">Actions</span>
                        <b>{unresolved.length} à traiter</b>
                        <small>Revérifications et rappels locaux</small>
                      </button>
                    </div>
                    <ReminderList reminders={report.reminders} />
                    <div className="attention-heading">
                      <div>
                        <p className="eyebrow">Actions finales</p>
                        <h2>
                          {unresolved.length
                            ? `${unresolved.length} point${unresolved.length > 1 ? "s" : ""} à clarifier`
                            : "Aucun point ouvert"}
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          setTab(unresolved.length ? "actions" : "checks")
                        }
                      >
                        {unresolved.length
                          ? "Voir les actions"
                          : "Voir les contrôles"}
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    {unresolved.slice(0, 3).map(issue => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        resolved={false}
                        onResolve={() =>
                          setResolved(items => [...items, issue.id])
                        }
                        onOpenProof={() => setShowRaw(true)}
                      />
                    ))}
                    {!unresolved.length ? (
                      <div className="clear-state">
                        <ShieldCheck size={22} />
                        <div>
                          <b>Aucun point ouvert dans le contrôle local.</b>
                          <p>
                            {report.stats.passed} règles sont conformes dans les
                            données disponibles ; les contrôles non exportés
                            restent explicitement signalés.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {tab === "checks" ? (
                  <div className="tab-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">
                          Checklist détaillée · preuve · action
                        </p>
                        <h2>
                          {selectedDomain === "Tout"
                            ? "Contrôles, preuves & décisions"
                            : selectedDomain}
                        </h2>
                      </div>
                      <span className="mono">
                        {visibleChecks.length} RÈGLE
                        {visibleChecks.length > 1 ? "S" : ""} AFFICHÉE
                        {visibleChecks.length > 1 ? "S" : ""}
                      </span>
                    </div>
                    <section
                      className="checklist-progress"
                      aria-label="Progression de la revue agent"
                    >
                      <div className="progress-copy">
                        <div>
                          <p className="eyebrow">Suivi manuel de l’agent</p>
                          <h3>
                            {reviewedCount} contrôle{reviewedCount > 1 ? "s" : ""} revu
                            {reviewedCount > 1 ? "s" : ""} sur {report.checks.length}
                          </h3>
                          <p>
                            La coche confirme votre revue humaine ; elle ne
                            modifie ni le verdict automatisé ni la preuve.
                          </p>
                        </div>
                        <div className="progress-value">
                          <b>{checklistPercent}</b>
                          <span>%</span>
                        </div>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={report.checks.length}
                        aria-valuenow={reviewedCount}
                        aria-valuetext={`${reviewedCount} contrôles revus sur ${report.checks.length}`}
                      >
                        <span style={{ width: `${checklistPercent}%` }} />
                      </div>
                      <div className="progress-actions">
                        <div>
                          <CheckCircle2 size={15} />
                          <span>{report.checks.length - reviewedCount} à revoir</span>
                        </div>
                        {reviewedCount ? (
                          <button
                            className="text-button compact-reset"
                            onClick={resetReviews}
                          >
                            Réinitialiser le suivi
                            <RotateCcw size={13} />
                          </button>
                        ) : (
                          <span className="mono">SAUVEGARDE LOCALE PAR DOSSIER</span>
                        )}
                      </div>
                    </section>
                    <div className="check-filter-row">
                      <button
                        className={
                          selectedDomain === "Tout"
                            ? "filter-pill active"
                            : "filter-pill"
                        }
                        onClick={() => setSelectedDomain("Tout")}
                      >
                        Tout
                      </button>
                      {report.domains.map(domain => (
                        <button
                          className={
                            selectedDomain === domain.label
                              ? "filter-pill active"
                              : "filter-pill"
                          }
                          key={domain.label}
                          onClick={() => setSelectedDomain(domain.label)}
                        >
                          {domain.label}
                        </button>
                      ))}
                      <span className="filter-separator" />
                      <button
                        className={checklistFilter === "all" ? "filter-pill active" : "filter-pill"}
                        onClick={() => setChecklistFilter("all")}
                      >
                        Tous
                      </button>
                      <button
                        className={checklistFilter === "remaining" ? "filter-pill active" : "filter-pill"}
                        onClick={() => setChecklistFilter("remaining")}
                      >
                        À revoir
                      </button>
                      <button
                        className={checklistFilter === "completed" ? "filter-pill active" : "filter-pill"}
                        onClick={() => setChecklistFilter("completed")}
                      >
                        Revu
                      </button>
                    </div>
                    <p className="checks-intro">
                      Chaque élément explique ce qui est conforme ou incomplet,
                      la preuve lue et, si nécessaire, exactement ce que l’agent
                      doit revérifier avec l’agence. La coche sert uniquement à
                      consigner votre validation opérationnelle.
                    </p>
                    <div className="check-list">
                      {visibleChecks.length ? (
                        visibleChecks.map(item => (
                          <CheckCard
                            key={item.id}
                            item={item}
                            reviewed={Boolean(reviewedChecks[item.id])}
                            onReview={() => toggleReview(item.id)}
                          />
                        ))
                      ) : (
                        <div className="clear-state">
                          <CheckCircle2 size={22} />
                          <div>
                            <b>Aucun contrôle ne correspond à ce filtre.</b>
                            <p>
                              Changez le filtre ou cochez d’autres éléments pour
                              poursuivre la revue.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                {tab === "itinerary" ? (
                  <div className="tab-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Fil du voyage</p>
                        <h2>Étapes détectées</h2>
                      </div>
                      <div className="search-field">
                        <Search size={15} />
                        <input
                          value={searchTerm}
                          onChange={event => setSearchTerm(event.target.value)}
                          placeholder="Filtrer les étapes"
                        />
                      </div>
                    </div>
                    <div className="step-filters" role="toolbar" aria-label="Filtrer par catégorie">
                      {(["Tout", "Vol", "Activité", "Hôtel", "Ferry", "Train", "Restaurant", "Location voiture", "Transfert"] as StepFilter[]).map(filter => (
                        <button key={filter} className={stepFilter === filter ? "step-filter active" : "step-filter"} onClick={() => setStepFilter(filter)} aria-pressed={stepFilter === filter}>
                          <span aria-hidden="true">{stepEmoji(filter)}</span>{filter}
                        </button>
                      ))}
                    </div>
                    <div className="timeline">
                      {filteredSteps.length ? (
                        filteredSteps.map(step => (
                          <StepRow
                            key={step.id}
                            step={step}
                            onOpenFlight={
                              step.type === "Vol"
                                ? () => setSelectedFlight(report.flightDetails.find(flight => flight.flightId === step.id) ?? null)
                                : undefined
                            }
                          />
                        ))
                      ) : (
                        <p className="empty-line">
                          Aucune étape ne correspond à cette recherche.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
                {tab === "documents" ? (
                  <div className="tab-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Pièces jointes du dossier</p>
                        <h2>Documents & vouchers</h2>
                      </div>
                      <span className="mono">LECTURE STRUCTURELLE</span>
                    </div>
                    <div className="document-panel">
                      <div className="document-visual">
                        <Paperclip size={24} />
                        <span>VOUCHERS</span>
                      </div>
                      <div>
                        <h3>Contrôle des pièces du dossier</h3>
                        <p>
                          Un fichier n’est accepté que lorsqu’il porte les
                          marqueurs attendus. Les mentions de passeport dans un
                          voucher hôtel ne constituent jamais une preuve de
                          pièce d’identité jointe.
                        </p>
                        <div className="document-check-list">
                          {report.documentChecks.map(item => (
                            <div className="document-check-row" key={item.id}>
                              <div>
                                <b>{item.label}</b>
                                <small>{item.evidence}</small>
                              </div>
                              <DocumentStatus status={item.status} />
                            </div>
                          ))}
                        </div>
                        <div className="document-meta">
                          <span>
                            <FileJson size={14} />
                            {report.documentChecks.length} familles contrôlées
                          </span>
                          <span>
                            <Check size={14} />
                            Preuves locales
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {tab === "actions" ? (
                  <div className="tab-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Registre des décisions</p>
                        <h2>Actions à traiter</h2>
                      </div>
                      <span className="mono">
                        {report.issues.length} SIGNALÉES · {resolved.length}{" "}
                        TRAITÉES
                      </span>
                    </div>
                    <ElitePlanPanel plan={report.elite} />
                    <div className="issues-list">
                      {report.issues.length ? (
                        report.issues.map(issue => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            resolved={resolved.includes(issue.id)}
                            onResolve={() =>
                              setResolved(items =>
                                items.includes(issue.id)
                                  ? items.filter(id => id !== issue.id)
                                  : [...items, issue.id]
                              )
                            }
                            onOpenProof={() => setShowRaw(true)}
                          />
                        ))
                      ) : (
                        <div className="clear-state">
                          <ShieldCheck size={22} />
                          <div>
                            <b>
                              Aucune action déclenchée par les règles locales.
                            </b>
                            <p>
                              Consultez l’onglet Contrôles pour lire les
                              vérifications conformes et non applicables.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
              <aside className="right-rail">
                <div className="rail-card">
                  <div className="rail-card-head">
                    <span className="eyebrow">État du contrôle</span>
                    <StatusPill
                      status={
                        report.stats.critical
                          ? "critical"
                          : openChecks
                            ? "warning"
                            : "ok"
                      }
                    />
                  </div>
                  <div
                    className="progress-ring"
                    style={{ "--score": score } as React.CSSProperties}
                  >
                    <div>
                      <b>{score}</b>
                      <span>/ 100</span>
                    </div>
                  </div>
                  <p className="rail-note">
                    Indicateur de complétude des preuves exportées. Il n’efface
                    aucune vérification métier.
                  </p>
                  <div className="rail-stat">
                    <span>Conformes</span>
                    <b>{report.stats.passed}</b>
                  </div>
                  <div className="rail-stat">
                    <span>À vérifier</span>
                    <b className="amber-text">{report.stats.warnings}</b>
                  </div>
                  <div className="rail-stat">
                    <span>Bloquants</span>
                    <b className="red-text">{report.stats.critical}</b>
                  </div>
                </div>
                <div className="rail-card next-action">
                  <p className="eyebrow">Prochaine action</p>
                  <h3>
                    {report.stats.critical
                      ? "Traiter les blocages avant la suite."
                      : openChecks
                        ? "Documenter les éléments restants."
                        : "Poursuivre avec les rappels locaux."}
                  </h3>
                  <p>
                    Les actions indiquent la demande précise à formuler à
                    l’agence ou la donnée à vérifier dans OnSpot.
                  </p>
                  <button
                    className="button button-secondary full"
                    onClick={() =>
                      setTab(unresolved.length ? "actions" : "checks")
                    }
                  >
                    {unresolved.length
                      ? "Ouvrir les actions"
                      : "Voir les contrôles"}
                    <ChevronRight size={15} />
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      {showRaw && report ? (
        <div className="raw-overlay" onClick={() => setShowRaw(false)}>
          <div
            className="raw-dialog"
            onClick={event => event.stopPropagation()}
          >
            <div className="raw-head">
              <div>
                <p className="eyebrow">Source importée</p>
                <h2>JSON du dossier</h2>
              </div>
              <button className="icon-button" onClick={() => setShowRaw(false)}>
                <X size={17} />
              </button>
            </div>
            <pre>{JSON.stringify(report.raw, null, 2)}</pre>
          </div>
        </div>
      ) : null}
      {selectedTicket && report ? <TicketDialog ticket={selectedTicket} report={report} onClose={() => setSelectedTicket(null)} /> : null}
      {selectedFlight ? (
        <FlightDetailDialog
          flight={selectedFlight}
          onClose={() => setSelectedFlight(null)}
        />
      ) : null}
    </div>
  );
}
