import { describe, it, expect } from "vitest";
import { analyzeTrip } from "./audit";

describe("Tests du moteur d'audit déterministe", () => {
  it("exécute l'audit sans planter sur un dossier minimal", () => {
    const dummyPayload = {
      services: [],
      documents: [],
      travelers: []
    };
    const report = analyzeTrip(dummyPayload as any);
    expect(report).toBeDefined();
    expect(report.checks).toBeInstanceOf(Array);
  });

  it("signale une prestation située hors de la période globale", () => {
    const report = analyzeTrip({
      meta: { reference: "TEST-OUT", startDate: "2026-09-10", endDate: "2026-09-12" },
      travelers: ["Test Voyageur"],
      services: [{ type: "activity", title: "Activité hors période", date: "2026-09-14", location: "Rome" }],
      documents: [],
    });
    expect(report.checks).toContainEqual(expect.objectContaining({ id: "service-period", status: "critical" }));
    expect(report.issues).toContainEqual(expect.objectContaining({ id: "service-period", severity: "critical" }));
  });

  it("signale une arrivée de vol antérieure au départ", () => {
    const report = analyzeTrip({
      meta: { reference: "TEST-FLIGHT", startDate: "2026-09-10", endDate: "2026-09-12" },
      travelers: ["Test Voyageur"],
      services: [{ type: "flight", title: "AF 1234", date: "2026-09-10", time: "18:00", arrivalDate: "2026-09-10", arrivalTime: "09:00", location: "CDG → FCO" }],
      documents: [],
    });
    expect(report.checks).toContainEqual(expect.objectContaining({ id: "flight-duration", status: "critical" }));
  });
});
