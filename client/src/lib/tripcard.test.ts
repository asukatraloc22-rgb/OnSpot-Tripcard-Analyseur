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
});
