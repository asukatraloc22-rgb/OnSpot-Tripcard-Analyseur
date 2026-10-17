// Usage : node scripts/compact-smoke.mjs <export-extension.json> [sortie.md]
// Rejoue la compaction sur un export JSON existant (schéma 3.1.0) et affiche le gain.
import { readFile, writeFile } from "node:fs/promises";
import { buildCompactDossier } from "../extension/compact.js";

const [input, output] = process.argv.slice(2);
if (!input) { console.error("Usage : node scripts/compact-smoke.mjs <export.json> [sortie.md]"); process.exit(1); }
const exported = JSON.parse(await readFile(input, "utf8"));
const parts = String(exported.vouchersSummary || "").split(/\n-{20,}\n/);
let initialSnapshot = "";
const pdfTexts = [], docxTexts = [], xlsxTexts = [];
for (const part of parts) {
  const [header, url, ...rest] = part.trim().split("\n");
  if (/^### BANDEAU/.test(header)) initialSnapshot = [url, ...rest].join("\n");
  else if (/^### VOUCHER (PDF|DOCX|XLSX)/.test(header)) {
    const target = header.includes("DOCX") ? docxTexts : header.includes("XLSX") ? xlsxTexts : pdfTexts;
    target.push({ url, text: rest.join("\n").trim() });
  }
}
const itinerary = Object.fromEntries(Object.entries(exported.itinerary || {}).filter(([key]) => key !== "tous" || !initialSnapshot || exported.itinerary.tous !== initialSnapshot));
const { text, stats } = buildCompactDossier({ pageData: { initialSnapshot, itinerary, pageUrl: exported.pageUrl, pageTitle: exported.pageTitle, tickets: exported.tickets }, pdfTexts, docxTexts, xlsxTexts, version: "smoke" });
if (output) await writeFile(output, text);
const before = JSON.stringify(exported).length;
console.log(JSON.stringify({ ...stats, exportJsonChars: before, exportJsonTokens: Math.round(before / 3.6), reduction: `${Math.round((1 - text.length / before) * 100)} %` }, null, 2));
