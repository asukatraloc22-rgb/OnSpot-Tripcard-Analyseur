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
});
