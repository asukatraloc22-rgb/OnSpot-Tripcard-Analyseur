import { describe, expect, it } from "vitest";
import { analyzeTrip, demoPayload } from "./audit";
import { buildAiEvidencePack } from "./ai360";

describe("ai360 evidence pack", () => {
  it("envoie un paquet ciblé sans le raw complet", () => {
    const report = analyzeTrip(demoPayload);
    const pack = buildAiEvidencePack(report) as Record<string, unknown>;
    expect(pack).not.toHaveProperty("raw");
    expect(pack).toHaveProperty("dossier.reference", report.reference);
    expect(pack).toHaveProperty("itinerary");
    expect(pack).toHaveProperty("tickets");
    expect(JSON.stringify(pack).length).toBeLessThan(50000);
  });
});
