import { describe, expect, it } from "vitest";
import { normalizeTripPayload } from "./tripcard";
import realPayload from "../../../examples/onspot-real-sample.json";

describe("normalisation du JSON OnSpot réel", () => {
  it("remplit les métadonnées et projette les services par journée", () => {
    expect(Array.isArray((realPayload as any).services)).toBe(true);
    const document = normalizeTripPayload(realPayload);
    expect(document.meta.reference).toBe("Trip 426700 - CAHEN");
    expect(document.meta.agency).toContain("Les Maisons du Voyage Asie");
    expect(document.meta.tripId).toContain("trip_01kvsywdcwe8sbrdc47rse5npj");
    expect(document.meta.travelers).toHaveLength(2);
    expect(document.meta.profileNotes).toContain("Exigeant");
    expect(document.itinerary.length).toBeGreaterThan(30);
    expect(document.vouchers.length).toBeGreaterThan(0);
    expect(document.tickets).toHaveLength(1);
    expect(document.days.length).toBeGreaterThan(10);
    expect(document.days.some(day => day.night?.type === "Hôtel")).toBe(true);
    expect(document.days.some(day => day.transport.length > 0)).toBe(true);
  });

  it("importe le format compact de TripCard sans inventer les prestations absentes", () => {
    const document = normalizeTripPayload({
      tripId: "2120026537",
      internalId: "trip_01m0ce69cmergbb82jkp9mbpwz",
      country: "Italie",
      dates: { start: "19 sept.", end: "25 sept." },
      agency: "Finest Journeys",
      package: "Elite",
      travelers: [{ name: "M. Allen Karp", vip: true }, { name: "Mme Susan Karp", vip: true }],
      notes: "International flights not booked by Finest Journeys...",
      vouchers: [{ name: "Milan Guided Tour.pdf", size: "230 KB" }],
      services: { preTripReconfirmation: true, eSIM: "0/2", roadbook: "Non commandé" },
    });
    expect(document.meta.reference).toBe("Trip 2120026537");
    expect(document.meta.destination).toBe("Italie");
    expect(document.meta.startDate).toMatch(/^\d{4}-09-19$/);
    expect(document.meta.endDate).toMatch(/^\d{4}-09-25$/);
    expect(document.meta.travelers).toHaveLength(2);
    expect(document.vouchers).toHaveLength(1);
    expect(document.itinerary).toHaveLength(0);
    expect(document.meta.profileNotes.some(note => note.includes("aucune prestation détaillée"))).toBe(true);
  });
});
