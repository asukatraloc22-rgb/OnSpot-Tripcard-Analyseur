// =========================================================================
// OnSpot Audit Assistant — popup.js
// =========================================================================

import * as pdfjsLib from './pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.mjs';

const analyzeBtn = document.getElementById('analyzeBtn');
const copyTripCardBtn = document.getElementById('copyTripCardBtn');
const downloadTripCardBtn = document.getElementById('downloadTripCardBtn');
const statusBox = document.getElementById('status');
const captureScope = document.getElementById('captureScope');
const scopeHelp = document.getElementById('scopeHelp');

const scopeLabels = {
  trip_only: 'Voyage uniquement',
  current_ticket: 'Ticket courant',
  trip_and_active_tickets: 'Voyage + tickets actifs',
  selected_tickets: 'Tickets sélectionnés',
  all_trip_tickets: 'Tous les tickets du voyage',
  section_tickets: 'Tickets de la section courante'
};
const scopeHelpText = {
  trip_only: 'Métadonnées, itinéraire, vouchers et documents visibles.',
  current_ticket: 'Capture le ticket ouvert, sa chronologie, ses rappels et ses pièces jointes.',
  trip_and_active_tickets: 'Capture le voyage et les tickets actifs visibles dans la section courante.',
  selected_tickets: 'Capture les tickets sélectionnés ou le ticket ouvert, sans deviner les tickets hors écran.',
  all_trip_tickets: 'Capture tous les tickets visibles dans la section courante du voyage.',
  section_tickets: 'Capture les tickets visibles dans la section courante et le détail du ticket ouvert si présent.'
};
if (captureScope && scopeHelp) {
  captureScope.addEventListener('change', () => { scopeHelp.textContent = scopeHelpText[captureScope.value] || scopeHelpText.trip_only; });
}

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
  downloadTripCardBtn.disabled = isLoading;
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

    const scope = captureScope?.value || 'trip_only';
    logStatus(`Onglet actif détecté : ${tab.url}`, 'info');
    logStatus(`Périmètre : ${scopeLabels[scope] || scope}`, 'info');
    setLoading(analyzeBtn, true, 'Extraction du périmètre...', 'Capturer le périmètre');

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentPerTabAndFiles,
      args: [scope],
    });

    const pageData = injectionResult.result;
    if (!pageData) throw new Error("Aucune donnée retournée depuis la page.");

    logStatus(`Contenu extrait pour ${Object.keys(pageData.itinerary).filter(k => pageData.itinerary[k]).length} onglet(s) d'itinéraire.`, 'ok');
    if (pageData.tickets?.length) logStatus(`${pageData.tickets.length} ticket(s) capturé(s) selon le périmètre choisi.`, 'ok');
    if (pageData.collectionWarning) logStatus(`⚠ ${pageData.collectionWarning}`, 'warn');
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
    const structured = buildTripCardPayload(lastResult);
    logStatus(`✓ JSON structuré prêt : ${structured.services.length} prestation(s), ${structured.documents.length} document(s).`, 'ok');
    logStatus('Utilise Copier ou Télécharger pour importer ce dossier dans TripCard ELITE.', 'info');

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
  const payload = buildTripCardPayload(lastResult);
  await navigator.clipboard.writeText(JSON.stringify(payload));
  logStatus('✅ JSON TripCard ELITE copié. Va sur l’outil puis clique « Coller depuis le presse-papiers ».', 'ok');
});

downloadTripCardBtn.addEventListener('click', () => {
  if (!lastResult) { logStatus('⚠ Lance d’abord l’analyse de la TripCard.', 'err'); return; }
  const payload = buildTripCardPayload(lastResult);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `onspot-tripcard-${payload.reference || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  logStatus('✓ Fichier JSON téléchargé. Il peut être importé directement dans TripCard ELITE.', 'ok');
});

// =========================================================================
// Fonction injectée dans la page active — extraction PAR ONGLET
// =========================================================================
function extractPageContentPerTabAndFiles(scope = 'trip_only') {
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

    function activeTabElement() {
      return document.querySelector('[role="tab"][aria-selected="true"], [role="tab"].active, [role="tab"].is-active, button.active, button.is-active') || null;
    }

    // Détection des fichiers par type — accumulée au fil des clics, jamais réinitialisée
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
    const ticketScope = ['current_ticket', 'selected_tickets', 'trip_and_active_tickets', 'all_trip_tickets', 'section_tickets'].includes(scope) ? scope : null;
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
    if (ticketScope) {
      const current = isTicketPage ? extractCurrentTicket() : null;
      const ticketSectionRevealed = isTicketPage || await revealTicketsSection();
      const visible = extractVisibleTicketCards();
      const paginatedTickets = !isTicketPage && (scope === 'all_trip_tickets' || scope === 'selected_tickets' || scope === 'trip_and_active_tickets') ? await walkVisibleTicketPages() : [];
      const mergedVisible = paginatedTickets.length ? paginatedTickets : visible;

      if (scope === 'current_ticket') tickets = current ? [current] : (visible[0] ? [visible[0]] : []);
      else if (scope === 'selected_tickets') {
        const checked = document.querySelectorAll('[aria-selected="true"], input[type="checkbox"]:checked');
        const checkedCount = checked.length;
        const selected = mergedVisible.filter((_, index) => checkedCount === 0 || index < checkedCount);
        tickets = selected.length ? selected : (current ? [current] : []);
      } else if (scope === 'trip_and_active_tickets') tickets = (mergedVisible.length ? mergedVisible : (current ? [current] : [])).filter(ticketIsActive);
      else tickets = mergedVisible.length ? mergedVisible : (current ? [current] : []);
      if (!tickets.length) collectionWarning = 'Aucun ticket exploitable n’a été trouvé dans la page courante pour ce périmètre.';
      else if (!ticketSectionRevealed && !isTicketPage) collectionWarning = 'La section Tickets n’a pas pu être ouverte ; seuls les éléments déjà visibles ont été conservés.';
      else if ((scope === 'all_trip_tickets' || scope === 'trip_and_active_tickets') && !isTicketPage) collectionWarning = 'Les tickets visibles et les pages de pagination détectées ont été capturés ; les tickets non ouverts ou non chargés dans le DOM ne sont pas devinés.';
    }
    const ticket = tickets[0] || null;

    const itinerary = {};

    // 1) Cliquer sur l'onglet principal "Itinéraire" pour révéler ses sous-onglets
    const mainEl = findTabElement(mainTabDefs[0].labels);
    if (mainEl) {
      try {
        mainEl.click();
        await sleep(450);
        scanFilesOnCurrentDOM();
      } catch (e) {}
    }

    // 2) Chercher/cliquer chaque sous-onglet, maintenant qu'ils devraient être dans le DOM
    for (const def of subTabDefs) {
      const el = findTabElement(def.labels);
      if (el) {
        try {
          el.click();
          await sleep(450);
          itinerary[def.key] = (document.body.innerText || '').trim();
          scanFilesOnCurrentDOM();
        } catch (e) {
          itinerary[def.key] = null;
        }
      } else {
        itinerary[def.key] = null;
      }
    }

    // 3) Cliquer enfin sur l'onglet principal "Vouchers"
    const vouchersEl = findTabElement(vouchersTabDef.labels);
    if (vouchersEl) {
      try {
        vouchersEl.click();
        await sleep(450);
        itinerary[vouchersTabDef.key] = (document.body.innerText || '').trim();
        scanFilesOnCurrentDOM();
      } catch (e) {
        itinerary[vouchersTabDef.key] = null;
      }
    } else {
      itinerary[vouchersTabDef.key] = null;
    }

    // 4) Tickets et Rappels ne sont jamais ouverts : le contrôle pré-départ ne doit pas déplacer l’agent vers ces écrans.
    // L’extension conserve uniquement une présence passive observée dans le bandeau principal.
    try { if (originalTab && originalTab instanceof HTMLElement) { originalTab.click(); await sleep(120); } } catch (e) {}

    resolve({
      itinerary,
      initialSnapshot,
      ticketsPresence,
      pdfUrls: Array.from(pdfUrlSet),
      docxUrls: Array.from(docxUrlSet),
      xlsxUrls: Array.from(xlsxUrlSet),
      imageUrls: Array.from(imageUrlSet),
      ticket,
      scope,
      collectionWarning,
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

function extractStructuredServices(timeline, referenceText = '') {
  const lines = String(timeline || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sectionNames = new Set(['Hôtels', 'Vols', 'Activités', 'Transferts', 'Trains', 'Locations']);
  const monthPattern = /^(\d{1,2})\s+(janv?\.?|févr?\.?|mars|avr(?:il)?\.?|mai|juin|juil?\.?|août|sept?\.?|oct(?:obre)?\.?|nov(?:embre)?\.?|déc(?:embre)?)$/i;
  const months = { jan: '01', janv: '01', févr: '02', mars: '03', avr: '04', mai: '05', juin: '06', juil: '07', août: '08', sept: '09', oct: '10', nov: '11', déc: '12' };
  const year = (String(referenceText).match(/\b20\d{2}\b/) || String(timeline).match(/\b20\d{2}\b/) || [])[0] || new Date().getUTCFullYear();
  const services = []; let currentDate = null; let section = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]; const date = line.match(monthPattern);
    if (date) { const key = date[2].replace('.', '').slice(0, 4).toLowerCase(); const month = months[key] || months[key.slice(0, 3)]; currentDate = month ? `${year}-${month}-${date[1].padStart(2, '0')}` : null; section = null; continue; }
    if (sectionNames.has(line)) { section = line; continue; }
    if (!section || !currentDate || /^(Rechercher|Tableau|Trip_|Ajouter|Reminders|Notes|Services|Métadonnées|Tickets)/i.test(line)) continue;
    const type = serviceTypeFromSection(section); const hasTime = /^\d{1,2}:\d{2}$/.test(line); const title = hasTime ? lines[index + 1] : line; const next = hasTime ? lines[index + 2] : lines[index + 1]; const nextIsDate = monthPattern.test(next || ''); const location = nextIsDate && type === 'activity' ? 'Lieu non exporté dans la timeline' : next;
    if (!title || !location || sectionNames.has(title) || sectionNames.has(location)) continue;
    if (type === 'hotel' && !/,\s*[A-Z]{2}$/i.test(location)) continue;
    if (['transfer', 'train', 'flight'].includes(type) && !location.includes('→')) continue;
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
  const flightText = /compagnie émettrice|numéro de billet|votre e-ticket|boarding pass|carte d.?embarquement|flight itinerary/.test(content);
  const flightName = /(?:billet|e[-_ ]?ticket|flight|vol)[^a-z]{0,25}(?:avion|air|airlines?|dl|af|ba|lh)/.test(filename);
  if (flightText || (flightName && /(?:\b[A-Z]{2}\s?\d{2,4}\b|aéroport|airport|departure|arrivée|arrival)/i.test(file.text || ''))) return result('flight-plan', 'high', flightText ? 'Le contenu comporte un numéro de billet, une compagnie émettrice ou une preuve d’embarquement.' : 'Le nom et le contenu confirment un document aérien avec segment exploitable.');
  const identityName = /(?:^|[_\-\s])(passeport|passport|cni|carte[_\-\s]?(?:nationale[_\-\s]?)?d.?identit[eé])(?:[_\-\s.]|$)/.test(filename);
  const identityText = /(?:passport number|numéro de passeport|document number|numéro de document|^p<[a-z])/im.test(String(file.text || ''));
  if (identityName || identityText) return result('identity', identityName ? 'high' : 'medium', identityName ? 'Le fichier joint est explicitement nommé passeport ou CNI.' : 'Le contenu porte un identifiant propre à un document d’identité.');
  if (/(?:^|\n)\s*(?:hotel|hôtel)\s*:|type de chambre|room type|check.?in|plan repas/.test(content)) return result('hotel', 'high', 'Le contenu identifie un hôtel, une chambre ou des dates de séjour.');
  if (/pickup date|pickup time|dropoff address|limo|chauffeur|transfer|transfert|car rental|location de voiture|ferry|train/.test(content)) return result('transport', 'high', 'Le contenu identifie une prise en charge, un transport ou une location.');
  if (/tour\/activity|tour\/?activity|restaurant reservation|activity date|excursion|reservation confirmation/.test(content)) return result('activity', 'high', 'Le contenu identifie une activité ou une réservation de restaurant.');
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

function buildTripCardPayload({ pageData, pdfTexts, docxTexts, xlsxTexts }) {
  const allText = [pageData.initialSnapshot, ...Object.values(pageData.itinerary || {}).filter(Boolean)].join('\n\n');
  const reference = (allText.match(/Référence de réservation\s+([^\n]+)/i) || [])[1]?.trim() || (allText.match(/Trip\s+(\d{6,})/i) || [])[1] || 'sans-reference';
  const travelers = Array.from(new Set(Array.from(allText.matchAll(/\b(?:M\.|MR\.|Mme|MM\.)\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ'’-]+)/g)).map((match) => `${match[1]} ${match[2]}`)));
  const files = [
    ...pdfTexts.map((item) => ({ kind: 'pdf', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.pdf', text: item.text })),
    ...docxTexts.map((item) => ({ kind: 'docx', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.docx', text: item.text })),
    ...xlsxTexts.map((item) => ({ kind: 'xlsx', url: item.url, name: item.url.split('/').pop()?.split('?')[0] || 'voucher.xlsx', text: item.text })),
    ...pageData.imageUrls.map((url) => ({ kind: 'image', url, name: url.split('/').pop()?.split('?')[0] || 'image-jointe', text: '' }))
  ].map((file) => ({ ...file, ...classifyDocument(file) }));
  const profileNotes = Array.from(new Set((allText.match(/(?:VIP|Exigeant|anniversaire|birthday|allergie|mobilité réduite)[^\n]*/gi) || []).map(cleanText)));
  const services = extractStructuredServices(pageData.itinerary?.tous || '', pageData.initialSnapshot || '');
  const capturedTickets = Array.from(new Map((pageData.tickets || (pageData.ticket ? [pageData.ticket] : [])).map(ticket => [ticket.id || ticket.ticketNumber, { ...ticket, attachments: (ticket.attachments || []).map((attachment) => {
    const extracted = [...pdfTexts, ...docxTexts, ...xlsxTexts].find(item => item.url === attachment.url);
    return extracted ? { ...attachment, excerpt: extracted.text.slice(0, 6000), extractionStatus: extracted.text.startsWith('[ERREUR') ? 'error' : 'ok' } : attachment;
  }) }])).values());
  const ticketCorpus = capturedTickets.map(ticket => [ticket.current?.status, ticket.current?.priority, ticket.current?.category, ticket.current?.subject, ticket.conversationText, ...(ticket.messages || []).map(message => message.text), ...(ticket.events || []).map(event => event.summary)].filter(Boolean).join('\n')).join('\n');
  const elitePlan = buildEliteOperationalPlan({ allText: `${allText}\n${ticketCorpus}`, files, services, tickets: capturedTickets });
  return {
    schemaVersion: '3.1.0', source: 'onspot-audit-assistant', generatedAt: new Date().toISOString(), pageUrl: pageData.pageUrl, pageTitle: pageData.pageTitle,
    collection: { scope: pageData.scope || 'trip_only', collectionStatus: pageData.collectionWarning ? 'partial' : 'complete', capturedAt: new Date().toISOString(), warnings: pageData.collectionWarning ? [pageData.collectionWarning] : [], visibleOnly: true },
    reference, travelers, destination: (allText.match(/(?:Destination|Pays|Country)\s*[:\n]?\s*([^\n]+)/i) || [])[1]?.trim() || null,
    metadata: { agency: (allText.match(/AGENCE\s+([^\n]+)/i) || [])[1]?.trim() || null, tripId: (allText.match(/ID\s+(trip_[^\n]+)/i) || [])[1]?.trim() || null, profileNotes, ticketsPresence: pageData.ticketsPresence || { detected: false, count: null, evidence: 'Non observé.' }, ticketsText: capturedTickets.map(ticket => ticket.conversationText || '').filter(Boolean).join('\n\n'), captureScope: pageData.scope || 'trip_only', ticketCount: capturedTickets.length, elite: elitePlan },
    elite: elitePlan,
    tickets: capturedTickets,
    services, documents: files.map(({ text, ...file }) => ({ ...file, extractionStatus: text.startsWith('[ERREUR') ? 'error' : 'ok', excerpt: text.slice(0, 1500) })),
    documentCoverage: { flightPlans: files.filter((file) => file.category === 'flight-plan').length, identities: files.filter((file) => file.category === 'identity').length, hotels: files.filter((file) => file.category === 'hotel').length, transports: files.filter((file) => file.category === 'transport').length, activities: files.filter((file) => file.category === 'activity').length, unclassified: files.filter((file) => file.category === 'other').length },
    itinerary: pageData.itinerary, vouchersSummary: buildVouchersSummaryText({ pageData, pdfTexts, docxTexts, xlsxTexts })
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
