// =========================================================================
// OnSpot Audit Assistant — compact.js
// Transforme la capture brute (page + vouchers) en un « dossier compact »
// Markdown, prêt à coller dans un Gem Gemini ou une conversation Claude.
// Module pur : aucune dépendance au DOM, testable sous Node.
// =========================================================================

const SIDEBAR_FIELDS = [
  ['pays', /^PAYS$/],
  ['dates', /^DATES DE TRIP$/],
  ['agence', /^AGENCE$/],
  ['voyageurs', /^VOYAGEURS$/],
  ['forfait', /^FORFAIT$/],
];

// Blocs du panneau latéral OnSpot, dans l'ordre d'apparition.
const SIDEBAR_BLOCKS = [
  ['rappels', /^Reminders$/i],
  ['voyageurs', /^Voyageurs\s*\(\d+\)/i],
  ['notes', /^Notes$/i],
  ['interne', /^Interne\s*[—-]\s*OnSpot uniquement$/i],
  ['services', /^Services du trip$/i],
  ['tickets', /^Tickets\s*\(\d+\)$/i],
  ['metadonnees', /^Métadonnées$/i],
];

const NAV_LINES = new Set(['Rechercher', 'CtrlK', 'Tableau de bord', 'Trips', 'Tickets', 'Rappels', 'Télécharger la Trip Card', 'Ajouter un ticket', 'Annuler le trip', 'Ajouter un voucher', 'Add reminder', 'Itinéraire', 'Vouchers', 'Activité']);

// Phrases génériques des vouchers, sans valeur pour l'audit.
const BOILERPLATE = [
  /GetYourGuide Deutschland GmbH/i, /Managing directors/i, /Registered at District Court/i, /VAT ID/i,
  /privacy[ _]policy/i, /processes your personal data/i, /right to access, rectify/i, /^DISCLAIMER/i,
  /This is your GetYourGuide ticket/i, /go paperless/i, /Find out more on the other page/i,
  /^Page \d+ of \d+$/i, /^Need help\?$/i, /customer service 24\/7/i, /^Manage your booking$/i,
  /^What to remember$/i, /gyg\.me\/app/i, /terms and conditions|conditions générales/i,
];

// Indices qu'une phrase porte un fait vérifiable (date, heure, référence, contact, lieu de RDV…).
const SIGNAL = /\d|@|booking|reference|référence|confirmation|PIN|voucher|meeting|rendez-vous|RDV|pick ?up|drop ?off|prise en charge|address|adresse|via |piazza|street|rue |phone|tél|tel\.|mobile|whatsapp|email|contact|reconfirm|adult|child|enfant|adulte|person|pax|passenger|passager|guest|traveller|traveler|driver|chauffeur|guide|provider|prestataire|hotel|hôtel|check-?in|check-?out|depart|arriv|flight|vol |train|transfer|transfert|cancel|annul|allerg|vegetarian|végé|wheelchair|luggage|bagage/i;

// Filtre strict appliqué quand un document dépasse son budget : on ne garde que les phrases
// qui portent une date, une heure, une référence, un contact ou un nom de prestation.
const STRICT_SIGNAL = /\b\d{1,2}[:h]\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s*(?:th|st|nd|rd)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|avr|mai|juin|juil|août|sept|déc)|\d{1,2}\/\d{1,2}|booking|reference|référence|confirmation|\bPIN\b|meeting|rendez-vous|pick ?up|prise en charge|phone|tél|mobile|e-?mail|@|whatsapp|reconfirm|hotel|hôtel|travel+ers?|voyageurs?|adults?|adultes?|check-?in|check-?out|flight|\bvol\b|train|transfer|transfert|cancel|annul|allerg|provider|prestataire|driver|chauffeur|guide\b/i;

const MAX_VOUCHER_CHARS = 3500;
const MAX_ROADBOOK_CHARS = 18000;
const MAX_SEGMENT_CHARS = 450;
const MAX_STRICT_SEGMENT_CHARS = 280;
const UNREADABLE_THRESHOLD = 40;

export function lines(text) {
  return String(text || '').split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// -------------------------------------------------------------------------
// Panneau latéral / bandeau OnSpot
// -------------------------------------------------------------------------
export function parseSidebar(snapshot) {
  const all = lines(snapshot);
  const fields = {};
  for (const [key, pattern] of SIDEBAR_FIELDS) {
    const index = all.findIndex(line => pattern.test(line));
    if (index < 0) continue;
    const values = [];
    for (let i = index + 1; i < all.length && values.length < 5; i += 1) {
      if (SIDEBAR_FIELDS.some(([, p]) => p.test(all[i])) || NAV_LINES.has(all[i])) break;
      values.push(all[i]);
    }
    fields[key] = values.join(' ').replace(/\s*→\s*/g, ' → ');
  }

  const starts = SIDEBAR_BLOCKS.map(([key, pattern]) => ({ key, index: all.findIndex(line => pattern.test(line)) })).filter(entry => entry.index >= 0).sort((a, b) => a.index - b.index);
  const blocks = {};
  starts.forEach((entry, position) => {
    const end = position + 1 < starts.length ? starts[position + 1].index : all.length;
    blocks[entry.key] = all.slice(entry.index, end);
  });

  // Liste des vouchers affichée sur la page : noms entre « Ajouter un voucher » et « Reminders ».
  const voucherStart = all.indexOf('Ajouter un voucher');
  const voucherEnd = starts.find(entry => entry.key === 'rappels')?.index ?? -1;
  const voucherNames = voucherStart >= 0 && voucherEnd > voucherStart
    ? all.slice(voucherStart + 1, voucherEnd).filter(line => !/^\d+(?:[.,]\d+)?\s*(?:KB|MB|Ko|Mo)$/i.test(line))
    : [];

  return { fields, blocks, voucherNames, reference: (snapshot.match(/\bTrip\s+(\d{6,})\b/) || [])[1] || null };
}

export function parseTravelers(block = []) {
  const travelers = [];
  let current = null;
  for (const line of block.slice(1)) {
    const name = line.match(/^(M\.|Mme|Mr\.?|Mrs\.?|Ms\.?|Mlle|Dr\.?)\s+(.+)$/);
    if (name) { current = { civilite: name[1], nom: name[2], infos: [] }; travelers.push(current); continue; }
    if (current) current.infos.push(line);
  }
  return travelers.map(traveler => ({
    ...traveler,
    emails: traveler.infos.filter(info => /@/.test(info)),
    telephones: traveler.infos.filter(info => /^\+?[\d ()./-]{7,}$/.test(info)),
    autres: traveler.infos.filter(info => !/@/.test(info) && !/^\+?[\d ()./-]{7,}$/.test(info)),
  }));
}

// -------------------------------------------------------------------------
// Onglets d'itinéraire : on retire la coque OnSpot répétée dans chaque onglet.
// -------------------------------------------------------------------------
export function cleanItineraryTabs(itinerary = {}, snapshot = '') {
  const entries = Object.entries(itinerary).filter(([, value]) => value && String(value).trim());
  const counts = new Map();
  for (const [, value] of entries) for (const line of new Set(lines(value))) counts.set(line, (counts.get(line) || 0) + 1);
  const shell = new Set(lines(snapshot));
  const repeatedThreshold = entries.length >= 3 ? entries.length : Infinity;
  const result = {};
  for (const [key, value] of entries) {
    const kept = lines(value).filter(line => !NAV_LINES.has(line) && !shell.has(line) && (counts.get(line) || 0) < repeatedThreshold);
    if (kept.length) result[key] = kept.join('\n');
  }
  return result;
}

// -------------------------------------------------------------------------
// Vouchers
// -------------------------------------------------------------------------
export function voucherName(url) {
  const file = decodeURIComponent(String(url || '').split('/').pop()?.split('?')[0] || 'document');
  return file.replace(/^\d{10,}-/, '').replace(/_/g, ' ');
}

export function probableType(name, text = '') {
  const value = `${name} ${String(text).slice(0, 600)}`.toLowerCase();
  if (/passport|passeport|\bcni\b|identit/.test(name.toLowerCase())) return 'identité';
  if (/travel document|roadbook|carnet|itinerary|itinéraire/.test(name.toLowerCase())) return 'carnet de voyage';
  if (/\btrain\b|trenitalia|italo|sncf|öresundståg|\bsj\b/.test(name.toLowerCase())) return 'train';
  if (/shuttle|transfer|transfert|driver|chauffeur|taxi|pick ?up/.test(name.toLowerCase())) return 'transfert';
  if (/hotel|hôtel|resort|lodge/.test(name.toLowerCase())) return 'hôtel';
  if (/boarding|e-?ticket|flight|\bvol\b/.test(name.toLowerCase())) return 'vol';
  if (/car rental|location de voiture|hertz|avis|europcar|sixt/.test(value)) return 'location voiture';
  if (/ferry|boat|bateau/.test(name.toLowerCase())) return 'bateau';
  return 'activité';
}

function segmentsOf(text) {
  return String(text || '')
    .replace(/---\s*(?:Page|Feuille)\s*:?\s*[^-\n]*---/gi, '\n')
    .split(/\n+|\s{2,}|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)
    .map(segment => segment.replace(/\s+/g, ' ').trim())
    .filter(segment => segment.length > 1);
}

// seen : Set partagé entre tous les vouchers pour supprimer les répétitions
// (pages dupliquées, CGV répétées, carnet de voyage qui recopie les vouchers).
export function compactVoucher(text, seen = new Set(), budget = MAX_VOUCHER_CHARS) {
  const raw = String(text || '');
  if (raw.startsWith('[ERREUR')) return { status: 'erreur', text: '', rawChars: raw.length };
  const segments = segmentsOf(raw).filter(segment => !BOILERPLATE.some(pattern => pattern.test(segment)));
  const readableChars = segments.join(' ').length;
  if (readableChars < UNREADABLE_THRESHOLD) return { status: 'illisible', text: '', rawChars: raw.length };

  const unique = [];
  for (const segment of segments) {
    const key = normalizeKey(segment);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(segment.length > MAX_SEGMENT_CHARS ? `${segment.slice(0, MAX_SEGMENT_CHARS)}…` : segment);
  }
  let kept = unique;
  if (kept.join(' ').length > budget) kept = kept.filter(segment => SIGNAL.test(segment));
  if (kept.join(' ').length > budget) kept = kept.filter(segment => STRICT_SIGNAL.test(segment)).map(segment => segment.length > MAX_STRICT_SEGMENT_CHARS ? `${segment.slice(0, MAX_STRICT_SEGMENT_CHARS)}…` : segment);
  let output = kept.join(' · ');
  let truncated = false;
  if (output.length > budget * 1.5) { output = `${output.slice(0, Math.round(budget * 1.5))}… [suite tronquée]`; truncated = true; }
  return { status: unique.length ? 'ok' : 'doublon', text: output, rawChars: raw.length, truncated };
}

// -------------------------------------------------------------------------
// Dossier complet
// -------------------------------------------------------------------------
export function estimateTokens(text) {
  return Math.round(String(text || '').length / 3.6);
}

export function buildCompactDossier({ pageData, pdfTexts = [], docxTexts = [], xlsxTexts = [], version = '' }) {
  const snapshot = pageData.initialSnapshot || '';
  const sidebar = parseSidebar(snapshot);
  const travelers = parseTravelers(sidebar.blocks.voyageurs);
  const tabs = cleanItineraryTabs(pageData.itinerary || {}, snapshot);
  const warnings = [];
  const out = [];
  const push = (...items) => out.push(...items);
  const block = key => (sidebar.blocks[key] || []).slice(1).filter(line => !/^(?:Add reminder|Ajouter un (?:rappel|voucher|ticket))$/i.test(line) && !/^\d+$/.test(line));

  const reference = sidebar.reference ? `Trip ${sidebar.reference}` : (pageData.structured?.title || pageData.pageTitle || 'Trip sans référence');
  push(`# DOSSIER ONSPOT — ${reference}`, '');
  push(`Capture : ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · OnSpot Audit Assistant ${version} · ${pageData.pageUrl || ''}`, '');

  // Lecture structurée de la carte (extension ≥ 2.4) quand elle existe, sinon analyse du texte de la page.
  const st = pageData.structured && !pageData.structured.error ? pageData.structured : null;
  const hasStructuredItinerary = Boolean(st?.itinerary?.some(day => day.rows?.length));

  push('## 1. Fiche dossier');
  const f = { ...sidebar.fields, ...Object.fromEntries(Object.entries(st?.header || {}).filter(([, value]) => value)) };
  push(`- Pays : ${f.pays || '(non visible)'}`, `- Dates du trip : ${f.dates || '(non visibles)'}`, `- Agence : ${f.agence || '(non visible)'}`, `- Forfait : ${f.forfait || '(non visible)'}`, '');

  const travelerList = st?.travelers?.length
    ? st.travelers.map(traveler => ({ label: traveler.name, emails: traveler.emails || [], phones: traveler.phones || [], extra: traveler.badges || [] }))
    : travelers.map(traveler => ({ label: `${traveler.civilite} ${traveler.nom}`, emails: traveler.emails, phones: traveler.telephones, extra: traveler.autres }));
  push(`## 2. Voyageurs (${travelerList.length})`);
  if (!travelerList.length) { push('- (aucun voyageur lisible dans le panneau Voyageurs)'); warnings.push('Voyageurs non lus dans le panneau latéral.'); }
  travelerList.forEach(traveler => {
    const details = [
      traveler.emails.length ? `email : ${traveler.emails.join(', ')}` : 'email : (absent)',
      traveler.phones.length ? `tél : ${traveler.phones.join(', ')}` : 'tél : (absent)',
      ...traveler.extra,
    ];
    push(`- ${traveler.label} — ${details.join(' · ')}`);
  });
  push('');

  const notes = st ? st.notes || [] : block('notes');
  const internal = st ? lines(st.internal) : block('interne');
  push('## 3. Notes de l’agence', ...(notes.length ? notes.flatMap(note => lines(note)).map(line => `> ${line}`) : ['(aucune note)']), '');
  push('## 4. Interne — OnSpot uniquement', ...(internal.length ? internal : ['(vide)']), '');
  push('## 5. Rappels déjà en place (heure de l’agent, puis heure dans le fuseau indiqué)');
  if (st?.reminders?.length) {
    st.reminders.forEach(reminder => push(`- ${reminder.join(' · ')}`));
    if (st.completedReminders) push(`- (${st.completedReminders} rappel(s) déjà terminé(s), non détaillés)`);
  } else push(...(block('rappels').length ? block('rappels').map(line => `- ${line}`) : ['(aucun rappel visible)']));
  push('');
  const services = st?.services?.length ? st.services : block('services');
  push('## 6. Services du trip', ...(services.length ? [services.join(' · ')] : ['(non visibles)']), '');

  if (st?.tickets?.length) {
    push(`## 7. Tickets (${st.tickets.length})`);
    st.tickets.forEach(ticket => {
      const [category, ...rest] = ticket.lines;
      const hasMessage = rest.length > 1 && rest[rest.length - 1].length > 40;
      const message = hasMessage ? rest[rest.length - 1] : '';
      const meta = (hasMessage ? rest.slice(0, -1) : rest).join(' · ');
      push(`- [${category}] ${meta}`, message ? `  ${message.slice(0, 1500)}` : '');
    });
  } else {
    push(`## 7. Tickets${sidebar.blocks.tickets ? ` ${sidebar.blocks.tickets[0].replace(/^Tickets\s*/, '')}` : ''}`);
    const ticketLines = block('tickets');
    if (ticketLines.length) {
      // Chaque ticket : en-tête court (catégorie, priorité, statut, assignation), ligne « #numéro · date · … », puis le message.
      const hashIndexes = ticketLines.map((line, index) => (/^#\d+/.test(line) ? index : -1)).filter(index => index >= 0);
      const headerStart = hashIndex => {
        let start = hashIndex;
        while (start > 0 && hashIndex - start < 4 && ticketLines[start - 1].length <= 30 && !/^#\d+/.test(ticketLines[start - 1])) start -= 1;
        return start;
      };
      const starts = hashIndexes.map(headerStart);
      hashIndexes.forEach((hashIndex, position) => {
        const end = position + 1 < starts.length ? starts[position + 1] : ticketLines.length;
        const header = ticketLines.slice(starts[position], hashIndex).join(' · ');
        const body = ticketLines.slice(hashIndex + 1, end).join(' ');
        push(`- [${header}] ${ticketLines[hashIndex]}`, body ? `  ${body.slice(0, 1500)}` : '');
      });
    } else push('(aucun ticket visible)');
  }
  if (Array.isArray(pageData.tickets) && pageData.tickets.length) {
    push('', '### Tickets ouverts par l’extension');
    pageData.tickets.forEach(ticket => push(`- #${ticket.ticketNumber} · ${ticket.status} · ${ticket.subject || ''}`, ticket.conversationText ? `  ${ticket.conversationText.replace(/\s+/g, ' ').slice(0, 1500)}` : ''));
  }
  push('');

  let tabKeys = [];
  let itineraryRows = 0;
  if (hasStructuredItinerary) {
    push('## 8. Itinéraire de la carte OnSpot (jour par jour)');
    push('Format : heure · type · prestation — détails · voucher lié · statut', '');
    st.itinerary.forEach(day => {
      if (!day.rows?.length) return;
      push(`### ${day.label || day.date}${day.date && day.date !== day.label ? ` (${day.date})` : ''}`);
      day.rows.forEach(row => {
        itineraryRows += 1;
        const parts = [row.time || '—', row.type || '?', row.title || '(sans titre)'];
        const details = (row.details || []).join(' | ');
        push(`- ${parts.join(' · ')}${details ? ` — ${details}` : ''}${row.voucher ? ` · voucher : ${row.voucher}` : ' · ⚠ aucun voucher lié'}${row.status ? ` · ${row.status}` : ''}`);
      });
      push('');
    });
  } else {
    push('## 8. Itinéraire OnSpot (onglets)');
    const tabLabels = { tous: 'Tous', hotels: 'Hôtels', vols: 'Vols', activites: 'Activités', locations: 'Locations de voiture', transferts: 'Transferts', trains: 'Trains', vouchersTab: 'Onglet Vouchers' };
    tabKeys = Object.keys(tabs).filter(key => key !== 'vouchersTab');
    if (!tabKeys.length) {
      push('⚠ Les onglets détaillés de l’itinéraire n’ont pas été capturés : la chronologie doit être reconstruite depuis les vouchers et le carnet de voyage.');
      warnings.push('Onglets d’itinéraire OnSpot non capturés (horaires et détails de la carte OnSpot absents).');
    }
    tabKeys.forEach(key => push(`### ${tabLabels[key] || key}`, tabs[key], ''));
  }
  push('');

  const files = [
    ...pdfTexts.map(item => ({ ...item, kind: 'PDF' })),
    ...docxTexts.map(item => ({ ...item, kind: 'DOCX' })),
    ...xlsxTexts.map(item => ({ ...item, kind: 'XLSX' })),
  ].map(item => ({ ...item, name: voucherName(item.url) }));
  // Le carnet de voyage passe en dernier : ce qu'il recopie des vouchers individuels est alors déjà vu et retiré.
  files.sort((a, b) => (probableType(a.name, a.text) === 'carnet de voyage') - (probableType(b.name, b.text) === 'carnet de voyage'));
  const seen = new Set();
  const compacted = files.map(file => {
    const type = probableType(file.name, file.text);
    return { ...file, type, ...compactVoucher(file.text, seen, type === 'carnet de voyage' ? MAX_ROADBOOK_CHARS : MAX_VOUCHER_CHARS) };
  });
  const unreadable = compacted.filter(file => file.status === 'illisible' || file.status === 'erreur');

  push(`## 9. Vouchers (${compacted.length})`);
  push('| # | Document | Type probable | Lecture |', '|---|---|---|---|');
  compacted.forEach((file, index) => push(`| ${index + 1} | ${file.name} | ${file.type} | ${file.status === 'ok' ? 'texte lu' : file.status === 'illisible' ? '⚠ ILLISIBLE (scan ou image)' : file.status === 'erreur' ? '⚠ ERREUR de téléchargement' : 'contenu déjà présent ailleurs'} |`));
  push('');
  compacted.forEach((file, index) => {
    if (file.status !== 'ok') return;
    push(`### V${index + 1} · ${file.name} (${file.type})`, file.text, '');
  });
  const identityDocs = compacted.filter(file => file.type === 'identité');
  if (!identityDocs.length) warnings.push('Aucun passeport ou pièce d’identité parmi les documents joints.');
  compacted.filter(file => file.truncated).forEach(file => warnings.push(`${file.name} a été tronqué : vérifier la fin du document à l’œil.`));
  if (unreadable.length) warnings.push(`${unreadable.length} voucher(s) sans texte lisible : ${unreadable.map(file => file.name).join(', ')}. Les ouvrir à l’œil ou les joindre en PDF à la conversation.`);
  const missingFromPage = sidebar.voucherNames.filter(name => !compacted.some(file => normalizeKey(file.name).includes(normalizeKey(name).replace(/ pdf$/, '')) || normalizeKey(name).includes(normalizeKey(file.name).replace(/ pdf$/, ''))));
  if (missingFromPage.length) warnings.push(`${missingFromPage.length} voucher(s) listé(s) sur la page mais non téléchargé(s) : ${missingFromPage.slice(0, 4).join(', ')}${missingFromPage.length > 4 ? '…' : ''}.`);

  push('## 10. Limites de la capture (à prendre en compte, ne pas interpréter comme des anomalies du voyage)');
  push(...(warnings.length ? warnings.map(item => `- ${item}`) : ['- Aucune limite détectée.']));

  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return {
    text,
    stats: {
      reference,
      travelers: travelerList.map(traveler => traveler.label.replace(/^(?:M\.|Mme|Mr\.?|Mrs\.?|Ms\.?|Mlle)\s+/, '')),
      dates: f.dates || null,
      vouchers: compacted.length,
      unreadable: unreadable.map(file => file.name),
      itineraryTabs: tabKeys.length,
      itineraryRows,
      rawChars: snapshot.length + Object.values(pageData.itinerary || {}).join('').length + files.reduce((sum, file) => sum + String(file.text || '').length, 0),
      compactChars: text.length,
      tokens: estimateTokens(text),
      warnings,
    },
  };
}
