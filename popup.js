// =========================================================================
// OnSpot Audit Assistant — popup.js
// =========================================================================

import * as pdfjsLib from './pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.mjs';

const analyzeBtn = document.getElementById('analyzeBtn');
const copyTripCardBtn = document.getElementById('copyTripCardBtn');
const statusBox = document.getElementById('status');

let lastResult = null; // conserve le dernier résultat d'analyse pour les deux boutons

function logStatus(message, type = 'info') {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = message;
  statusBox.appendChild(line);
  statusBox.scrollTop = statusBox.scrollHeight;
}
function clearStatus() { statusBox.innerHTML = ''; }
function setLoading(btn, isLoading, label, defaultLabel) {
  analyzeBtn.disabled = isLoading;
  copyTripCardBtn.disabled = isLoading;
  if (isLoading) btn.innerHTML = `<span class="spinner"></span>${label}`;
  else btn.textContent = defaultLabel;
}

// -------------------------------------------------------------------------
// BOUTON 1 : Analyser Page + Vouchers
// -------------------------------------------------------------------------
analyzeBtn.addEventListener('click', async () => {
  clearStatus();
  setLoading(analyzeBtn, true, 'Ouverture de la page...', 'Analyser Page + Vouchers');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("Impossible de récupérer l'onglet actif.");

    logStatus('Onglet actif détecté : ' + tab.url, 'info');
    setLoading(analyzeBtn, true, 'Extraction par onglet itinéraire...', 'Analyser Page + Vouchers');

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentPerTabAndFiles,
    });

    const pageData = injectionResult.result;
    if (!pageData) throw new Error("Aucune donnée retournée depuis la page.");

    logStatus(`Contenu extrait pour ${Object.keys(pageData.itinerary).filter(k => pageData.itinerary[k]).length} onglet(s) d'itinéraire.`, 'ok');
    logStatus(`${pageData.pdfUrls.length} PDF(s), ${pageData.docxUrls.length} DOCX, ${pageData.xlsxUrls.length} XLSX, ${pageData.imageUrls.length} image(s) détecté(s).`, 'info');

    // PDF
    const pdfTexts = [];
    for (let i = 0; i < pageData.pdfUrls.length; i++) {
      setLoading(analyzeBtn, true, `PDF ${i + 1}/${pageData.pdfUrls.length}...`, 'Analyser Page + Vouchers');
      try {
        const text = await extractPdfTextFromUrl(pageData.pdfUrls[i]);
        pdfTexts.push({ url: pageData.pdfUrls[i], text });
        logStatus(`✓ PDF ${i + 1} extrait (${text.length} caractères).`, 'ok');
      } catch (err) {
        logStatus(`✗ PDF ${i + 1} échec : ${err.message}`, 'err');
        pdfTexts.push({ url: pageData.pdfUrls[i], text: '[ERREUR extraction]' });
      }
    }

    // DOCX
    const docxTexts = [];
    for (let i = 0; i < pageData.docxUrls.length; i++) {
      setLoading(analyzeBtn, true, `DOCX ${i + 1}/${pageData.docxUrls.length}...`, 'Analyser Page + Vouchers');
      try {
        const text = await extractDocxTextFromUrl(pageData.docxUrls[i]);
        docxTexts.push({ url: pageData.docxUrls[i], text });
        logStatus(`✓ DOCX ${i + 1} extrait (${text.length} caractères).`, 'ok');
      } catch (err) {
        logStatus(`✗ DOCX ${i + 1} échec : ${err.message}`, 'err');
        docxTexts.push({ url: pageData.docxUrls[i], text: '[ERREUR extraction]' });
      }
    }

    // XLSX
    const xlsxTexts = [];
    for (let i = 0; i < pageData.xlsxUrls.length; i++) {
      setLoading(analyzeBtn, true, `XLSX ${i + 1}/${pageData.xlsxUrls.length}...`, 'Analyser Page + Vouchers');
      try {
        const text = await extractXlsxTextFromUrl(pageData.xlsxUrls[i]);
        xlsxTexts.push({ url: pageData.xlsxUrls[i], text });
        logStatus(`✓ XLSX ${i + 1} extrait (${text.length} caractères).`, 'ok');
      } catch (err) {
        logStatus(`✗ XLSX ${i + 1} échec : ${err.message}`, 'err');
        xlsxTexts.push({ url: pageData.xlsxUrls[i], text: '[ERREUR extraction]' });
      }
    }

    if (pageData.imageUrls.length > 0) {
      logStatus(`⚠ Images détectées (à vérifier à l'œil) :`, 'info');
      pageData.imageUrls.forEach((u, i) => logStatus(`  [img ${i + 1}] ${u}`, 'info'));
    }

    lastResult = { pageData, pdfTexts, docxTexts, xlsxTexts };

    // Copie automatique du prompt d'audit complet
    const finalPrompt = buildAuditPrompt(lastResult);
    await navigator.clipboard.writeText(finalPrompt);
    logStatus('✅ Prompt d\'audit complet copié dans le presse-papier !', 'ok');
    logStatus(`Longueur totale du prompt : ${finalPrompt.length} caractères.`, 'info');

  } catch (err) {
    console.error(err);
    logStatus('Erreur : ' + err.message, 'err');
  } finally {
    setLoading(analyzeBtn, false, '', 'Analyser Page + Vouchers');
  }
});

// -------------------------------------------------------------------------
// BOUTON 2 : Copier pour Trip Card Elite (JSON structuré)
// -------------------------------------------------------------------------
copyTripCardBtn.addEventListener('click', async () => {
  if (!lastResult) {
    logStatus('⚠ Lance d\'abord "Analyser Page + Vouchers".', 'err');
    return;
  }
  const payload = {
    source: 'onspot-audit-assistant',
    generatedAt: new Date().toISOString(),
    pageUrl: lastResult.pageData.pageUrl,
    itinerary: lastResult.pageData.itinerary, // { hotels, vols, activites, locations, transferts, trains }
    vouchersSummary: buildVouchersSummaryText(lastResult)
  };
  await navigator.clipboard.writeText(JSON.stringify(payload));
  logStatus('✅ Données copiées au format Trip Card Elite. Va sur ta page Trip Card et clique "Coller depuis l\'extension".', 'ok');
});

// =========================================================================
// Fonction injectée dans la page active — extraction PAR ONGLET
// =========================================================================
function extractPageContentPerTabAndFiles() {
  return new Promise(async (resolve) => {
    const tabDefs = [
      { key: 'hotels',      labels: ['Hôtels', 'Hotels', 'Hôtel', 'Hotel'] },
      { key: 'vols',        labels: ['Vols', 'Vol', 'Flights', 'Flight'] },
      { key: 'activites',   labels: ['Activités', 'Activité', 'Activities', 'Activity'] },
      { key: 'locations',   labels: ['Locations', 'Location de voiture', 'Car rental', 'Cars'] },
      { key: 'transferts',  labels: ['Transferts', 'Transfert', 'Transfers', 'Transfer'] },
      { key: 'trains',      labels: ['Trains', 'Train'] }
    ];

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function findTabElement(labels) {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], li, div[class*="tab" i]'));
      for (const el of candidates) {
        const text = (el.textContent || '').trim();
        if (!text || text.length > 40) continue;
        for (const label of labels) {
          if (text.toLowerCase() === label.toLowerCase() || text.toLowerCase().startsWith(label.toLowerCase())) {
            return el;
          }
        }
      }
      return null;
    }

    const itinerary = {};
    for (const def of tabDefs) {
      const el = findTabElement(def.labels);
      if (el) {
        try {
          el.click();
          await sleep(450);
          itinerary[def.key] = (document.body.innerText || '').trim();
        } catch (e) {
          itinerary[def.key] = null;
        }
      } else {
        itinerary[def.key] = null;
      }
    }

    // Détection des fichiers par type
    const pdfUrlSet = new Set();
    const docxUrlSet = new Set();
    const xlsxUrlSet = new Set();
    const imageUrlSet = new Set();

    function classify(url) {
      if (/\.pdf($|\?)/i.test(url)) pdfUrlSet.add(url);
      else if (/\.docx($|\?)/i.test(url)) docxUrlSet.add(url);
      else if (/\.(xlsx|xls)($|\?)/i.test(url)) xlsxUrlSet.add(url);
      else if (/\.(png|jpe?g|webp|gif|heic)($|\?)/i.test(url)) imageUrlSet.add(url);
    }

    document.querySelectorAll('a[href]').forEach((a) => classify(a.href));
    document.querySelectorAll('img[src]').forEach((img) => {
      try { classify(new URL(img.src, window.location.href).href); } catch (e) {}
    });
    document.querySelectorAll('[data-url], [data-href], [data-pdf], [data-file]').forEach((el) => {
      const val = el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-pdf') || el.getAttribute('data-file');
      if (val) { try { classify(new URL(val, window.location.href).href); } catch (e) {} }
    });
    document.querySelectorAll('embed[src], iframe[src], object[data]').forEach((el) => {
      const src = el.getAttribute('src') || el.getAttribute('data');
      if (src) { try { classify(new URL(src, window.location.href).href); } catch (e) {} }
    });

    resolve({
      itinerary,
      pdfUrls: Array.from(pdfUrlSet),
      docxUrls: Array.from(docxUrlSet),
      xlsxUrls: Array.from(xlsxUrlSet),
      imageUrls: Array.from(imageUrlSet),
      pageUrl: window.location.href,
      pageTitle: document.title
    });
  });
}

// =========================================================================
// Extractions de fichiers
// =========================================================================
async function extractPdfTextFromUrl(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += `\n--- Page ${p} ---\n${content.items.map(i => i.str).join(' ')}\n`;
  }
  return fullText.trim();
}

async function extractDocxTextFromUrl(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function extractXlsxTextFromUrl(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
  let text = '';
  workbook.SheetNames.forEach((sheetName) => {
    text += `\n--- Feuille : ${sheetName} ---\n`;
    text += window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    text += '\n';
  });
  return text.trim();
}

// =========================================================================
// Construction des prompts / résumés
// =========================================================================
function buildVouchersSummaryText({ pdfTexts, docxTexts, xlsxTexts, pageData }) {
  const parts = [];
  pdfTexts.forEach((p, i) => parts.push(`### VOUCHER PDF ${i + 1}\n${p.url}\n\n${p.text}`));
  docxTexts.forEach((d, i) => parts.push(`### VOUCHER DOCX ${i + 1}\n${d.url}\n\n${d.text}`));
  xlsxTexts.forEach((x, i) => parts.push(`### VOUCHER XLSX ${i + 1}\n${x.url}\n\n${x.text}`));
  if (pageData.imageUrls.length > 0) {
    parts.push(`### IMAGES DÉTECTÉES (à vérifier manuellement)\n${pageData.imageUrls.join('\n')}`);
  }
  return parts.join('\n\n---------------------------------------------\n\n');
}

function buildAuditPrompt({ pageData, pdfTexts, docxTexts, xlsxTexts }) {
  const itinSection = Object.entries(pageData.itinerary)
    .map(([key, val]) => `### ${key.toUpperCase()}\n${val || '(vide / onglet non trouvé)'}`)
    .join('\n\n');

  const vouchersSection = buildVouchersSummaryText({ pdfTexts, docxTexts, xlsxTexts, pageData });

  return `# AUDIT DE COHÉRENCE — DOSSIER DE VOYAGE ONSPOT

Tu es un auditeur expert spécialisé dans la vérification de dossiers de voyage. Compare ligne par ligne l'ITINÉRAIRE ci-dessous avec le contenu de chaque VOUCHER, et signale la moindre incohérence.

## CONTEXTE
- Page source : ${pageData.pageUrl}
- Titre : ${pageData.pageTitle}

## POINTS DE CONTRÔLE
1. Noms des voyageurs (orthographe, nombre de personnes)
2. Dates (check-in/out, vols, activités)
3. Prestations réservées (type de chambre, catégorie de vol, transfert, activité)
4. Régimes alimentaires / allergies mentionnés sur un document mais absents d'un autre
5. Effectifs par réservation
6. Références / numéros de confirmation
7. Adresses et lieux
8. Horaires
9. Statut de paiement
10. Éléments manquants (prestation sans voucher, ou inversement)

## FORMAT DE RÉPONSE
- Tableau des incohérences (Type | Itinéraire | Voucher | Détail)
- Points critiques / Points mineurs
- Conclusion : conforme ou à corriger, avec liste des actions

---
## ITINÉRAIRE (par onglet)
${itinSection}

---
## VOUCHERS EXTRAITS
${vouchersSection || '(aucun voucher détecté)'}

---
Effectue l'audit complet maintenant.`;
}
