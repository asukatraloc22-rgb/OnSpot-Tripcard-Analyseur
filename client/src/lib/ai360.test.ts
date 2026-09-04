import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeTrip, demoPayload } from "./audit";
import { buildAiEvidencePack, runAi360Analysis } from "./ai360";

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


describe("résilience de l’appel OpenRouter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("réessaie les 503 sans exposer le JSON technique", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand." } }), { status: 503, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const report = analyzeTrip(demoPayload);

    await expect(runAi360Analysis(report, { apiKey: "key-test", model: "openai/gpt-4o-mini", retryBaseDelayMs: 0, maxRetriesPerAttempt: 1 })).rejects.toMatchObject({ kind: "overloaded" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("openrouter.ai");
    try {
      await runAi360Analysis(report, { apiKey: "key-test", model: "openai/gpt-4o-mini", retryBaseDelayMs: 0, maxRetriesPerAttempt: 0 });
    } catch (error) {
      expect((error as Error).message).not.toContain("{ error:");
      expect((error as Error).message).toContain("indisponible");
    }
  });

  it("ne réessaie pas une clé refusée comme si le service était saturé", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 403, message: "API key not valid" } }), { status: 403, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const report = analyzeTrip(demoPayload);

    await expect(runAi360Analysis(report, { apiKey: "bad-key", retryBaseDelayMs: 0, maxRetriesPerAttempt: 2 })).rejects.toMatchObject({ kind: "invalid-key" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

