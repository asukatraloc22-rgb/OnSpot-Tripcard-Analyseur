import { describe, expect, it } from "vitest";
import realPayload from "../../../examples/onspot-real-sample.json";
import { normalizeTripPayload } from "./tripcard";
import { auditCounts, runLocalAudit } from "./tripAudit";
import { buildReminders } from "./reminders";

describe("contrôle conformité et rappels", () => {
  it("produit des constats structurés et des rappels opérationnels", () => {
    const document = normalizeTripPayload(realPayload);
    const findings = runLocalAudit(document);
    const counts = auditCounts(findings);
    const reminders = buildReminders(document);
    expect(findings.length).toBeGreaterThan(0);
    expect(counts.red + counts.orange + counts.green).toBe(findings.length);
    expect(reminders.some(reminder => reminder.kind === "welcome-call")).toBe(true);
    expect(document.itinerary.every(item => item.displayTitle.length > 0 && item.category.length > 0)).toBe(true);
  });
});
