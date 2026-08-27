import { describe, expect, it } from "vitest";
import { mergeTickets, normalizeTicket } from "./tickets";

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
});
