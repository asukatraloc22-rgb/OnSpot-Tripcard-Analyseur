import fs from "node:fs";
import { analyzeTrip } from "../client/src/lib/audit.ts";
const raw = JSON.parse(fs.readFileSync("/home/ubuntu/upload/pasted_content_2.txt", "utf8"));
const report = analyzeTrip(raw);
const tous = raw.itinerary?.tous ?? "";
const byType = Object.fromEntries(Object.entries(Object.groupBy(report.steps, (step) => step.type)).map(([type, steps]) => [type, steps.length]));
console.log(JSON.stringify({ rawSectionCounts: { activities: (tous.match(/Activités/g) ?? []).length, trains: (tous.match(/Trains/g) ?? []).length, dateActivityHeaders: (tous.match(/\d{1,2}\s+sept\.\s+Activités/g) ?? []).length }, reference: report.reference, destination: report.destination, dates: [report.startDate, report.endDate], travelers: report.travelers, byType, identityDocumentMatches: report.metadata.identityDocuments.length, profileNoteMatches: report.metadata.profileNotes.length, reminders: report.reminders.length, stepPreview: report.steps.slice(0, 20).map((step) => `${step.type}:${step.date}:${step.title}`), issues: report.issues.map((issue) => issue.id) }, null, 2));
