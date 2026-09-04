import { describe, expect, it } from "vitest";
import { analyzeTrip } from "./audit";
import { extractTickets, mergeTickets, normalizeTicket } from "./tickets";
import { buildTripNarrative, explainTicket } from "./explanations";

describe("living dossier tickets", () => {
  it("identifie un ticket rouvert après une résolution", () => {
    const ticket = normalizeTicket({
      id: "ticket-1",
      ticketNumber: 100574,
      current: { status: "En attente (Agence)", priority: "Urgent" },
      messages: [{ id: "message-1", text: "Coordonnées chauffeur à confirmer", author: "Agence" }],
      statusTransitions: [
        { from: "En attente (Back Office)", to: "Résolu", at: "2026-08-27T08:37:00Z" },
        { from: "Résolu", to: "En attente (Agence)", at: "2026-08-27T10:11:00Z" },
      ],
    });
    expect(ticket.episode).toBe("reopened");
    expect(ticket.whatRemains[0]).toContain("agence");
  });

  it("fusionne deux captures du même ticket sans dupliquer les messages", () => {
    const first = normalizeTicket({ id: "ticket-1", ticketNumber: 100574, current: { status: "Nouveau" }, messages: [{ id: "message-1", text: "Premier message" }] });
    const second = normalizeTicket({ id: "ticket-1", ticketNumber: 100574, current: { status: "En cours" }, messages: [{ id: "message-1", text: "Premier message" }, { id: "message-2", text: "Nouveau message" }] });
    const merged = mergeTickets([first], [second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].messages).toHaveLength(2);
    expect(merged[0].current.status).toBe("En Cours");
  });

  it("dédoublonne par numéro quand les identifiants diffèrent", () => {
    const first = normalizeTicket({ id: "internal-1", ticketNumber: "100575", current: { status: "Ouvert", subject: "PNR" } });
    const second = normalizeTicket({ id: "external-1", ticketNumber: "100575", current: { status: "En cours", subject: "PNR confirmé" } });
    const merged = mergeTickets([first], [second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].current.status).toBe("En Cours");
  });

  it("extrait les tickets imbriqués avec les statuts pending et resolved", () => {
    const raw = {
      metadata: {
        tickets: {
          items: [
            { id: "t-1", current: { status: "Pending" }, messages: [{ id: "m-1", text: "Demande d’information" }] },
            { id: "t-2", current: { status: "Resolved" }, messages: [{ id: "m-2", text: "Problème corrigé" }] },
          ],
        },
      },
      tickets: {
        results: [{ id: "t-3", current: { status: "En attente (Agence)" }, messages: [{ id: "m-3", text: "La réponse attendue de l’agence" }] }],
      },
    };
    const extracted = extractTickets(raw as Record<string, unknown>);

    expect(extracted).toHaveLength(3);
    expect(extracted.map(ticket => ticket.episode)).toEqual(expect.arrayContaining(["active", "resolved", "waiting"]));
  });

  it("ignore les tickets placeholders sans objet ni preuve utile", () => {
    const raw = {
      tickets: [
        { id: "noise-1", current: { status: "Unknown" }, messages: [] },
        { id: "real-1", ticketNumber: "1201", current: { status: "En attente (Agence)", subject: "Chauffeur arrivée" }, messages: [{ id: "m-1", text: "Merci de confirmer le chauffeur" }] },
      ],
    };

    const extracted = extractTickets(raw as Record<string, unknown>);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].id).toBe("real-1");
    expect(extracted[0].current.subject).toContain("Chauffeur");
  });

  it("conserve le plan Elite d’un export enrichi", () => {
    const report = analyzeTrip({
      schemaVersion: "3.1.0",
      source: "onspot-audit-assistant",
      reference: "TRIP-TEST",
      destination: "Lisbonne",
      startDate: "2026-09-14",
      endDate: "2026-09-23",
      travelers: ["VOYAGEUR_001"],
      services: [{ type: "transfer", title: "Transfert arrivée", location: "LIS", date: "2026-09-14", time: "12:00" }],
      documents: [],
      tickets: [],
      elite: { flags: [{ id: "provider-contact-missing", severity: "blocking", label: "Contact prestataire manquant", description: "Contact absent", action: "Demander le contact" }], reminderPlan: [], responsibilities: { agentElite: [], mayara: [], automatic: [] }, internalNote: { target: "Internal — OnSpot only", required: true, content: "", placeholders: [] }, proactiveSuggestions: { required: 2, suggestions: [] } },
    });
    expect(report.elite.flags[0]?.id).toBe("provider-contact-missing");
    expect(report.elite.summary.blocking).toBe(1);
  });
});


describe("compréhension opérationnelle", () => {
  it("produit une lecture exploitable du voyage et du ticket", () => {
    const report = analyzeTrip({
      schemaVersion: "3.1.0",
      reference: "TRIP-EXPLAIN",
      tripName: "Escapade Lisbonne",
      destination: "Lisbonne",
      startDate: "2026-09-14",
      endDate: "2026-09-23",
      travelers: ["Alice", "Bob"],
      services: [{ type: "transfer", title: "Transfert arrivée", location: "LIS", date: "2026-09-14", time: "12:00" }],
      documents: [],
      tickets: [{ id: "ticket-explain", ticketNumber: "100600", subject: "Chauffeur arrivée", status: "En attente (Agence)", category: "Transfert", messages: [{ id: "m1", text: "Merci de confirmer le numéro du chauffeur", author: "Patrick" }], statusTransitions: [] }],
    });
    const explanation = explainTicket(report.tickets[0], report);
    const narrative = buildTripNarrative(report, [explanation]);
    expect(explanation.subject).toContain("Chauffeur");
    expect(explanation.initialSituation).toContain("confirmer");
    expect(explanation.remaining.length).toBeGreaterThan(0);
    expect(narrative.overview).toContain("Lisbonne");
    expect(narrative.agencyReport.body).toContain("Retour opérationnel");
  });
});
