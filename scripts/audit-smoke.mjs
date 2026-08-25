import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeTrip } from "../client/src/lib/audit.ts";

const source = fs.readFileSync("/home/ubuntu/upload/pasted_content.txt", "utf8");
const report = analyzeTrip(JSON.parse(source));
assert.equal(report.reference, "T000034215");
assert.equal(report.destination, "Croatie");
assert.equal(report.startDate, "2026-09-01");
assert.equal(report.endDate, "2026-09-07");
assert.ok(report.travelers.length >= 1);
assert.ok(report.steps.some((step) => step.type === "Vol"));
assert.ok(report.steps.some((step) => step.type === "Transfert"));
assert.ok(report.issues.some((issue) => issue.id === "return-date-conflict"));
assert.ok(report.issues.some((issue) => issue.id === "country-conflict"));
console.log(JSON.stringify({ reference: report.reference, destination: report.destination, dates: [report.startDate, report.endDate], travelers: report.travelers, steps: report.steps.length, issues: report.issues.map((issue) => issue.id) }, null, 2));
