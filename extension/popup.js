// =========================================================================
// OnSpot Audit Assistant — popup.js
// =========================================================================

import * as pdfjsLib from './pdf.mjs';
import { buildCompactDossier } from './compact.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.mjs';

const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const analyzeBtn = document.getElementById('analyzeBtn');
const copyCompactBtn = document.getElementById('copyCompactBtn');
const downloadCompactBtn = document.getElementById('downloadCompactBtn');
const copyTripCardBtn = document.getElementById('copyTripCardBtn');
const downloadTripCardBtn = document.getElementById('downloadTripCardBtn');
const diagnosticBtn = document.getElementById('diagnosticBtn');
const statusBox = document.getElementById('status');
const summaryBox = document.getElementById('summary');
const captureScope = document.getElementById('captureScope');
const scopeHelp = document.getElementById('scopeHelp');
const versionTag = document.getElementById('versionTag');
const openDetailsBox = document.getElementById('openReminderDetails');
const reportOptions = document.getElementById('reportOptions');
if (versionTag) versionTag.textContent = `v${EXTENSION_VERSION}`;

const scopeLabels = {
  trip_only: 'Voyage uniquement',
  trip_and_all_tickets: 'Compte rendu : voyage + tickets + rappels'
};
const scopeHelpText = {
  trip_only: 'Fiche, voyageurs, notes, rappels, tickets visibles, itinéraire et vouchers.',
  trip_and_all_tickets: 'Lit en plus chaque ticket dans un onglet d’arrière-plan (tu restes sur la Trip Card) et tous les rappels, y compris terminés.'
};
function syncScopeUi() {
  if (scopeHelp) scopeHelp.textContent = scopeHelpText[captureScope.value] || scopeHelpText.trip_only;
  if (reportOptions) reportOptions.hidden = captureScope.value !== 'trip_and_all_tickets';
}
if (captureScope) { captureScope.addEventListener('change', syncScopeUi); syncScopeUi(); }

let lastResult = null; // dernier résultat de capture, partagé par tous les boutons d'export
let lastCompact = null;

function logStatus(message, type = 'info') {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = message;
  statusBox.appendChild(line);
  statusBox.scrollTop = statusBox.scrollHeight;
}
function clearStatus() { statusBox.innerHTML = ''; }
const exportButtons = [copyCompactBtn, downloadCompactBtn, copyTripCardBtn, downloadTripCardBtn];
function setExportsEnabled(enabled) { exportButtons.forEach(button => { if (button) button.disabled = !enabled; }); }
function setLoading(btn, isLoading, label) {
  analyzeBtn.disabled = isLoading;
  diagnosticBtn.disabled = isLoading;
  if (isLoading) setExportsEnabled(false);
  if (!btn.dataset.idle) btn.dataset.idle = btn.innerHTML;
  btn.innerHTML = isLoading ? `<span class="spinner"></span>${label}` : btn.dataset.idle;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function downloadText(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function fileSlug(value) { return String(value || 'export').replace(/[^\w-]+/g, '_'); }

function renderSummary(stats) {
  const readable = stats.vouchers - stats.unreadable.length;
  summaryBox.hidden = false;
  summaryBox.innerHTML = `
    <div class="sum-head"><b>${escapeHtml(stats.reference)}</b><span>${escapeHtml(stats.dates || 'dates non visibles')}</span></div>
    <div class="sum-grid">
      <div><span>Voyageurs</span><b>${stats.travelers.length}</b></div>
      <div><span>Vouchers lus</span><b>${readable}/${stats.vouchers}</b></div>
      <div><span>Prestations</span><b>${stats.itineraryRows || stats.itineraryTabs}</b></div>
      <div><span>Taille</span><b>≈ ${Math.round(stats.tokens / 100) / 10}k</b><small>tokens</small></div>
    </div>
    ${stats.travelers.length ? `<p class="sum-line">${stats.travelers.map(escapeHtml).join(' · ')}</p>` : ''}
    ${stats.warnings.length ? `<ul class="sum-warn">${stats.warnings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="sum-ok">Capture complète, aucune limite détectée.</p>'}`;
}

// -------------------------------------------------------------------------
// 1 · Capturer le dossier
// -------------------------------------------------------------------------
analyzeBtn.addEventListener('click', async () => {
  clearStatus();
  summaryBox.hidden = true;
  lastResult = null;
  lastCompact = null;
  setLoading(analyzeBtn, true, 'Lecture de la page…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("Impossible de récupérer l'onglet actif.");

    const scope = captureScope?.value || 'trip_only';
    logStatus(`Page : ${tab.url}`, 'info');
    logStatus(`Périmètre : ${scopeLabels[scope] || scope}`, 'info');

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentPerTabAndFiles,
      args: [scope, Boolean(openDetailsBox?.checked)],
    });

    const pageData = injectionResult.result;
    if (!pageData) throw new Error("Aucune donnée retournée depuis la page.");

    logStatus(`Onglets d'itinéraire lus : ${Object.keys(pageData.itinerary).filter(k => pageData.itinerary[k]).length}.`, 'ok');
    (pageData.tabDiagnostics || []).filter(entry => !entry.found).forEach(entry => logStatus(`  onglet « ${entry.key} » introuvable`, 'warn'));
    if (pageData.tickets?.length) logStatus(`${pageData.tickets.length} ticket(s) ouvert(s).`, 'ok');
    if (pageData.collectionWarning) logStatus(`⚠ ${pageData.collectionWarning}`, 'warn');
    logStatus(`${pageData.pdfUrls.length} PDF, ${pageData.docxUrls.length} DOCX, ${pageData.xlsxUrls.length} XLSX, ${pageData.imageUrls.length} image(s).`, 'info');

    if (scope === 'trip_and_all_tickets') {
      const reminders = pageData.structured?.reminders || [];
      logStatus(`Rappels lus : ${reminders.filter(item => !item.completed).length} à venir, ${reminders.filter(item => item.completed).length} terminé(s).`, 'ok');
      const ticketUrls = Array.from(new Set((pageData.structured?.tickets || []).map(ticket => ticket.href).filter(Boolean)));
      pageData.ticketPages = [];
      for (let i = 0; i < ticketUrls.length; i++) {
        setLoading(analyzeBtn, true, `Ticket ${i + 1}/${ticketUrls.length}…`);
        const page = await readTicketInBackground(ticketUrls[i]);
        pageData.ticketPages.push(page);
        logStatus(page.ok ? `✓ Ticket ${i + 1} lu (${page.text.length} car.)` : `✗ Ticket ${i + 1} : ${page.error}`, page.ok ? 'ok' : 'err');
      }
    }

    const pdfTexts = [];
    for (let i = 0; i < pageData.pdfUrls.length; i++) {
      setLoading(analyzeBtn, true, `PDF ${i + 1}/${pageData.pdfUrls.length}…`);
      try {
        const text = await extractPdfTextFromUrl(pageData.pdfUrls[i]);
        pdfTexts.push({ url: pageData.pdfUrls[i], text });
        logStatus(`✓ PDF ${i + 1} (${text.length} car.)`, 'ok');
      } catch (err) {
        logStatus(`✗ PDF ${i + 1} : ${err.message}`, 'err');
        pdfTexts.push({ url: pageData.pdfUrls[i], text: '[ERREUR extraction]' });
      }
    }

    const docxTexts = [];
    for (let i = 0; i < pageData.docxUrls.length; i++) {
      setLoading(analyzeBtn, true, `DOCX ${i + 1}/${pageData.docxUrls.length}…`);
      try {
        const text = await extractDocxTextFromUrl(pageData.docxUrls[i]);
        docxTexts.push({ url: pageData.docxUrls[i], text });
        logStatus(`✓ DOCX ${i + 1} (${text.length} car.)`, 'ok');
      } catch (err) {
        logStatus(`✗ DOCX ${i + 1} : ${err.message}`, 'err');
        docxTexts.push({ url: pageData.docxUrls[i], text: '[ERREUR extraction]' });
      }
    }

    const xlsxTexts = [];
    for (let i = 0; i < pageData.xlsxUrls.length; i++) {
      setLoading(analyzeBtn, true, `XLSX ${i + 1}/${pageData.xlsxUrls.length}…`);
      try {
        const text = await extractXlsxTextFromUrl(pageData.xlsxUrls[i]);
        xlsxTexts.push({ url: pageData.xlsxUrls[i], text });
        logStatus(`✓ XLSX ${i + 1} (${text.length} car.)`, 'ok');
      } catch (err) {
        logStatus(`✗ XLSX ${i + 1} : ${err.message}`, 'err');
        xlsxTexts.push({ url: pageData.xlsxUrls[i], text: '[ERREUR extraction]' });
      }
    }

    lastResult = { pageData, pdfTexts, docxTexts, xlsxTexts };
    lastCompact = buildCompactDossier({ ...lastResult, version: `v${EXTENSION_VERSION}` });
    renderSummary(lastCompact.stats);
    setExportsEnabled(true);
    logStatus(`✓ Dossier compact prêt (≈ ${lastCompact.stats.tokens} tokens, contre ≈ ${Math.round(lastCompact.stats.rawChars / 3.6)} en brut).`, 'ok');
  } catch (err) {
    console.error(err);
    logStatus('Erreur : ' + err.message, 'err');
  } finally {
    setLoading(analyzeBtn, false);
    setExportsEnabled(Boolean(lastCompact));
  }
});

// -------------------------------------------------------------------------
// Tickets : chaque ticket est ouvert dans un onglet d'arrière-plan, lu, puis fermé.
// L'onglet de l'agent ne bouge pas et aucune autre page n'est visitée.
// -------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(false); }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(true); }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function readTicketInBackground(url) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabComplete(tab.id);
    let last = null;
    // La page est une application : on attend que la conversation soit affichée (texte stable).
    for (let attempt = 0; attempt < 15; attempt++) {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readTicketPage });
      const page = result?.result;
      if (page?.loginRequired) return { url, ok: false, error: 'connexion OnSpot demandée', text: '' };
      if (page?.text && last && page.text.length === last.text.length && page.text.length > 150) return { url, ok: true, ...page };
      last = page || last;
      await sleep(700);
    }
    return last?.text ? { url, ok: true, ...last } : { url, ok: false, error: 'page vide', text: '' };
  } catch (err) {
    return { url, ok: false, error: err.message, text: '' };
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Fonction injectée dans l'onglet du ticket.
function readTicketPage() {
  if (/\/(?:login|sign-?in|auth)\b/i.test(location.pathname)) return { loginRequired: true };
  const main = document.querySelector('main#main-content, main') || document.body;
  // Déplie les messages repliés (« Afficher plus », « Voir tout »…) : simples boutons d'affichage.
  Array.from(main.querySelectorAll('button')).filter((el) => /^(?:Afficher|Voir|Show|Lire)\s+(?:plus|more|tout|all|la suite)/i.test((el.innerText || '').trim())).slice(0, 10).forEach((el) => { try { el.click(); } catch (e) {} });
  const text = (main.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { title: (document.querySelector('h1')?.innerText || document.title || '').trim(), text: text.slice(0, 15000), truncated: text.length > 15000 };
}

// -------------------------------------------------------------------------
// 2 · Exports
// -------------------------------------------------------------------------
copyCompactBtn.addEventListener('click', async () => {
  if (!lastCompact) return;
  await navigator.clipboard.writeText(lastCompact.text);
  logStatus('✅ Dossier copié. Colle-le dans ton Gem (ou ta conversation Claude).', 'ok');
});

downloadCompactBtn.addEventListener('click', () => {
  if (!lastCompact) return;
  downloadText(lastCompact.text, `dossier-${fileSlug(lastCompact.stats.reference)}-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown');
  logStatus('✓ Dossier .md téléchargé.', 'ok');
});

copyTripCardBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  const payload = buildTripCardPayload(lastResult);
  await navigator.clipboard.writeText(JSON.stringify(payload));
  logStatus('✅ JSON complet copié (web app / TripCard ELITE).', 'ok');
});

downloadTripCardBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const payload = buildTripCardPayload(lastResult);
  downloadText(JSON.stringify(payload, null, 2), `onspot-tripcard-${fileSlug(payload.reference)}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  logStatus('✓ JSON complet téléchargé.', 'ok');
});

// -------------------------------------------------------------------------
// Diagnostic : squelette de la page (balises, rôles, onglets) sans les données client,
// pour caler l'extraction sur la structure réelle d'OnSpot.
// -------------------------------------------------------------------------
diagnosticBtn.addEventListener('click', async () => {
  clearStatus();
  setLoading(diagnosticBtn, true, 'Diagnostic…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [injectionResult] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractDomSkeleton });
    const report = injectionResult.result || '';
    downloadText(`OnSpot Audit Assistant v${EXTENSION_VERSION} · diagnostic de structure\n${report}`, `diagnostic-structure-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`, 'text/plain');
    logStatus(`✓ Diagnostic téléchargé (${report.split('\n').length} lignes). Les emails, téléphones, numéros et noms de voyageurs sont masqués ; jette un œil avant de l'envoyer.`, 'ok');
  } catch (err) {
    logStatus('Erreur diagnostic : ' + err.message, 'err');
  } finally {
    setLoading(diagnosticBtn, false);
  }
});

function extractDomSkeleton() {
  return new Promise(async (resolve) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const MAX_LINES = 5000;
    // Noms des voyageurs repérés sur la page (civilité + prénom + nom) : masqués partout.
    const personWords = new Set();
    for (const match of (document.body.innerText || '').matchAll(/\b(?:M\.|Mme|Mr\.?|Mrs\.?|Ms\.?|Mlle)\s+([A-ZÀ-Ý][\wÀ-ÿ'’-]+)(?:\s+([A-ZÀ-Ý][\wÀ-ÿ'’-]+))?/g)) [match[1], match[2]].filter((word) => word && word.length > 2).forEach((word) => personWords.add(word));
    const personPattern = personWords.size ? new RegExp(`\\b(?:${Array.from(personWords).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g') : null;
    const mask = (text) => {
      let value = String(text || '')
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
        .replace(/\+?\d[\d ()./-]{6,}\d/g, '[tel]')
        .replace(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\b/g, '[ref]')
        .replace(/\b\d{4,}\b/g, '[n]');
      if (personPattern) value = value.replace(personPattern, '[voyageur]');
      return value;
    };
    const visible = (el) => { const style = getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden'; };
    // Seuls les libellés courts (titres, onglets, boutons) sont conservés ; les textes longs (messages, notes) sont résumés par leur longueur.
    const ownText = (el) => {
      const text = Array.from(el.childNodes).filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      return text.length <= 40 ? mask(text) : `[texte ${text.length} car.]`;
    };
    const describe = (el) => {
      const parts = [el.tagName.toLowerCase()];
      if (el.id) parts.push(`#${el.id}`);
      const classes = Array.from(el.classList).slice(0, 5);
      if (classes.length) parts.push(`.${classes.join('.')}`);
      const attrs = [];
      for (const attr of Array.from(el.attributes)) {
        if (/^(?:role|aria-(?:label|selected|controls|expanded|current)|data-[\w-]+|type|name)$/.test(attr.name)) attrs.push(`${attr.name}=${mask(attr.value).slice(0, 40)}`);
        if (attr.name === 'href') attrs.push(`href=${mask(attr.value.replace(/^https?:\/\/[^/]+/, '').replace(/[a-z]+_[0-9a-z]{20,}/gi, ':id')).slice(0, 60)}`);
      }
      if (attrs.length) parts.push(`[${attrs.join(' ')}]`);
      return parts.join('');
    };
    const skeleton = (root) => {
      const out = [];
      const walk = (el, depth) => {
        if (out.length >= MAX_LINES || /^(?:SCRIPT|STYLE|SVG|PATH|NOSCRIPT|TEMPLATE|LINK|META)$/i.test(el.tagName) || !visible(el)) return;
        const text = ownText(el);
        const children = Array.from(el.children);
        const interesting = text || el.id || el.getAttribute('role') || Array.from(el.attributes).some((attr) => /^(?:data-|aria-)/.test(attr.name)) || /^(?:BUTTON|A|H\d|SECTION|NAV|MAIN|ASIDE|HEADER|UL|LI|TABLE|TR|INPUT|LABEL)$/.test(el.tagName) || children.length > 1;
        if (interesting) out.push(`${'  '.repeat(Math.min(depth, 30))}${describe(el)}${text ? ` "${text}"` : ''}`);
        children.forEach((child) => walk(child, interesting ? depth + 1 : depth));
      };
      walk(root, 0);
      if (out.length >= MAX_LINES) out.push('… (tronqué)');
      return out.join('\n');
    };
    const tabCandidates = () => Array.from(document.querySelectorAll('[role="tab"], button, a, li'))
      .filter((el) => visible(el) && (el.textContent || '').trim() && (el.textContent || '').trim().length <= 30)
      .map((el) => `${describe(el)} "${mask((el.textContent || '').trim())}"`)
      .slice(0, 150);

    const sections = [];
    sections.push(`URL : ${mask(location.pathname.replace(/[a-z]+_[0-9a-z]{20,}/gi, ':id'))}`);
    sections.push(`\n===== VUE INITIALE · éléments cliquables courts =====\n${tabCandidates().join('\n')}`);
    sections.push(`\n===== VUE INITIALE · squelette =====\n${skeleton(document.body)}`);

    const findByText = (labels) => Array.from(document.querySelectorAll('[role="tab"], button, a, li, div, span'))
      .find((el) => visible(el) && labels.includes((el.textContent || '').trim().toLowerCase()));
    const itineraryTab = findByText(['itinéraire', 'itinerary']);
    if (itineraryTab) {
      try { itineraryTab.click(); await sleep(900); } catch (e) {}
      sections.push(`\n===== APRÈS CLIC « Itinéraire » · éléments cliquables courts =====\n${tabCandidates().join('\n')}`);
      sections.push(`\n===== APRÈS CLIC « Itinéraire » · squelette =====\n${skeleton(document.body)}`);
    } else sections.push('\n(onglet « Itinéraire » introuvable)');
    resolve(sections.join('\n'));
  });
}

// =========================================================================
// Fonction injectée dans la page active — extraction PAR ONGLET
// =========================================================================
function extractPageContentPerTabAndFiles(scope = 'trip_only', openReminderDetails = false) {
  return new Promise(async (resolve) => {
    const mainTabDefs = [
      { key: 'itineraireMain', labels: ['Itinéraire', 'Itinerary'] }
    ];
    const subTabDefs = [
      { key: 'tous',         labels: ['Tous', 'Tout', 'All'] },
      { key: 'hotels',       labels: ['Hôtels', 'Hotels', 'Hôtel', 'Hotel'] },
      { key: 'vols',         labels: ['Vols', 'Vol', 'Flights', 'Flight'] },
      { key: 'activites',    labels: ['Activités', 'Activité', 'Activities', 'Activity'] },
      { key: 'locations',    labels: ['Locations', 'Location de voiture', 'Car rental', 'Cars'] },
      { key: 'transferts',   labels: ['Transferts', 'Transfert', 'Transfers', 'Transfer'] },
      { key: 'trains',       labels: ['Trains', 'Train'] }
    ];
    const vouchersTabDef = { key: 'vouchersTab', labels: ['Vouchers', 'Voucher', 'Documents'] };
    const ticketsTabDef = { key: 'ticketsTab', labels: ['Tickets', 'Ticket'] };

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function findTabElement(labels) {
      const candidates = Array.from(document.querySelectorAll('[role="tab"], button, a, li, div[class*="tab" i]'));
      const normalizedLabels = labels.map(label => label.toLowerCase());
      const exact = candidates.find(el => { const text = (el.textContent || '').trim().toLowerCase(); return text && normalizedLabels.includes(text) && text.length <= 40; });
      if (exact) return exact;
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

    function panelTextForTab(tab) {
      const candidates = [];
      const controls = tab?.getAttribute?.('aria-controls');
      if (controls) { const controlled = document.getElementById(controls); if (controlled) candidates.push(controlled); }
      const active = document.querySelector('[role="tabpanel"][data-state="active"], [role="tabpanel"]:not([hidden]), [role="tabpanel"].active, [role="tabpanel"].is-active');
      if (active) candidates.push(active);
      const closest = tab?.closest?.('[data-radix-tabs-content], [data-tab-content], .tab-content, .tabs-content, [class*="tabpanel" i], [class*="tab-panel" i]');
      if (closest) candidates.push(closest);
      const unique = Array.from(new Set(candidates)).filter(element => {
        const style = window.getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden' && (element.innerText || '').trim();
      });
      const panel = unique.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
      if (panel) return (panel.innerText || '').trim();
      // OnSpot (2026) n'a pas de role=tabpanel : la liste filtrée de l'itinéraire vit dans [data-itin-scroll].
      return (document.querySelector('[data-itin-scroll]')?.innerText || '').trim();
    }

    async function clickAndReadTab(tab, fallback = '') {
      if (!tab) return null;
      try { tab.scrollIntoView({ block: 'center', inline: 'nearest' }); tab.click(); await sleep(650); } catch (e) { return fallback || null; }
      return panelTextForTab(tab) || fallback || null;
    }

    function activeTabElement() {
      return document.querySelector('[role="tab"][aria-selected="true"], [role="tab"].active, [role="tab"].is-active, button.active, button.is-active') || null;
    }

    function cleanTravelerName(value) {
      return String(value || '').replace(/\s+/g, ' ').replace(/^(?:M\.|Mr\.?|Mme|Mrs\.?|Ms\.?)\s*/i, '').trim();
    }

    function isLikelyTravelerName(value) {
      const name = cleanTravelerName(value);
      if (!name || name.length < 4 || name.length > 90 || /\d|→|->|@/.test(name)) return false;
      if (/\b(?:call|rappel|reminder|compte rendu|boarding|welcome|goodbye|good bye|here for you|haute valeur|completed)\b/i.test(name)) return false;
      if (/(?:hotel|hôtel|palazzo|resort|lodge|camp|villa|plains|safari|dunes|spitzkoppen|etosha|mushara|umkumbe|kwessi|dar\s+amane|driver|chauffeur|private|luxury|car|taxi|transfer|transfert|tour|walking|cathedral|airport|milano|milan|como|lugano|duomo|restaurant|activity|activité|voucher|room|suite|king|sedan|daytrip|shopper|\b\d+\s*[·×x])/i.test(name)) return false;
      const words = name.split(/\s+/).filter(Boolean);
      return words.length >= 2 && words.length <= 5 && words.every(word => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+$/.test(word));
    }

    function travelerNameFromText(value) {
      const lines = String(value || '').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const match = lines.join(' ').match(/\b(?:M\.|Mr\.?|Mme|Mrs\.?|Ms\.?)\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+){1,3})/i);
      return cleanTravelerName(match?.[1] || lines.find(line => /^[A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+){1,3}$/.test(line)) || '');
    }

    function findTravelerPanel() {
      const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, button, [role="heading"], div, span'))
        .find(element => /^Voyageurs\s*(?:\(\s*\d+\s*\))?/i.test((element.textContent || '').trim()));
      if (!heading) return null;
      let panel = heading;
      for (let depth = 0; depth < 5 && panel.parentElement; depth += 1) {
        panel = panel.parentElement;
        if ((panel.innerText || '').match(/Voyageurs\s*\(\s*\d+\s*\)/i) && (panel.innerText || '').length < 12000) return panel;
      }
      return heading.parentElement;
    }

    function getTravelerBirthdayHints(text) {
      const hits = [];
      const birthdayRegex = /(date\s+de\s+naissance|birth\s+date|birthday|date\s+d['’]naissance|date\s+naissance)[^\n]{0,80}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/gi;
      for (const match of String(text || '').matchAll(birthdayRegex)) {
        hits.push((match[0] || '').replace(/\s+/g, ' ').trim());
      }
      return hits;
    }

    function extractPersonalDetails(text) {
      return String(text || '').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(line => line && /date\s+(?:de\s+)?naissance|birth|anniversaire|@|téléphone|telephone|mobile|portable|phone|passeport|passport|document number|numéro de document/i.test(line)).slice(0, 30);
    }

    async function extractTravelerProfileData() {
      const panel = findTravelerPanel();
      if (!panel) return { travelerNames: [], travelerProfiles: [], birthdayHints: [], clickedTravelerButtons: 0, clickedPencilButtons: 0 };
      const expandButton = Array.from(panel.querySelectorAll('button, [role="button"]'))
        .find(element => /afficher\s+\d+\s+de\s+plus|show\s+\d+\s+more/i.test((element.textContent || '').trim()));
      if (expandButton) {
        try { expandButton.click(); await sleep(250); } catch (e) {}
      }

      const rowSelector = '[data-traveler-id], [data-passenger-id], [data-guest-id], li, article';
      let rows = Array.from(panel.querySelectorAll(rowSelector)).filter(element => isLikelyTravelerName(travelerNameFromText(element.innerText || '')));
      if (!rows.length) rows = Array.from(panel.querySelectorAll('button')).filter(element => isLikelyTravelerName(travelerNameFromText(element.innerText || '')));
      const uniqueRows = [];
      const seenNames = new Set();
      for (const row of rows) {
        const name = travelerNameFromText(row.innerText || '');
        if (!isLikelyTravelerName(name) || seenNames.has(name)) continue;
        seenNames.add(name); uniqueRows.push({ row, name });
      }
      const profiles = [];
      let clickedPencilButtons = 0;
      for (const entry of uniqueRows) {
        const rowTextBefore = entry.row.innerText || '';
        const pencil = Array.from(entry.row.querySelectorAll('button, [role="button"], a'))
          .find(element => /crayon|edit|modifier|pencil/i.test(`${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.textContent || ''}`));
        try {
          (pencil || entry.row).click();
          if (pencil) clickedPencilButtons += 1;
          await sleep(180);
        } catch (e) {}
        const detailText = document.body.innerText || rowTextBefore;
        const details = extractPersonalDetails(detailText);
        const birthdayHints = getTravelerBirthdayHints(details.join('\n'));
        profiles.push({ name: entry.name, details, birthdayHints });
      }
      const travelerNames = uniqueRows.map(entry => entry.name);
      const birthdayHints = Array.from(new Set(profiles.flatMap(profile => profile.birthdayHints)));
      return {
        travelerNames,
        travelerProfiles: profiles,
        birthdayHints,
        clickedTravelerButtons: uniqueRows.length,
        clickedPencilButtons,
      };
    }

    // Détection des fichiers par type — accumulée au fil des clics, jamais réinitialisée
    const pdfUrlSet = new Set();
    const docxUrlSet = new Set();
    const xlsxUrlSet = new Set();
    const imageUrlSet = new Set();

    function classify(url) {
      const value = String(url || '').trim();
      if (!value || /^chrome-extension:\/\/invalid(?:\/|$)/i.test(value) || /^chrome-extension:\/\//i.test(value) || /^data:/i.test(value) || /^blob:/i.test(value)) return;
      if (/USER_AVATAR|\/avatar\.(?:png|jpe?g|webp)/i.test(value)) return;
      if (/\.pdf($|\?)/i.test(value)) pdfUrlSet.add(value);
      else if (/\.docx($|\?)/i.test(value)) docxUrlSet.add(value);
      else if (/\.(xlsx|xls)($|\?)/i.test(value)) xlsxUrlSet.add(value);
      else if (/\.(png|jpe?g|webp|gif|heic)($|\?)/i.test(value)) imageUrlSet.add(value);
    }

    function scanFilesOnCurrentDOM() {
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
    }

    // Capture de sécurité : tout le texte visible AVANT tout clic (bandeau du haut,
    // panneau Voyageurs/Reminders/Notes, et le contenu de l'onglet par défaut).
    // Sert de filet en cas d'onglet non détecté par la suite.
    const initialSnapshot = (document.body.innerText || '').trim();
    const originalTab = activeTabElement();
    const travelerData = await extractTravelerProfileData();
    const ticketMatch = initialSnapshot.match(/\bTickets?\s*\(\s*(\d+)\s*\)/i);
    const ticketsPresence = { detected: Boolean(ticketMatch || /\bTickets?\b/i.test(initialSnapshot)), count: ticketMatch ? Number(ticketMatch[1]) : null, evidence: ticketMatch ? ticketMatch[0] : (/\bTickets?\b/i.test(initialSnapshot) ? 'Onglet Tickets visible sur la page principale.' : 'Aucun onglet Tickets visible dans la capture initiale.') };
    scanFilesOnCurrentDOM();

    function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    const ticketStatuses = ['En attente (Agence)', 'En attente (Voyageur)', 'En attente (Back Office)', 'En attente (Front Office)', 'En attente (Rappels)', 'En cours', 'Résolu', 'Nouveau', 'Ouvert', 'Clôturé'];
    const ticketPriorities = ['Urgent', 'Immédiat', 'Haute', 'Normal', 'Basse'];
    function parseTicketText(rawText, sourceUrl = window.location.href, fallbackId = '', includeAttachments = true) {
      const fullText = String(rawText || '').trim();
      const pathId = String(sourceUrl).match(/\/tickets\/([^/?#]+)/i)?.[1] || '';
      const number = fullText.match(/Ticket\s*#\s*([\w-]+)/i)?.[1] || pathId || fallbackId || `visible-${Date.now()}`;
      const lines = fullText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const currentStatus = ticketStatuses.find(value => lines.some(line => line.toLowerCase() === value.toLowerCase() || line.toLowerCase().includes(value.toLowerCase()))) || 'Statut non exporté';
      const currentPriority = ticketPriorities.find(value => lines.some(line => line.toLowerCase() === value.toLowerCase() || line.toLowerCase().includes(value.toLowerCase()))) || 'Priorité non exportée';
      const transitions = [];
      const events = [];
      const reminders = [];
      lines.forEach((line, index) => {
        const status = line.match(/^(.+?) a changé le statut de (.+?) à (.+)$/i);
        if (status) {
          const at = lines[index + 1]?.match(/^\d{1,2}:\d{2}$/) ? lines[index + 1] : undefined;
          transitions.push({ from: status[2], to: status[3], at, actor: status[1] });
          events.push({ id: `status-${index}`, kind: 'status', createdAt: at, actor: status[1], summary: `${status[2]} → ${status[3]}` });
        }
        const priority = line.match(/^(.+?) a changé la priorité de (.+?) à (.+)$/i);
        if (priority) events.push({ id: `priority-${index}`, kind: 'priority', createdAt: lines[index + 1], actor: priority[1], summary: `Priorité ${priority[2]} → ${priority[3]}` });
        if (/a défini un rappel|a complété un rappel|rappel/i.test(line) && line.length < 220) {
          const reminder = { id: `reminder-${index}`, text: line, status: /complété|complete|done/i.test(line) ? 'completed' : 'active', dueAt: lines[index + 1] };
          reminders.push(reminder);
          events.push({ id: reminder.id, kind: 'reminder', createdAt: lines[index + 1], actor: line.split(' a ')[0], summary: line });
        }
      });
      const conversationStart = fullText.search(/Début de la conversation|Conversation|Messages?/i);
      const replyStart = fullText.search(/Répondre|Reply/i);
      const messageText = conversationStart >= 0 ? fullText.slice(conversationStart, replyStart > conversationStart ? replyStart : fullText.length).trim() : '';
      const attachmentUrls = includeAttachments ? [...pdfUrlSet, ...docxUrlSet, ...xlsxUrlSet, ...imageUrlSet] : [];
      const attachments = attachmentUrls.map((url, index) => ({ id: `attachment-${index + 1}`, name: decodeURIComponent(url.split('/').pop()?.split('?')[0] || `Pièce jointe ${index + 1}`), kind: /\.pdf($|\?)/i.test(url) ? 'pdf' : /\.(?:png|jpe?g|webp|gif)($|\?)/i.test(url) ? 'image' : 'file', url, extractionStatus: 'not_attempted' }));
      const tripRef = fullText.match(/Voyage Lié\s+([\w-]+)/i)?.[1] || fullText.match(/Trip\s+([\w-]+)/i)?.[1] || undefined;
      const subject = fullText.match(/Classification[\s\S]{0,500}?Sujet[\s\S]{0,120}?\n([^\n]+)/i)?.[1]?.trim() || fullText.match(/Ticket\s*#\s*[\w-]+\s*\n([^\n]+)/i)?.[1]?.trim() || '';
      const assignees = Array.from(new Set((fullText.match(/(?:Assigné|Assignee|Assigned)\s*[:\n]\s*([^\n]+)/i)?.[1] || '').split(/[,;|]/).map(value => value.trim()).filter(Boolean)));
      return { id: pathId || `ticket-${number}`, ticketNumber: number, status: currentStatus, priority: currentPriority, subject, category: fullText.match(/(?:Catégorie|Category)\s*[:\n]\s*([^\n]+)/i)?.[1]?.trim() || '', source: fullText.match(/(?:Source)\s*[:\n]\s*([^\n]+)/i)?.[1]?.trim() || 'onspot', assignees, tripRef, conversationText: messageText, messages: messageText ? [{ id: 'conversation', text: messageText, visibility: 'unknown', source: 'onspot-ticket-page' }] : [], events, statusTransitions: transitions, reminders, attachments, linkedTickets: [], sourceRefs: [sourceUrl] };
    }
    function extractCurrentTicket() {
      return parseTicketText(document.body.innerText || '', window.location.href, 'current');
    }
    function ticketIsActive(ticket) {
      return !/résolu|clôturé|closed|resolved|solved/i.test(`${ticket.status} ${ticket.subject}`);
    }
    function extractVisibleTicketCards() {
      const candidates = Array.from(document.querySelectorAll('a[href*="/tickets/"], [data-ticket-id], [data-ticket-number], tr, article, li, [role="row"]'));
      const seen = new Set();
      const tickets = [];
      for (const element of candidates) {
        const link = element.matches('a[href*="/tickets/"]') ? element : element.querySelector('a[href*="/tickets/"]');
        const href = link?.href || element.getAttribute('data-ticket-url') || window.location.href;
        const text = (element.closest('tr, article, li, [role="row"]')?.innerText || element.innerText || '').trim();
        if (!/Ticket\s*#\s*[\w-]+/i.test(text) && !/\/tickets\//i.test(href)) continue;
        if (!text || text.length > 1800) continue;
        const number = text.match(/Ticket\s*#\s*([\w-]+)/i)?.[1] || href.match(/\/tickets\/([^/?#]+)/i)?.[1];
        const key = `${number || ''}|${text.slice(0, 100)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tickets.push(parseTicketText(text, href, number || `visible-${tickets.length + 1}`, false));
      }
      return tickets;
    }
    async function openAndReadTicketCards() {
      const cards = Array.from(document.querySelectorAll('a[href*="/tickets/"], [data-ticket-id], [data-ticket-number]'));
      const hrefs = Array.from(new Set(cards.map(card => (card.matches('a[href*="/tickets/"]') ? card : card.querySelector('a[href*="/tickets/"]'))?.href).filter(Boolean)));
      const output = [];
      const seen = new Set();
      for (const href of hrefs) {
        const link = Array.from(document.querySelectorAll('a[href*="/tickets/"]')).find(candidate => candidate.href === href);
        if (!link || seen.has(href)) continue;
        seen.add(href);
        const beforeUrl = window.location.href;
        try {
          link.scrollIntoView({ block: 'center' });
          link.click();
          await sleep(700);
          const ticketText = document.body.innerText || '';
          if (/Ticket\s*#|Début de la conversation|Répondre|Reply/i.test(ticketText)) output.push(parseTicketText(ticketText, window.location.href, '', true));
        } catch (e) {
          collectionWarning = `Un ticket n’a pas pu être ouvert : ${e.message || 'erreur DOM'}`;
        }
        try {
          if (window.location.href !== beforeUrl) { history.back(); await sleep(700); }
        } catch (e) {}
      }
      return output;
    }

    function getListPaginationLinks() {
      const candidates = Array.from(document.querySelectorAll('a[href], button, [role="button"]'));
      return candidates.filter((element) => {
        const text = (element.textContent || '').trim();
        const aria = (element.getAttribute('aria-label') || '').trim();
        const title = (element.getAttribute('title') || '').trim();
        const candidateText = `${text} ${aria} ${title}`.toLowerCase();
        return /^(suivant|next|older|plus|page\s*\d+|\d+\s*\/\s*\d+|»|›)$/i.test(text) || /suivant|next|page\s*\d+|pagination|page suivante|page précédente|older|next page/i.test(candidateText);
      });
    }

    async function walkVisibleTicketPages(maxPages = 8) {
      const initialPage = window.location.href;
      const seenPages = new Set([initialPage]);
      const allTickets = [];
      let currentURL = initialPage;
      let currentPageNum = 0;
      let lastTicketCount = 0;

      while (currentPageNum < maxPages) {
        currentPageNum += 1;
        const pageTickets = extractVisibleTicketCards();
        for (const ticket of pageTickets) {
          const exists = allTickets.some((entry) => entry.id === ticket.id || (entry.ticketNumber && ticket.ticketNumber && entry.ticketNumber === ticket.ticketNumber));
          if (!exists) allTickets.push(ticket);
        }

        const candidates = getListPaginationLinks();
        const nextLink = candidates.find((element) => {
          const text = (element.textContent || '').trim();
          const aria = (element.getAttribute('aria-label') || '').trim();
          const title = (element.getAttribute('title') || '').trim();
          const candidateText = `${text} ${aria} ${title}`.toLowerCase();
          return /suivant|next|older|plus|page suivante/i.test(candidateText) || /^»|^›|^>$/.test(text);
        });

        if (!nextLink) break;

        const href = nextLink.href || nextLink.getAttribute('data-href') || nextLink.getAttribute('data-url');
        if (!href) {
          try { nextLink.click(); } catch (e) {}
          await sleep(350);
          const newURL = window.location.href;
          if (seenPages.has(newURL)) break;
          seenPages.add(newURL);
          currentURL = newURL;
          lastTicketCount = allTickets.length;
          continue;
        }

        const normalizedUrl = String(href).startsWith('http') ? href : new URL(href, window.location.href).href;
        if (seenPages.has(normalizedUrl)) break;
        seenPages.add(normalizedUrl);

        try {
          window.location.href = normalizedUrl;
        } catch (e) {
          break;
        }

        await sleep(500);
        if (window.location.href === currentURL) break;
        currentURL = window.location.href;
        lastTicketCount = allTickets.length;
      }

      return allTickets;
    }
    const isTicketPage = /\/tickets?\//i.test(window.location.pathname);
    const ticketScope = scope === 'trip_and_all_tickets' ? 'all_trip_tickets' : null;
    let tickets = [];
    let collectionWarning = null;
    async function revealTicketsSection() {
      const ticketsTab = findTabElement(ticketsTabDef.labels);
      if (!ticketsTab) return false;
      try {
        ticketsTab.click();
        await sleep(550);
        scanFilesOnCurrentDOM();
        return true;
      } catch (e) { return false; }
    }
    // Les tickets ne sont plus ouverts dans la page : le popup les lit un par un dans un onglet d'arrière-plan
    // (readTicketsInBackground), pour que l'agent reste sur sa Trip Card et qu'aucune autre page ne soit visitée.
    if (ticketScope && isTicketPage) tickets = [extractCurrentTicket()];
    const ticket = tickets[0] || null;

    const itinerary = {};
    const tabDiagnostics = [];

    // 1) Cliquer sur l'onglet principal "Itinéraire" pour révéler ses sous-onglets
    const mainEl = findTabElement(mainTabDefs[0].labels);
    if (mainEl) {
      const mainText = await clickAndReadTab(mainEl, '');
      tabDiagnostics.push({ key: 'itineraireMain', found: true, chars: (mainText || '').length, panelScoped: Boolean(mainText) });
      scanFilesOnCurrentDOM();
    } else tabDiagnostics.push({ key: 'itineraireMain', found: false, chars: 0, panelScoped: false });

    // 2) Chercher/cliquer chaque sous-onglet, maintenant qu'ils devraient être dans le DOM
    for (const def of subTabDefs) {
      const el = findTabElement(def.labels);
      if (el) {
        itinerary[def.key] = await clickAndReadTab(el, '');
        tabDiagnostics.push({ key: def.key, found: true, chars: (itinerary[def.key] || '').length, panelScoped: Boolean(itinerary[def.key]) });
        scanFilesOnCurrentDOM();
      } else {
        itinerary[def.key] = null;
        tabDiagnostics.push({ key: def.key, found: false, chars: 0, panelScoped: false });
      }
    }

    // 3) Cliquer enfin sur l'onglet principal "Vouchers"
    const vouchersEl = findTabElement(vouchersTabDef.labels);
    if (vouchersEl) {
      itinerary[vouchersTabDef.key] = await clickAndReadTab(vouchersEl, '');
      tabDiagnostics.push({ key: vouchersTabDef.key, found: true, chars: (itinerary[vouchersTabDef.key] || '').length, panelScoped: Boolean(itinerary[vouchersTabDef.key]) });
      scanFilesOnCurrentDOM();
    } else {
      itinerary[vouchersTabDef.key] = null;
      tabDiagnostics.push({ key: vouchersTabDef.key, found: false, chars: 0, panelScoped: false });
    }

    // 4) Lecture structurée de la carte OnSpot (balisage observé via le diagnostic de structure, oct. 2026) :
    // itinéraire jour par jour, bandeau, rappels, voyageurs, notes, services et cartes de tickets.
    const textOf = (el) => (el?.innerText || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
    const flat = (el) => textOf(el).replace(/\n/g, ' ');
    // Textes « feuilles » (texte propre de chaque élément) : évite les mots collés quand des <span> en ligne se suivent.
    const leafTexts = (root) => {
      const out = [];
      if (!root) return out;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) { const text = node.textContent.replace(/\s+/g, ' ').trim(); if (text && text !== '·') out.push(text); }
      return out;
    };
    const exactButton = (label, root = document) => Array.from(root.querySelectorAll('button, [role="tab"]')).find((el) => flat(el).toLowerCase() === label.toLowerCase());
    function sectionByHeading(pattern) {
      const heading = Array.from(document.querySelectorAll('h2, h3')).find((el) => pattern.test(flat(el)));
      return heading ? (heading.closest('.flex-col') || heading.parentElement?.parentElement?.parentElement || null) : null;
    }
    function headerField(label) {
      const labelEl = Array.from(document.querySelectorAll('p')).find((el) => flat(el).toLowerCase() === label.toLowerCase());
      if (!labelEl?.parentElement) return '';
      return leafTexts(labelEl.parentElement).slice(leafTexts(labelEl).length).join(' ').trim();
    }
    async function readStructuredCard() {
      try {
        const itineraryButton = exactButton('Itinéraire') || exactButton('Itinerary');
        if (itineraryButton) { itineraryButton.click(); await sleep(500); }
        const filterGroup = document.querySelector('[role="group"][aria-label*="Filtrer" i]') || document;
        const allButton = exactButton('Tous', filterGroup) || exactButton('All', filterGroup);
        if (allButton) { allButton.click(); await sleep(500); }
      } catch (e) {}
      const scroller = document.querySelector('[data-itin-scroll]');
      const days = Array.from((scroller || document).querySelectorAll('li[data-date-key]')).map((day) => ({
        date: day.getAttribute('data-date-key') || '',
        label: flat(day.querySelector('[data-testid="itinerary-day-header"]')),
        rows: Array.from(day.querySelectorAll('[data-testid="itinerary-row-body"]')).map((row) => {
          const voucher = row.querySelector('a[href]');
          return {
            type: flat(row.querySelector('span.text-xs')),
            time: flat(row.querySelector('span.font-mono')),
            title: flat(row.querySelector('h4')),
            details: Array.from(row.querySelectorAll('p')).map(flat).filter(Boolean),
            voucher: voucher ? (voucher.getAttribute('aria-label') || '') : '',
            voucherUrl: voucher ? voucher.href : '',
            status: Array.from(row.querySelectorAll('[role="img"][aria-label]')).map((el) => el.getAttribute('aria-label')).join(', '),
          };
        }),
      }));
      const reminderSection = sectionByHeading(/^Reminders\b|^Rappels\b/i);
      const leafItems = () => (reminderSection ? Array.from(reminderSection.querySelectorAll('li')).filter((li) => !li.querySelector('li')) : []);
      const isShown = (el) => !el.closest('[hidden],[aria-hidden="true"]') && el.getClientRects().length > 0;
      const activeItems = new Set(leafItems().filter(isShown));
      // Déplie la liste « Completed (N) » (simple bouton d'affichage) pour lire aussi les rappels déjà faits.
      if (reminderSection && scope === 'trip_and_all_tickets') {
        const toggle = Array.from(reminderSection.querySelectorAll('button[aria-expanded="false"]')).find((el) => /Completed|Termin/i.test(flat(el)));
        if (toggle) { try { toggle.click(); await sleep(450); } catch (e) {} }
      }
      const reminderItems = leafItems();
      const reminders = [];
      for (const li of reminderItems) {
        const lines = leafTexts(li);
        if (!lines.length) continue;
        const completed = !activeItems.has(li);
        let detail = [];
        if (openReminderDetails) {
          const before = new Set(document.querySelectorAll('[role="dialog"]'));
          try { (li.querySelector('button') || li).click(); await sleep(600); } catch (e) {}
          const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find((el) => !before.has(el));
          if (dialog) {
            detail = leafTexts(dialog).filter((text) => !lines.includes(text));
            const close = Array.from(dialog.querySelectorAll('button')).find((el) => /^(?:Fermer|Close|Annuler|Cancel|×)$/i.test(flat(el) || el.getAttribute('aria-label') || ''));
            try { if (close) close.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300); } catch (e) {}
          }
        }
        reminders.push({ lines, completed, detail });
      }
      const completedReminders = reminderSection ? (flat(reminderSection).match(/Completed\s*\(\s*(\d+)\s*\)|Terminés?\s*\(\s*(\d+)\s*\)/i) || []).slice(1).find(Boolean) || null : null;
      const travelerSection = sectionByHeading(/^Voyageurs\b|^Travell?ers\b/i);
      const travelers = travelerSection ? Array.from(travelerSection.querySelectorAll('p.font-medium')).map((nameEl) => {
        const row = nameEl.closest('.p-3, .rounded-lg') || nameEl.parentElement?.parentElement || nameEl;
        const contacts = Array.from(row.querySelectorAll('button')).map(flat).filter(Boolean);
        const badges = Array.from(row.querySelectorAll('span')).map(flat).filter((text) => text && text !== '—' && !contacts.some((contact) => contact.includes(text)) && !flat(nameEl).includes(text));
        return { name: flat(nameEl), emails: contacts.filter((text) => /@/.test(text)), phones: contacts.filter((text) => /^\+?[\d ()./-]{7,}$/.test(text)), badges: Array.from(new Set(badges)) };
      }) : [];
      const notesSection = sectionByHeading(/^Notes$/i);
      const internalLabel = notesSection ? Array.from(notesSection.querySelectorAll('span, p')).find((el) => /^Interne\s*[—-]\s*OnSpot/i.test(flat(el))) : null;
      const internalBox = internalLabel ? (internalLabel.closest('.rounded-xl') || internalLabel.parentElement?.parentElement) : null;
      const notes = notesSection ? Array.from(notesSection.querySelectorAll('p')).filter((el) => !internalBox?.contains(el)).map(textOf).filter((text) => text && !/^Aucune note$/i.test(text)) : [];
      const internal = internalBox ? Array.from(internalBox.querySelectorAll('p')).map(textOf).filter(Boolean).join('\n') : '';
      const servicesSection = sectionByHeading(/^Services du trip/i);
      const services = servicesSection ? Array.from(servicesSection.querySelectorAll('button')).map((el) => textOf(el).split('\n').join(' : ')).filter(Boolean) : [];
      const ticketSection = sectionByHeading(/^Tickets\b/i);
      const ticketCards = ticketSection ? Array.from(ticketSection.querySelectorAll('a[href*="/tickets/"]')).map((card) => ({ href: card.href, lines: leafTexts(card) })) : [];
      return {
        title: flat(document.querySelector('h1')),
        header: { pays: headerField('Pays'), dates: headerField('Dates de trip'), agence: headerField('Agence'), voyageurs: headerField('Voyageurs'), forfait: headerField('Forfait') },
        itinerary: days,
        reminders,
        completedReminders: completedReminders ? Number(completedReminders) : null,
        travelers,
        notes,
        internal,
        services,
        tickets: ticketCards,
      };
    }
    let structured = null;
    try { structured = await readStructuredCard(); scanFilesOnCurrentDOM(); } catch (e) { structured = { error: e.message || 'lecture structurée impossible' }; }
    tabDiagnostics.push({ key: 'structured', found: Boolean(structured?.itinerary?.length), chars: structured?.itinerary?.reduce((sum, day) => sum + day.rows.length, 0) || 0, panelScoped: true });

    // 4) Tickets et Rappels ne sont jamais ouverts : le contrôle pré-départ ne doit pas déplacer l’agent vers ces écrans.
    // L’extension conserve uniquement une présence passive observée dans le bandeau principal.
    try { if (originalTab && originalTab instanceof HTMLElement) { originalTab.click(); await sleep(120); } } catch (e) {}

    resolve({
      itinerary,
      structured,
      initialSnapshot,
      travelerData,
      ticketsPresence,
      pdfUrls: Array.from(pdfUrlSet),
      docxUrls: Array.from(docxUrlSet),
      xlsxUrls: Array.from(xlsxUrlSet),
      imageUrls: Array.from(imageUrlSet),
      ticket,
      scope,
      collectionWarning,
      tabDiagnostics,
      pageUrl: window.location.href,
      pageTitle: document.title,
      tickets
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
function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

function serviceTypeFromSection(section) {
  const mapping = { 'Hôtels': 'hotel', 'Vols': 'flight', 'Activités': 'activity', 'Transferts': 'transfer', 'Trains': 'train', 'Locations': 'car-rental' };
  return mapping[section] || 'other';
}

function extractStructuredServices(timeline, referenceText = '', forcedSection = null) {
  const lines = String(timeline || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sectionNames = new Set(['Hôtels', 'Vols', 'Activités', 'Transferts', 'Trains', 'Locations']);
  const monthPattern = /^(\d{1,2})\s+(janv?\.?|févr?\.?|mars|avr(?:il)?\.?|mai|juin|juil?\.?|août|sept?\.?|oct(?:obre)?\.?|nov(?:embre)?\.?|déc(?:embre)?)$/i;
  const months = { jan: '01', janv: '01', févr: '02', mars: '03', avr: '04', mai: '05', juin: '06', juil: '07', août: '08', sept: '09', oct: '10', nov: '11', déc: '12' };
  const yearPattern = /(?<!\b[A-Z]{2,3}\s)\b20\d{2}\b/; const yearMatch = String(referenceText).match(yearPattern) || String(timeline).match(yearPattern); let inferredYear = Number(yearMatch?.[0]) || new Date().getUTCFullYear();
  const services = []; let currentDate = null; let section = forcedSection; let previousMonth = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]; const date = line.match(monthPattern);
    if (date) { const key = date[2].replace('.', '').slice(0, 4).toLowerCase(); const month = months[key] || months[key.slice(0, 3)]; const monthNumber = Number(month || 0); if (monthNumber && previousMonth !== null && monthNumber < previousMonth) inferredYear += 1; previousMonth = monthNumber || previousMonth; currentDate = month ? `${inferredYear}-${month}-${date[1].padStart(2, '0')}` : null; section = forcedSection; continue; }
    if (sectionNames.has(line)) { section = line; continue; }
    if (!section || !currentDate || /^(Rechercher|Tableau|Trip_|Ajouter|Reminders|Notes|Services|Métadonnées|Tickets)/i.test(line)) continue;
    const type = serviceTypeFromSection(section); const hasTime = /^\d{1,2}:\d{2}$/.test(line); const title = hasTime ? lines[index + 1] : line; const next = hasTime ? lines[index + 2] : lines[index + 1]; const nextIsDate = monthPattern.test(next || ''); const location = nextIsDate && type === 'activity' ? 'Lieu non exporté dans la timeline' : next;
    if (!title || !location || sectionNames.has(title) || sectionNames.has(location)) continue;
    if (type === 'hotel' && !/,\s*[A-Z]{2}$/i.test(location)) continue;
    if (['transfer', 'train'].includes(type) && !location.includes('→')) continue;
    if (type === 'flight' && !location.includes('→') && !/\b[A-Z]{2}\s?\d{2,4}\b/i.test(`${title} ${location}`)) continue;
    if (title.length > 180 || location.length > 260) continue;
    services.push({ id: `${type}-${services.length + 1}`, type, date: currentDate, time: hasTime ? line : null, title: cleanText(title), location: cleanText(location), source: 'itinerary.tous', extractionConfidence: nextIsDate ? 'medium' : 'high', extractionEvidence: nextIsDate ? 'Prestation datée mais lieu non visible avant la date suivante.' : 'Date, section et détails visibles dans la timeline.' });
    index += hasTime ? (nextIsDate ? 1 : 2) : (nextIsDate ? 0 : 1);
  }
  return Array.from(new Map(services.map((service) => [`${service.type}|${service.date}|${service.title}|${service.location}`, service])).values());
}

function classifyDocument(file) {
  const filename = String(file.name || '').toLowerCase();
  const content = `${file.name}\n${file.text || ''}`.toLowerCase();
  const result = (category, confidence, evidence) => ({ category, classificationConfidence: confidence, classificationEvidence: evidence });
  const flightText = /compagnie aérienne|compagnie émettrice|numéro de billet|votre e-ticket|boarding pass|carte d.?embarquement|flight itinerary|flight number|airline|\b(?:vol|flight)\s+[A-Z]{2}\s?\d{2,4}\b|\b[A-Z]{2}\s?\d{2,4}\b.*(?:TLS|MUC|DBV|CDG|LHR|JFK|airport|aéroport)/i.test(content);
  const flightName = /(?:billet|e[-_ ]?ticket|flight|vol)[^a-z]{0,25}(?:avion|air|airlines?|dl|af|ba|lh)/.test(filename);
  if (flightText || (flightName && /(?:\b[A-Z]{2}\s?\d{2,4}\b|aéroport|airport|departure|arrivée|arrival)/i.test(file.text || ''))) return result('flight-plan', 'high', flightText ? 'Le contenu comporte un numéro de billet, une compagnie émettrice ou une preuve d’embarquement.' : 'Le nom et le contenu confirment un document aérien avec segment exploitable.');
  const identityName = /(?:^|[_\-\s])(passeport|passport|cni|carte[_\-\s]?(?:nationale[_\-\s]?)?d.?identit[eé])(?:[_\-\s.]|$)/.test(filename);
  const identityText = /(?:passport number|numéro de passeport|document number|numéro de document|^p<[a-z])/im.test(String(file.text || ''));
  if (identityName || identityText) return result('identity', identityName ? 'high' : 'medium', identityName ? 'Le fichier joint est explicitement nommé passeport ou CNI.' : 'Le contenu porte un identifiant propre à un document d’identité.');
  if (/(?:^|\n)\s*(?:hotel|hôtel)\s*:|type de chambre|room type|check.?in|plan repas/.test(content)) return result('hotel', 'high', 'Le contenu identifie un hôtel, une chambre ou des dates de séjour.');
  if (/pickup date|pickup time|dropoff address|limo|chauffeur|transfer|transfert|car rental|location de voiture|ferry|train/.test(content)) return result('transport', 'high', 'Le contenu identifie une prise en charge, un transport ou une location.');
  if (/tour\/activity|tour\/?activity|restaurant reservation|activity date|excursion|reservation confirmation|activité|excursion|visite guidée|guide|walking tour|private tour|food tasting/i.test(content)) return result('activity', 'high', 'Le contenu identifie une activité ou une réservation de restaurant.');
  if (/itinerary|itinéraire/.test(filename)) return result('itinerary', 'medium', 'Le nom du fichier indique un itinéraire ; sa nature de voucher doit être contrôlée.');
  return result('other', 'low', 'Aucun marqueur documentaire suffisamment spécifique n’a été trouvé.');
}

function buildEliteOperationalPlan({ allText, files, services, tickets }) {
  const corpus = [allText, ...files.map(file => `${file.name}\n${file.text || ''}`)].join('\n');
  const flags = [];
  const addFlag = (id, severity, label, description, action, responsible = 'Agent Elite', evidence = '') => flags.push({ id, severity, label, description, action, responsible, evidence });
  const emailMatches = corpus.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
  const phoneEvidence = /(?:téléphone|telephone|mobile|portable|phone|whatsapp|tel\.?)(?:\s*[:\n]|\s+)[+()\d][\d .()/-]{6,}/i.test(corpus);
  const agencyContext = /agence|agency|onspot/i.test(corpus);
  const directEmailEvidence = emailMatches.some(email => !agencyContext || !/(?:agency|agence|onspot)/i.test(corpus.slice(Math.max(0, corpus.indexOf(email) - 90), corpus.indexOf(email) + email.length + 90)));
  const hasTravelerContact = Boolean(phoneEvidence || directEmailEvidence);
  const hasAgencyEmailOnly = emailMatches.length > 0 && !directEmailEvidence && agencyContext;
  if (hasAgencyEmailOnly) addFlag('traveler-contact-agency-email', 'warning', 'Email client à confirmer', 'Le ou les emails repérés semblent appartenir à l’agence.', 'Demander à l’agence l’email et le téléphone directs du voyageur.', 'Agent Elite', emailMatches.join(', '));
  if (!hasTravelerContact) addFlag('traveler-contact-missing', 'warning', 'Contact voyageur manquant', 'Aucun téléphone ou email direct du voyageur n’est prouvé dans l’export.', 'Vérifier le contact client ; si seul l’email agence est présent, ouvrir une demande à l’agence.', 'Agent Elite');
  const hasIdentity = files.some(file => file.category === 'identity') || /(?:passeport|passport|cni|carte nationale|document d’identité)[^\n]{0,80}(?:joint|attaché|reçu|received|scan)/i.test(corpus);
  if (!hasIdentity) addFlag('passport-missing', 'blocking', 'Passeport / identité non prouvé', 'Aucun fichier ou contenu suffisamment probant de pièce d’identité n’a été retrouvé.', 'Demander le passeport ou la CNI à l’agence en créant un ticket.', 'Agent Elite');
  const flightServices = services.filter(service => service.type === 'flight');
  const hasFlights = flightServices.length > 0 || /(?:^|\n)\s*(?:vols?|flights?)\b/i.test(corpus);
  const pnrEvidence = /(?:\bPNR\b|code de réservation|booking reference|record locator|référence de réservation)/i.test(corpus);
  if (hasFlights && !pnrEvidence) addFlag('flight-pnr-missing', 'blocking', 'PNR aérien manquant', 'Les segments de vol ne suffisent pas pour préparer les boarding passes sans PNR.', 'Demander ou vérifier le PNR complet. Si le Pax a pris les BP de son côté, le noter explicitement et ne pas les préparer.', 'Agent Elite');
  const ownBoardingPass = /(?:pax|passager|voyageur|client)[^\n.]{0,140}(?:pris|obtenu|géré|de son côté|own|themselves)[^\n.]{0,100}(?:boarding pass|carte d.?embarquement|BP)/i.test(corpus);
  const hasBoardingProof = files.some(file => file.category === 'flight-plan') || /boarding pass|carte d.?embarquement/i.test(corpus);
  if (hasFlights && !hasBoardingProof && !ownBoardingPass) addFlag('boarding-pass-proof-missing', 'warning', 'Preuve boarding pass à clarifier', 'Des vols sont présents, mais aucune preuve de billet ou de carte d’embarquement n’est classée.', 'Vérifier les documents ; ne pas fabriquer de BP à partir du seul numéro de vol et de l’itinéraire.', 'Agent Elite');
  const providerServices = services.filter(service => ['transfer', 'activity', 'car-rental', 'train'].includes(service.type));
  const hasProviderService = providerServices.length > 0 || /transfert|transfer|activité|activity|location de voiture|car rental|guide|dmc|pocket wifi/i.test(corpus);
  const hasProviderContact = /(?:téléphone|telephone|phone|mobile|whatsapp|tel\.?|@|email|e-mail)\s*[:\n+\d]/i.test(corpus);
  if (hasProviderService && !hasProviderContact) addFlag('provider-contact-missing', 'blocking', 'Contact prestataire manquant', 'Des prestations nécessitent un contact opérationnel, mais aucun contact prestataire n’est prouvé.', 'Obtenir le contact du transfert, guide, DMC, activité ou fournisseur Pocket WiFi.', 'Agent Elite');
  const birthday = /anniversaire|birthday|date de naissance|birth date/i.test(corpus);
  if (birthday) addFlag('birthday-reminder', 'info', 'Anniversaire détecté', 'Une information d’anniversaire apparaît dans le dossier.', 'Créer un rappel le jour J et conserver l’information dans la note Internal — OnSpot only.', 'Agent Elite');
  addFlag('internal-note-required', 'info', 'Note Mayara à préparer', 'Les informations importantes doivent être synthétisées dans la note jaune Internal — OnSpot only.', 'Préparer une note courte pour Mayara avec les points de vigilance, contacts et décisions.', 'Agent Elite');
  addFlag('proactive-suggestions-required', 'info', 'Deux suggestions locales à ajouter', 'Le dossier Elite doit contenir au moins deux suggestions proactives.', 'Ajouter deux suggestions pertinentes — restaurant, activité ou expérience — dans la note jaune interne.', 'Agent Elite');
  const activityH24 = services.filter(service => service.type === 'activity' && /24\s*h|reconfirmation/i.test(`${service.title} ${service.location}`)).length || (/activité[^\n]{0,100}(?:24\s*h|reconfirmation)/i.test(corpus) ? 1 : 0);
  const reminderPlan = [
    { id: 'predeparture-review', label: 'Identification et analyse avant reconfirmation', owner: 'Automatique', timing: '10 jours avant l’arrivée', trigger: 'arrival_minus_10_days' },
    { id: 'welcome-call', label: 'Welcome Call', owner: 'Agent Elite', timing: 'À programmer selon l’arrivée locale', trigger: 'arrival' },
    { id: 'here-for-you', label: 'Here For You / FUP', owner: 'Agent Elite', timing: 'Pendant le séjour selon protocole Elite', trigger: 'during_trip' },
    { id: 'birthday', label: 'Anniversaire', owner: birthday ? 'Agent Elite' : 'Conditionnel', timing: 'Jour J si détecté', trigger: 'birthday_if_present' },
    { id: 'boarding-pass', label: 'Boarding pass', owner: 'Mayara', timing: 'Selon le rappel existant', trigger: 'agency_process' },
    { id: 'activity-reconfirmation', label: 'Reconfirmation activité', owner: 'Agent Elite', timing: 'H-24', trigger: 'activity_minus_24h', count: activityH24 },
    { id: 'goodbye-call', label: 'Good Bye Call', owner: 'Automatique', timing: '2 jours avant le retour', trigger: 'return_minus_2_days' },
    { id: 'post-trip-report', label: 'Compte rendu à l’agence', owner: 'Agent Elite', timing: '24 h après le retour', trigger: 'return_plus_24h' }
  ];
  return {
    flags,
    reminderPlan,
    internalNote: { target: 'Internal — OnSpot only', required: true, content: '', placeholders: ['Informations importantes pour Mayara', 'Décisions et points de vigilance', 'Contacts prestataires utiles'] },
    proactiveSuggestions: { required: 2, suggestions: [{ id: 'suggestion-1', status: 'to_add', type: 'restaurant', content: '' }, { id: 'suggestion-2', status: 'to_add', type: 'activity', content: '' }] },
    responsibilities: { agentElite: ['Welcome Call', 'Here For You / FUP', 'anniversaire si applicable', 'reconfirmation des activités H-24', 'compte rendu post-voyage'], mayara: ['Boarding pass'], automatic: ['analyse à J-10', 'Good Bye Call à J-2'] },
    summary: { blocking: flags.filter(flag => flag.severity === 'blocking').length, warning: flags.filter(flag => flag.severity === 'warning').length, info: flags.filter(flag => flag.severity === 'info').length }
  };
}

function isLikelyTravelerName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').replace(/^(?:M\.|Mr\.?|Mme|Mrs\.?|Ms\.?)\s*/i, '').trim();
  if (!name || name.length < 4 || name.length > 90 || /\d|→|->|@/.test(name)) return false;
  if (/\b(?:call|rappel|reminder|compte rendu|boarding|welcome|goodbye|good bye|here for you|haute valeur|completed)\b/i.test(name)) return false;
      if (/(?:hotel|hôtel|palazzo|resort|lodge|camp|villa|plains|safari|dunes|spitzkoppen|etosha|mushara|umkumbe|kwessi|dar\s+amane|driver|chauffeur|private|luxury|car|taxi|transfer|transfert|tour|walking|cathedral|airport|milano|milan|como|lugano|duomo|restaurant|activity|activité|voucher|room|suite|king|sedan|daytrip|shopper|\b\d+\s*[·×x])/i.test(name)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5 && words.every(word => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’-]+$/.test(word));
}

function buildTripCardPayload({ pageData, pdfTexts, docxTexts, xlsxTexts }) {
  const itineraryValues = Object.values(pageData.itinerary || {}).filter(Boolean);
  const detailedItineraryCaptured = itineraryValues.some(value => String(value).trim().length > 0);
  const fallbackItinerary = detailedItineraryCaptured ? pageData.itinerary : { ...(pageData.itinerary || {}), tous: pageData.initialSnapshot || '' };
  const allText = [pageData.initialSnapshot, ...Object.values(fallbackItinerary).filter(Boolean)].join('\n\n');
  const tripCandidates = Array.from(allText.matchAll(/\bTrip\s+(\d{6,})\b/gi)).map(match => match[1]);
  const pageCandidates = String(pageData.pageTitle || '').match(/\b\d{6,}\b/g) || [];
  const tripNumber = [...tripCandidates, ...pageCandidates].sort((a, b) => b.length - a.length)[0];
  const reference = tripNumber ? `Trip ${tripNumber}` : (allText.match(/Référence de réservation\s+([^\n]+)/i) || [])[1]?.trim() || 'sans-reference';
  const travelerNamesFromDOM = Array.isArray(pageData.travelerData?.travelerNames) ? pageData.travelerData.travelerNames : [];
  const travelerBirthdayHints = Array.isArray(pageData.travelerData?.birthdayHints) ? pageData.travelerData.birthdayHints : [];
  const travelers = Array.from(new Set([
    ...travelerNamesFromDOM.filter(isLikelyTravelerName),
    ...Array.from(new Set(Array.from(allText.matchAll(/\b(?:M\.|MR\.|Mme|MM\.)\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)/g)).map((match) => `${match[1]} ${match[2]}`))),
  ]));
  const files = [
    ...pdfTexts.map((item) => ({ kind: 'pdf', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.pdf', text: item.text })),
    ...docxTexts.map((item) => ({ kind: 'docx', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.docx', text: item.text })),
    ...xlsxTexts.map((item) => ({ kind: 'xlsx', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.xlsx', text: item.text })),
    ...pageData.imageUrls.map((url) => ({ kind: 'image', url, name: url.split('/').pop()?.split('?')[0] || 'image-jointe', text: '' }))
  ].map((file) => ({ ...file, ...classifyDocument(file) }));
  const profileNotes = Array.from(new Set([
    ...((allText.match(/(?:VIP|Exigeant|anniversaire|birthday|allergie|mobilité réduite)[^\n]*/gi) || []).map(cleanText).filter(note => !/\b(?:aucune?|sans|pas de|no|none)\s+(?:allergie|allergies|allergy|allergies?)\b/i.test(note))),
    ...travelerBirthdayHints,
  ]));
  const serviceTabs = [['tous', null], ['hotels', 'Hôtels'], ['vols', 'Vols'], ['activites', 'Activités'], ['locations', 'Locations'], ['transferts', 'Transferts'], ['trains', 'Trains']];
  const directServices = serviceTabs.flatMap(([key, forcedSection]) => extractStructuredServices(fallbackItinerary?.[key] || '', pageData.initialSnapshot || '', forcedSection));
  const sidebarServices = detailedItineraryCaptured ? [] : extractStructuredServices(pageData.initialSnapshot || '', pageData.initialSnapshot || '', null).map(service => ({ ...service, source: 'initialSnapshot.sidebar', extractionConfidence: 'medium', extractionEvidence: 'Résumé visible dans le bandeau ou panneau latéral ; onglets détaillés non capturés.' }));
  const services = Array.from(new Map([...directServices, ...sidebarServices].map(service => [`${service.type}|${service.date}|${service.time || ''}|${service.title}|${service.location}`, service])).values());
  const serviceDates = services.map(service => service.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const cleanTravelerNames = Array.from(new Set(travelers.filter((name) => !services.some((service) => { const candidate = String(name).toLowerCase().trim(); const title = String(service.title || '').toLowerCase().trim(); const location = String(service.location || '').toLowerCase().trim(); return candidate === title || candidate === location || (candidate.length > 8 && (title.includes(candidate) || location.includes(candidate))); }))));
  const cleanTravelerProfiles = (Array.isArray(pageData.travelerData?.travelerProfiles) ? pageData.travelerData.travelerProfiles : []).filter((profile) => cleanTravelerNames.includes(profile.name));
  const capturedTickets = Array.from(new Map((pageData.tickets || (pageData.ticket ? [pageData.ticket] : [])).map(ticket => [ticket.id || ticket.ticketNumber, { ...ticket, attachments: (ticket.attachments || []).map((attachment) => {
    const extracted = [...pdfTexts, ...docxTexts, ...xlsxTexts].find(item => item.url === attachment.url);
    return extracted ? { ...attachment, excerpt: extracted.text.slice(0, 6000), extractionStatus: extracted.text.startsWith('[ERREUR') ? 'error' : 'ok' } : attachment;
  }) }])).values());
  const ticketCorpus = capturedTickets.map(ticket => [ticket.current?.status, ticket.current?.priority, ticket.current?.category, ticket.current?.subject, ticket.conversationText, ...(ticket.messages || []).map(message => message.text), ...(ticket.events || []).map(event => event.summary)].filter(Boolean).join('\n')).join('\n');
  const elitePlan = buildEliteOperationalPlan({ allText: `${allText}\n${ticketCorpus}`, files, services, tickets: capturedTickets });
  return {
    schemaVersion: '3.1.0', source: 'onspot-audit-assistant', generatedAt: new Date().toISOString(), pageUrl: pageData.pageUrl, pageTitle: pageData.pageTitle,
    collection: { tabDiagnostics: pageData.tabDiagnostics || [], scope: pageData.scope || 'trip_only', collectionStatus: pageData.collectionWarning || !detailedItineraryCaptured ? 'partial' : 'complete', capturedAt: new Date().toISOString(), warnings: Array.from(new Set([pageData.collectionWarning, !detailedItineraryCaptured ? 'Les onglets détaillés de l’itinéraire n’ont pas été capturés ; les prestations ont été structurées depuis le bandeau visible. Refaire une capture complète pour obtenir les horaires et détails.' : null, detailedItineraryCaptured && !services.length ? 'Les onglets d’itinéraire ont été lus mais aucune prestation structurée n’a été reconnue ; vérifier les diagnostics DOM.' : null].filter(Boolean))), visibleOnly: true },
    reference, travelers: cleanTravelerNames, startDate: serviceDates[0] || null, endDate: serviceDates.at(-1) || null, destination: (allText.match(/(?:Destination|Pays|Country)\s*[:\n]?\s*([^\n]+)/i) || [])[1]?.trim() || null,
    metadata: { agency: (allText.match(/AGENCE\s+([^\n]+)/i) || [])[1]?.trim() || null, tripId: (allText.match(/ID\s+(trip_[^\n]+)/i) || [])[1]?.trim() || null, profileNotes, travelerProfiles: cleanTravelerProfiles, travelerExtraction: { clickedTravelerButtons: pageData.travelerData?.clickedTravelerButtons || 0, clickedPencilButtons: pageData.travelerData?.clickedPencilButtons || 0 }, ticketsPresence: pageData.ticketsPresence || { detected: false, count: null, evidence: 'Non observé.' }, ticketsText: capturedTickets.map(ticket => ticket.conversationText || '').filter(Boolean).join('\n\n'), captureScope: pageData.scope || 'trip_only', ticketCount: capturedTickets.length, elite: elitePlan },
    elite: elitePlan,
    tickets: capturedTickets,
    services, documents: files.map(({ text, ...file }) => ({ ...file, extractionStatus: text.startsWith('[ERREUR') ? 'error' : 'ok', excerpt: text.slice(0, 1500) })),
    documentCoverage: { flightPlans: files.filter((file) => file.category === 'flight-plan').length, identities: files.filter((file) => file.category === 'identity').length, hotels: files.filter((file) => file.category === 'hotel').length, transports: files.filter((file) => file.category === 'transport').length, activities: files.filter((file) => file.category === 'activity').length, unclassified: files.filter((file) => file.category === 'other').length },
    itinerary: fallbackItinerary, vouchersSummary: buildVouchersSummaryText({ pageData: { ...pageData, itinerary: fallbackItinerary }, pdfTexts, docxTexts, xlsxTexts })
  };
}

function buildVouchersSummaryText({ pdfTexts, docxTexts, xlsxTexts, pageData }) {
  const parts = [];
  if (pageData.initialSnapshot) {
    parts.push(`### BANDEAU & PANNEAU LATÉRAL (capture avant tout clic — pays, dates, agence, voyageurs, reminders, notes)\n${pageData.initialSnapshot}`);
  }
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
