import { ChangeEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileJson, Inbox, ListChecks, MapPin, Plus, RefreshCw, Sparkles, Ticket, Upload, WandSparkles } from "lucide-react";
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
import { extractTickets, mergeTickets, ticketStats, type Ticket } from "@/lib/tickets";
import { runAi360Analysis, type Ai360Result } from "@/lib/ai360";
import { runItineraryBuild, type BuiltItinerary } from "@/lib/aiItinerary";
import { buildTripNarrative, explainTicket } from "@/lib/explanations";
import { validateTripPayload } from "@/lib/schemas/tripPayload";

const modelKey = "tripcard:openrouter-model";
const apiKey = "tripcard:openrouter-api-key";

type Tab = "overview" | "itinerary" | "reminders" | "tickets" | "actions";

function safeJson(value: string) {
  try { return { ok: true as const, value: JSON.parse(value) }; }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "JSON invalide" }; }
}

function StatusPill({ status }: { status: string }) {
  const label = status === "blocking" ? "Bloquant" : status === "attention" ? "À vérifier" : "Conforme";
  return <span className={`status-pill ${status === "blocking" ? "status-critical" : status === "attention" ? "status-warning" : "status-ok"}`}><span className="status-dot" />{label}</span>;
}

function Ai360Panel({ report }: { report: AuditReport }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("tripcard:openrouter-api-key") ?? "");
  const [model, setModel] = useState(() => localStorage.getItem("tripcard:openrouter-model") ?? "openai/gpt-4o-mini");
  const [result, setResult] = useState<Ai360Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputChars, setInputChars] = useState(0);
  const [itinerary, setItinerary] = useState<BuiltItinerary | null>(null);
  const [itineraryBusy, setItineraryBusy] = useState(false);
  const [itineraryError, setItineraryError] = useState("");
  const [itineraryChars, setItineraryChars] = useState(0);
  const run = async () => {
    setBusy(true); setError("");
    try {
      localStorage.setItem("tripcard:openrouter-api-key", apiKey.trim());
      localStorage.setItem("tripcard:openrouter-model", model.trim());
      const response = await runAi360Analysis(report, { apiKey, model });
      setResult(response.result); setInputChars(response.estimatedInputChars);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analyse IA impossible."); }
    finally { setBusy(false); }
  };
  const runItinerary = async () => {
    setItineraryBusy(true); setItineraryError("");
    try {
      localStorage.setItem("tripcard:openrouter-api-key", apiKey.trim());
      localStorage.setItem("tripcard:openrouter-model", model.trim());
      const response = await runItineraryBuild(report, { apiKey, model });
      setItinerary(response.result); setItineraryChars(response.estimatedInputChars);
    } catch (cause) { setItineraryError(cause instanceof Error ? cause.message : "Reconstruction impossible."); }
    finally { setItineraryBusy(false); }
  };
  return <section className="ai360-panel">
    <div className="panel-heading"><div><p className="eyebrow">Copilote à la demande · preuves compactes</p><h2>Analyse IA 360°</h2></div><Sparkles size={22} /></div>
    <p className="checks-intro">Les contrôles locaux passent en premier. L’IA n’est appelée que lorsque vous le demandez et reçoit un paquet condensé, pas tous les vouchers bruts.</p>
    <div className="ai360-controls"><input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Clé OpenRouter locale" aria-label="Clé OpenRouter" /><input value={model} onChange={event => setModel(event.target.value)} placeholder="openai/gpt-4o-mini" aria-label="Modèle OpenRouter" /><button className="button button-primary compact" onClick={run} disabled={busy || !apiKey.trim()}>{busy ? "Analyse en cours…" : "Analyser le dossier"}</button><button className="button button-secondary compact" onClick={runItinerary} disabled={itineraryBusy || !apiKey.trim()}>{itineraryBusy ? "Reconstruction…" : "🧭 Reconstruire l’itinéraire"}</button></div>
    {inputChars ? <p className="ai360-meta">Paquet envoyé : environ {inputChars.toLocaleString("fr-FR")} caractères · modèle {model}</p> : null}
    {error ? <div className="ai360-error">{error}</div> : null}
    {itineraryChars ? <p className="ai360-meta">Itinéraire reconstruit à partir d’environ {itineraryChars.toLocaleString("fr-FR")} caractères de données brutes.</p> : null}
    {itineraryError ? <div className="ai360-error">{itineraryError}</div> : null}
    {itinerary ? <div className="ai360-result"><h3>{itinerary.destination} · {itinerary.period}</h3>{itinerary.days.map((day, index) => <div key={index} className="ai360-verdict"><strong>{day.label}</strong><span>{day.events.length} prestation(s)</span></div>)}</div> : null}
    {result ? <div className="ai360-result">
      <div className="ai360-verdict"><strong>{result.verdict === "bloquant" ? "Bloquant" : result.verdict === "attention" ? "À surveiller" : "Situation stable"}</strong><span>Confiance {Math.round(result?.confidence ?? 0)} %</span></div>
      <p>{result.situation}</p>
      {(result?.newInconsistencies ?? []).length ? <div><h3>Nouvelles incohérences</h3><ul>{(result?.newInconsistencies ?? []).map((inc, i) => <li key={i}>⚠️ {inc}</li>)}</ul></div> : null}
      <div><h3>Actions ordonnées</h3><ul>{(result?.actions || []).map((action, i) => <li key={i}>{action}</li>)}</ul></div>
      {result?.tripNarrative ? <section className="ai360-narrative">
        <h3>{result.tripNarrative.headline}</h3>
        <p>{result.tripNarrative.overview}</p>
        {(result.tripNarrative.dayReads ?? []).map(day => <div className="ai360-day-read" key={day.dayIndex}>
          <b>{day.date}</b><span> — {day.summary}</span>
          {(day.attention ?? []).length ? <ul>{(day.attention ?? []).map(attention => <li key={attention}>{attention}</li>)}</ul> : null}
        </div>)}
      </section> : null}
      {(result?.timeline ?? []).length ? <section className="ai360-timeline">
        <h3>Chronologie</h3>
        {(result.timeline ?? []).map((item, index) => <div className="ai360-timeline-row" key={`${item.at}-${item.event}-${index}`}><b>{item.at}</b><span> · {item.branch} — {item.event} → {item.consequence}</span></div>)}
      </section> : null}
      {result?.agencyReport ? <section className="ai360-agency-report">
        <h3>Message agence proposé</h3>
        <p><b>{result.agencyReport.subject}</b></p>
        <p>{result.agencyReport.body}</p>
      </section> : null}
      {(result?.responsibilities ?? []).length ? <section className="ai360-responsibilities">
        <h3>Responsabilités</h3>
        {(result.responsibilities ?? []).map(responsibility => <div className="ai360-responsibility" key={responsibility.owner}><b>{responsibility.owner}</b><ul>{(responsibility.items ?? []).map(item => <li key={item}>{item}</li>)}</ul></div>)}
      </section> : null}
    </div> : null}
  </section>;
}

function EmptyState({ onDemo, onFile }: { onDemo: () => void; onFile: () => void }) {
  return <main className="main-area"><div className="topbar"><span className="top-kicker">AUDIT DE VOYAGE / TRIPCARD ELITE</span><span className="local-badge"><span />Local · gratuit</span></div><section className="import-state"><div className="import-intro"><div className="import-symbol"><Inbox size={27} /></div><p className="eyebrow">Nouveau contrôle · aucun dossier chargé</p><h1>Vérifier un dossier,<br /><em>avant le départ.</em></h1><p className="lead">Importez le JSON autonome de l’extension OnSpot Audit Assistant. TripCard ELITE structure les métadonnées, les prestations, les vouchers et les tickets sans imposer un format unique.</p><div className="import-actions"><button className="button button-primary" onClick={onFile}><Upload size={15} />Importer un fichier JSON</button><button className="button button-secondary" onClick={onDemo}><WandSparkles size={15} />Charger une démo</button></div></div><div className="audit-frame"><div className="audit-frame-head"><span className="eyebrow">TRAME DE CONTRÔLE · JSON EXTENSION</span><span className="frame-status"><span />PRÊT À IMPORTER</span></div><div className="route-motif"><span className="route-start">1</span><span className="route-line" /><span className="route-stop">✓</span></div><div className="frame-grid"><div><span className="frame-number">01</span><b>Métadonnées</b><small>Voyageurs · agence · dates</small></div><div><span className="frame-number">02</span><b>Prestations</b><small>Vols · hôtels · activités</small></div><div><span className="frame-number">03</span><b>Vouchers</b><small>Documents · extraits</small></div><div><span className="frame-number">04</span><b>Tickets</b><small>Suivi · messages · statut</small></div></div><div className="frame-footer"><b>SOURCE JSON ON SPOT</b><span className="ticket-perf" /></div></div><div className="import-side-note"><div className="note-rule" /><span>DIRECT</span><p>Un dossier, une lecture, des actions vérifiables.</p></div></section></main>;
}

function Metadata({ document }: { document: TripDocument }) {
  const meta = document.meta;
  const travelerNames = meta.travelers.map(t => t.name || t.fullName || t.firstName).filter(Boolean).join(" · ") || "Voyageurs non renseignés";
  return <section className="trip-header"><div className="trip-header-top"><div><p className="eyebrow">Dossier contrôlé</p><h1>{meta.reference}</h1><p className="destination traveler-dominant"><strong>{travelerNames}</strong></p><p className="destination destination-secondary"><span className={`destination-flag ${countryFlag(meta.destination)}`} role="img" aria-label={`Drapeau de ${meta.destination}`} /><MapPin size={14} />{meta.destination} · {meta.packageName} · {meta.agency}</p></div><div className="score-stamp"><span className="score-number">{document.itinerary.length + document.vouchers.length}<small> éléments</small></span><div><span>Lecture JSON</span><b>{document.tickets.length} ticket(s)</b></div></div></div><div className="trip-facts"><div><span className="fact-label">Période</span><b>{formatDateFr(meta.startDate)} → {formatDateFr(meta.endDate)}</b></div><div><span className="fact-label">Voyageurs</span><b>{meta.travelers.length || "—"} · {travelerNames}</b></div><div><span className="fact-label">Référence</span><b>{meta.reference}</b></div><button className="reset-button" onClick={() => window.location.reload()}><RefreshCw size={13} />Nouveau dossier</button></div></section>;
}

function ItineraryView({ itinerary }: { itinerary: BuiltItinerary | null }) {
  const [filter, setFilter] = useState("Tous");
  if (!itinerary) return <div className="empty-panel"><MapPin size={24} /><b>Itinéraire non construit</b><span>Lance le premier appel OpenRouter pour obtenir la chronologie de référence.</span></div>;
  const filters = ["Tous", "Vol", "Hôtel", "Activité", "Transfert", "Train", "Location voiture", "Ferry / bateau"];
  const days = Array.isArray(itinerary.days) ? itinerary.days : []; const undated = Array.isArray(itinerary.undated) ? itinerary.undated : [];
  return <div className="roadmap"><div className="roadmap-filters">{filters.map(value => <button key={value} className={`step-filter ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{value}</button>)}</div>{days.map((day, index) => { const events = (Array.isArray(day.events) ? day.events : []).filter(event => filter === "Tous" || event.type === filter); return <article className="roadmap-day" key={`${day.date || "sans-date"}-${index}`}><div className="roadmap-date"><span>{String(index + 1).padStart(2, "0")}</span><div><b>{day.label || `Jour ${index + 1}`}{day.city ? ` — ${day.city}` : ""}</b><small>{formatDateFr(day.date)}</small></div></div><div className="roadmap-rail">{day.night ? <div className="roadmap-node"><span>🏨</span><div><strong>{day.night.title || "Hébergement (à vérifier)"}</strong><small>{day.night.location || "Lieu à vérifier"} · Nuit · Hôtel</small></div></div> : null}{events.map((event, eventIndex) => <div className="roadmap-node" key={`${event.title || "prestation"}-${eventIndex}`}><span>{typeIcon(event.type)}</span><div><strong>{event.time ? `${event.time} · ` : ""}{event.title || "Prestation sans titre"}</strong><small>{[event.subtitle, event.category || event.type, event.location, event.departure && `Départ : ${event.departure}`, event.arrival && `Arrivée : ${event.arrival}`, event.reference, event.notes].filter(Boolean).join(" · ")}</small></div></div>)}{!events.length && !day.night ? <div className="roadmap-node roadmap-empty"><span>⚠️</span><div><strong>{filter === "Tous" ? "Prestations non extraites pour cette date" : `Aucune prestation de type « ${filter} » ce jour`}</strong><small>{filter === "Tous" ? "Vérifier la capture DOM de l’onglet Itinéraire et comparer les vouchers / roadbook" : "Utilisez « Tous » pour voir les autres prestations de la journée"}</small></div></div> : null}</div></article>})}{undated.length ? <article className="roadmap-day"><div className="roadmap-date"><span>?</span><div><b>Éléments sans date</b><small>À rattacher</small></div></div>{undated.map((item, index) => <div className="roadmap-node" key={`${item.title || "sans-titre"}-${index}`}><span>{typeIcon(item.type)}</span><div><strong>{item.title || "Prestation sans titre"}</strong><small>{item.type || "Autre"} · {item.notes || "(à vérifier)"}</small></div></div>)}</article> : null}</div>;
}

function TicketView({ tickets, onAdd }: { tickets: TicketItem[]; onAdd: (ticket: TicketItem) => void }) {
  const [subject, setSubject] = useState(""); const [summary, setSummary] = useState("");
  const add = () => { if (!subject.trim()) return; onAdd({ id: `manual-${Date.now()}`, number: `LOCAL-${tickets.length + 1}`, status: "À traiter", priority: "Normal", subject, category: "Suivi opérateur", summary: summary || "Ticket ajouté manuellement.", messages: [], events: [], reminders: [], attachments: [], raw: { manual: true } }); setSubject(""); setSummary(""); toast.success("Ticket ajouté au récapitulatif"); };
  return <><div className="ticket-compose"><div><span className="fact-label">Ajouter au fur et à mesure</span><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du ticket" /></div><div><span className="fact-label">Résumé</span><input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Dernière action ou réponse" /></div><button className="button button-primary compact" onClick={add}><Plus size={14} />Ajouter</button></div><div className="ticket-list">{tickets.length ? tickets.map(ticket => <article className="ticket-card" key={ticket.id}><div className="ticket-card-top"><div><span className="eyebrow">Ticket {ticket.number}</span><h3>{ticket.subject}</h3></div><StatusPill status={ticket.status.toLowerCase().includes("résolu") || ticket.status.toLowerCase().includes("closed") ? "stable" : "attention"} /></div><div className="ticket-card-facts"><span className="ticket-chip"><Ticket size={11} />{ticket.category}</span><span className="ticket-chip">Priorité · {ticket.priority}</span><span className="ticket-chip">{ticket.messages.length} message(s)</span></div><p className="ticket-card-summary">{ticket.summary}</p></article>) : <div className="empty-panel"><Ticket size={24} /><b>Aucun ticket dans le JSON</b><span>Tu peux en ajouter un manuellement pendant le traitement.</span></div>}</div></>;
}

function ActionsView({ audit, document, findings }: { audit: Audit360 | null; document: TripDocument; findings: LocalFinding[] }) {
  const counts = auditCounts(findings); const aiItems = [...(audit?.redItems || []).map(item => ({ ...item, severity: "red" })), ...(audit?.orangeItems || []).map(item => ({ ...item, severity: "orange" })), ...(audit?.greenChecks || []).map(item => ({ ...item, severity: "green" }))]; const all = [...findings, ...aiItems]; const renderGroup = (severity: string, label: string, color: string) => { const items = all.filter(item => item.severity === severity); return <section className={`compliance-group compliance-${color}`}><div className="panel-heading"><div><p className="eyebrow">{label}</p><h2>{items.length} contrôle(s)</h2></div><span className="compliance-count">{items.length}</span></div>{items.map((item, index) => <article className="compliance-card" key={`${item.code}-${index}`}><strong>{item.title}</strong><p>{item.detail}</p>{item.action ? <p><b>Action :</b> {item.action}</p> : null}<small>{item.evidence || "Preuve à rechercher"}{item.owner ? ` · Responsable : ${item.owner}` : ""}{item.proofRequired ? ` · Preuve : ${item.proofRequired}` : ""}</small></article>)}</section>; };
  return <div className="actions-stack"><div className="action-summary"><div><span className="eyebrow">Décision conformité 360°</span><h2>{audit?.globalDecision === "NO_GO" ? "NO GO — corriger avant départ." : audit?.globalDecision === "GO_WITH_CHECKS" ? "GO WITH CHECKS — actions à traiter." : audit ? "GO — contrôles conformes." : "Lancer le contrôle de conformité."}</h2></div>{audit ? <><StatusPill status={audit.status} /><span className="confidence">Confiance {Math.round(audit.confidence)} %</span></> : null}</div><div className="compliance-counts"><div className="count-red">Rouge <b>{audit ? audit.redItems.length : counts.red}</b></div><div className="count-orange">Orange <b>{audit ? audit.orangeItems.length : counts.orange}</b></div><div className="count-green">Vert <b>{audit ? audit.greenChecks.length : counts.green}</b></div></div>{audit?.summary ? <div className="workspace-note"><AlertTriangle size={17} /><div><b>Conclusion du contrôle</b><br />{audit.summary}</div></div> : null}{renderGroup("red", "Rouge critique", "red")}{renderGroup("orange", "Orange — à traiter", "orange")}{renderGroup("green", "Vert — contrôlé", "green")}{audit?.crossSourceComparisons?.length ? <section className="comparison-panel"><p className="eyebrow">Vouchers · roadbook · itinéraire</p><h2>Comparaison des sources</h2>{audit.crossSourceComparisons.map((item, index) => <div className="comparison-row" key={`${item.title}-${index}`}><b>{item.title}</b><span>Itinéraire : {item.itineraryValue || "—"} · Voucher : {item.voucherValue || "—"} · Roadbook : {item.roadbookValue || "—"}</span><small>{item.result} · {item.action}</small></div>)}</section> : null}</div>;
}

export default function Home() {
  const [document, setDocument] = useState<TripDocument | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [jsonInput, setJsonInput] = useState("");
  const [voucherSummary, setVoucherSummary] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [itinerary, setItinerary] = useState<BuiltItinerary | null>(null);
  const [audit, setAudit] = useState<Audit360 | null>(null);
  const [busy, setBusy] = useState<"import" | "itinerary" | "audit" | "">("");
  const [api, setApi] = useState(() => localStorage.getItem(apiKey) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(modelKey) ?? "openai/gpt-4o-mini");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [findings, setFindings] = useState<LocalFinding[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => document ? buildTripSummary(document) : "", [document]);
  const loadRaw = (raw: unknown) => { const normalized = normalizeTripPayload(raw); setDocument(normalized); setTickets(normalized.tickets); setFindings(runLocalAudit(normalized)); setReminders(buildReminders(normalized)); setVoucherSummary(buildVoucherSummary(normalized.vouchers)); setJsonInput(normalized.rawText); setItinerary(null); setAudit(null); setTab("overview"); toast.success("Dossier JSON chargé", { description: `${normalized.meta.reference} · ${normalized.itinerary.length} prestation(s)` }); };
  const parseAndLoad = () => { const parsed = safeJson(jsonInput); if (!parsed.ok) { toast.error(`JSON invalide : ${parsed.message}`); return; } loadRaw(parsed.value); };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setBusy("import"); file.text().then(text => { setJsonInput(text); const parsed = safeJson(text); if (parsed.ok) loadRaw(parsed.value); else toast.error("Le fichier ne contient pas un JSON valide."); }).finally(() => setBusy("")); };
  const loadDemo = async () => { const response = await fetch("/tripcard-sample.json"); loadRaw(await response.json()); };
  const saveAi = () => { localStorage.setItem(apiKey, api.trim()); localStorage.setItem(modelKey, model.trim()); };
  const runItinerary = async () => { if (!document) return; setBusy("itinerary"); try { setItinerary(buildLocalItinerary(document)); toast.success("Chronologie extraite du dossier"); setTab("itinerary"); } catch (error) { toast.error(error instanceof Error ? error.message : "Construction impossible"); } finally { setBusy(""); } };
  const runAudit = async () => { if (!document) return; saveAi(); setBusy("audit"); try { setAudit(await audit360(api, model, document, voucherSummary, itinerary, tickets, operatorNotes, findings)); toast.success("Analyse 360° terminée"); setTab("actions"); } catch (error) { toast.error(error instanceof OpenRouterError ? error.message : "Analyse impossible"); } finally { setBusy(""); } };

  if (!document) return <div className="app-shell"><Sidebar tab={tab} setTab={setTab} document={document} /><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} /><EmptyState onDemo={loadDemo} onFile={() => fileRef.current?.click()} /><section className="json-import-drawer"><div className="panel-heading"><div><p className="eyebrow">Extension OnSpot Audit Assistant</p><h2>Coller un JSON</h2></div><FileJson size={20} /></div><textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder="Colle ici le JSON produit par l’extension…" /><div><button className="button button-primary compact" onClick={parseAndLoad}><ClipboardPaste size={14} />Charger le JSON</button></div></section></div>;

  return <div className="app-shell"><Sidebar tab={tab} setTab={setTab} document={document} /><main className="main-area"><div className="topbar"><span className="top-kicker">AUDIT DE VOYAGE / TRIPCARD ELITE</span><div className="top-actions"><span className="local-badge"><span />Mode test local</span><button className="icon-button" onClick={() => setJsonInput(document.rawText)} title="JSON source"><FileJson size={15} /></button><button className="button button-primary compact" onClick={() => fileRef.current?.click()}><Upload size={13} />Importer un autre JSON</button></div></div><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} /><Metadata document={document} /><section className="workspace-view"><div className="workspace-hero"><div><p className="eyebrow">Lecture opérationnelle · dossier vivant</p><h1>Contrôle du dossier<br /><em>avant le départ.</em></h1><p>{summary}</p></div><div className="ai-controls-inline"><label>Clé OpenRouter locale<input type="password" value={api} onChange={e => setApi(e.target.value)} placeholder="sk-or-…" /></label><label>Modèle<input value={model} onChange={e => setModel(e.target.value)} /></label></div></div><div className="tabs">{(["overview", "itinerary", "reminders", "tickets", "actions"] as Tab[]).map(value => <button key={value} className={`tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>{value === "overview" ? "Résumé" : value === "itinerary" ? "Itinéraire" : value === "reminders" ? "Reminders / vouchers" : value === "tickets" ? `Tickets · ${tickets.length}` : "Actions"}</button>)}</div>{tab === "overview" ? <div className="overview-stack"><section className="trip-understanding-panel"><div className="panel-heading"><div><p className="eyebrow">Résumé du voyage</p><h2>Ce voyage concerne…</h2></div><MapPin size={20} /></div><p className="trip-understanding-lead">{summary}</p><div className="trip-understanding-grid"><div><span className="fact-label">Prestations détectées</span><p>{document.itinerary.length} · {Array.from(new Set(document.itinerary.map(item => item.type))).join(" · ") || "À identifier"}</p></div><div><span className="fact-label">Documents / vouchers</span><p>{document.vouchers.length} document(s) disponible(s)</p></div></div></section><section className="ai360-panel"><div className="panel-heading"><div><p className="eyebrow">Extraction locale du dossier</p><h2>Construire la chronologie</h2></div><Sparkles size={20} /></div><p className="checks-intro">Les prestations déjà extraites sont regroupées localement par date, sans inventer ni reconstruire de réservation.</p><button className="button button-primary" onClick={runItinerary} disabled={busy !== ""}><WandSparkles size={15} />{busy === "itinerary" ? "Extraction en cours…" : "Construire la chronologie"}</button>{itinerary ? <p className="ai360-meta">{itinerary.days.length} jour(s) structuré(s) · {itinerary.undated.length} élément(s) sans date</p> : null}</section><section className="ai360-panel"><div className="panel-heading"><div><p className="eyebrow">Deuxième appel OpenRouter · indépendant</p><h2>Analyse du dossier 360°</h2></div><AlertTriangle size={20} /></div><textarea className="operator-note" value={operatorNotes} onChange={e => setOperatorNotes(e.target.value)} placeholder="Notes opérateur, retour agence ou particularités voyageurs…" /><p className="checks-intro">L’audit croise le JSON, les vouchers, les tickets, les notes et l’itinéraire construit s’il existe. Il produit une description, des problèmes et des actions.</p><button className="button button-primary" onClick={runAudit} disabled={busy !== "" || !api.trim()}><Sparkles size={15} />{busy === "audit" ? "Analyse en cours…" : "Lancer l’analyse 360°"}</button>{audit ? <div className="audit-inline"><StatusPill status={audit.status} /><b>{audit.summary}</b></div> : null}</section></div> : null}{tab === "itinerary" ? <div className="tab-panel"><div className="panel-heading"><div><p className="eyebrow">Itinéraire du dossier</p><h2>Chronologie construite</h2></div><button className="button button-secondary compact" onClick={runItinerary} disabled={busy !== ""}><WandSparkles size={14} />Actualiser</button></div><ItineraryView itinerary={itinerary} /></div> : null}{tab === "reminders" ? <div className="tab-panel"><div className="panel-heading"><div><p className="eyebrow">Reminders / vouchers</p><h2>Rappels opérationnels</h2></div><AlertTriangle size={20} /></div><div className="reminder-list">{reminders.length ? reminders.map(reminder => <article className={`reminder-card reminder-${reminder.severity}`} key={reminder.id}><div><strong>{reminder.title}</strong><p>{reminder.detail}</p><small>{reminder.when} · Source : {reminder.source}</small></div><span>{reminder.severity === "red" ? "ROUGE" : reminder.severity === "orange" ? "ORANGE" : "VERT"}</span></article>) : <div className="empty-panel"><CheckCircle2 size={24} /><b>Aucun rappel calculé</b><span>Les rappels seront calculés à partir des vols et vouchers.</span></div>}</div></div> : null}{tab === "tickets" ? <div className="tab-panel"><div className="panel-heading"><div><p className="eyebrow">Suivi du dossier</p><h2>Tickets et récapitulatif</h2></div><Ticket size={20} /></div><TicketView tickets={tickets} onAdd={ticket => setTickets(current => [...current, ticket])} /></div> : null}{tab === "actions" ? <div className="tab-panel"><div className="panel-heading"><div><p className="eyebrow">Décision opérateur</p><h2>Actions à faire</h2></div><button className="button button-primary compact" onClick={runAudit} disabled={busy !== "" || !api.trim()}><Sparkles size={14} />Relancer 360°</button></div>{audit?.description ? <div className="workspace-note"><CheckCircle2 size={17} /><div><b>Description du voyage</b><br />{audit.description}</div></div> : null}<ActionsView audit={audit} document={document} findings={findings} /></div> : null}</section></main></div>;
}
