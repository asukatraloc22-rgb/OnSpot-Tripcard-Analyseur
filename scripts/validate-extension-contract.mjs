import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, "extension/manifest.json"), "utf8"));
const popup = await readFile(join(root, "extension/popup.js"), "utf8");
const fixture = JSON.parse(await readFile(join(root, "test/fixtures/ticket-100574-living-dossier.json"), "utf8"));

const requiredScopes = ["trip_only", "current_ticket", "trip_and_active_tickets", "selected_tickets", "all_trip_tickets", "section_tickets"];
const requiredEliteKeys = ["flags", "reminderPlan", "internalNote", "proactiveSuggestions", "responsibilities"];
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(manifest.manifest_version === 3, "Le manifeste doit rester en Manifest V3.");
assert(manifest.version === "2.2.0", "La version du manifeste doit être 2.2.0.");
for (const scope of requiredScopes) assert(popup.includes(scope), `Le périmètre ${scope} n’est pas présent dans popup.js.`);
for (const key of requiredEliteKeys) assert(popup.includes(key), `Le champ Elite ${key} n’est pas présent dans popup.js.`);
assert(popup.includes("visibleOnly: true"), "Le paquet doit déclarer que la collecte est limitée aux éléments visibles.");
assert(fixture.schemaVersion === "3.1.0", "Le fixture doit utiliser le contrat v3.1.0.");
assert(Array.isArray(fixture.tickets) && fixture.tickets.length === 1, "Le fixture doit contenir un ticket.");
assert(fixture.tickets[0]?.statusTransitions?.length === 2, "Le ticket de fixture doit conserver les deux transitions de statut.");
assert(requiredEliteKeys.every(key => fixture.elite && key in fixture.elite), "Le fixture doit couvrir le plan Elite complet.");

if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join("\n"));
  process.exit(1);
}
console.log(`Extension contract valid: ${requiredScopes.length} scopes · ${requiredEliteKeys.length} Elite sections · fixture ticket OK`);
