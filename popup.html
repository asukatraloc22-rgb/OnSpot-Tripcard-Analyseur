// =========================================================================
// OnSpot Audit Assistant — popup.js
// =========================================================================

const analyzeBtn = document.getElementById('analyzeBtn');
const statusBox = document.getElementById('status');

// Configure pdf.js worker (le fichier pdf.worker.min.js doit être local, voir instructions)
if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
}

function logStatus(message, type = 'info') {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = message;
  statusBox.appendChild(line);
  statusBox.scrollTop = statusBox.scrollHeight;
}

function clearStatus() {
  statusBox.innerHTML = '';
}

function setLoading(isLoading, label) {
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    analyzeBtn.innerHTML = `<span class="spinner"></span>${label || 'Analyse en cours...'}`;
  } else {
    analyzeBtn.textContent = 'Analyser Page + Vouchers PDF';
  }
}

analyzeBtn.addEventListener('click', async () => {
  clearStatus();
  setLoading(true, 'Ouverture de la page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("Impossible de récupérer l'onglet actif.");
    }

    logStatus('Onglet actif détecté : ' + tab.url, 'info');

    // Étape 1 : Cliquer sur les onglets de l'itinéraire et récupérer texte + PDFs
    setLoading(true, 'Extraction de la Tripcard...');
    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentAndPdfUrls,
    });

    const pageData = injectionResult.result;
    if (!pageData) {
      throw new Error("Aucune donnée retournée depuis la page.");
    }

    logStatus(`Texte de la Tripcard extrait (${pageData.tripcardText.length} caractères).`, 'ok');
    logStatus(`${pageData.pdfUrls.length} PDF(s) détecté(s) sur la page.`, 'info');
    pageData.pdfUrls.forEach((url, i) => logStatus(`  [${i + 1}] ${url}`, 'info'));

    // Étape 2 : Télécharger + extraire le texte de chaque PDF
    const pdfTexts = [];
    for (let i = 0; i < pageData.pdfUrls.length; i++) {
      const url = pageData.pdfUrls[i];
      setLoading(true, `PDF ${i + 1}/${pageData.pdfUrls.length}...`);
      try {
        const text = await extractPdfTextFromUrl(url);
        pdfTexts.push({ url, text });
        logStatus(`✓ PDF ${i + 1} extrait (${text.length} caractères).`, 'ok');
      } catch (err) {
        logStatus(`✗ Échec extraction PDF ${i + 1} (${url}) : ${err.message}`, 'err');
        pdfTexts.push({ url, text: '[ERREUR: extraction impossible pour ce fichier]' });
      }
    }

    // Étape 3 : Construire le prompt d'audit
    setLoading(true, 'Construction du prompt...');
    const finalPrompt = buildAuditPrompt(pageData, pdfTexts);

    // Étape 4 : Copier dans le presse-papier
    await navigator.clipboard.writeText(finalPrompt);
    logStatus('✅ Prompt d\'audit copié dans le presse-papier !', 'ok');
    logStatus(`Longueur totale du prompt : ${finalPrompt.length} caractères.`, 'info');

  } catch (err) {
    console.error(err);
    logStatus('Erreur : ' + err.message, 'err');
  } finally {
    setLoading(false);
  }
});

// =========================================================================
// Fonction injectée dans la page active (contexte DOM de la page OnSpot)
// =========================================================================
function extractPageContentAndPdfUrls() {
  return new Promise(async (resolve) => {
    // Libellés d'onglets à cliquer pour révéler tout le contenu de l'itinéraire
    const tabLabels = [
      'Hôtels', 'Hotels', 'Hôtel', 'Hotel',
      'Vols', 'Vol', 'Flights', 'Flight',
      'Activités', 'Activité', 'Activities', 'Activity',
      'Locations', 'Location de voiture', 'Car rental', 'Cars',
      'Transferts', 'Transfert', 'Transfers', 'Transfer',
      'Trains', 'Train'
    ];

    function sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    function findClickableTabs() {
      const candidates = Array.from(
        document.querySelectorAll('button, a, [role="tab"], li, div[class*="tab" i]')
      );
      const matches = [];
      for (const el of candidates) {
        const text = (el.textContent || '').trim();
        if (!text || text.length > 40) continue;
        for (const label of tabLabels) {
          if (text.toLowerCase() === label.toLowerCase() ||
              text.toLowerCase().includes(label.toLowerCase())) {
            matches.push(el);
            break;
          }
        }
      }
      // Dédupliquer
      return Array.from(new Set(matches));
    }

    const tabsToClick = findClickableTabs();

    // Cliquer séquentiellement sur chaque onglet trouvé pour révéler le contenu
    for (const el of tabsToClick) {
      try {
        el.click();
        await sleep(350); // laisser le temps au contenu de se charger/afficher
      } catch (e) {
        // ignorer les erreurs de clic individuelles
      }
    }

    // Laisser un délai final pour que tout rendu asynchrone se termine
    await sleep(500);

    // Récupérer tout le texte visible de la page (Tripcard)
    const tripcardText = document.body.innerText || document.body.textContent || '';

    // Détecter les URLs de PDF sur la page
    const pdfUrlSet = new Set();

    // 1. Liens <a href="...pdf">
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      if (href && /\.pdf($|\?)/i.test(href)) {
        pdfUrlSet.add(href);
      }
    });

    // 2. Liens contenant "voucher" ou "download" pointant potentiellement vers un PDF
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      const text = (a.textContent || '').toLowerCase();
      if (href && (text.includes('voucher') || text.includes('bon') || href.toLowerCase().includes('voucher'))) {
        pdfUrlSet.add(href);
      }
    });

    // 3. Attributs data-* susceptibles de contenir une URL de PDF
    document.querySelectorAll('[data-url], [data-href], [data-pdf], [data-file]').forEach((el) => {
      const val = el.getAttribute('data-url') || el.getAttribute('data-href') ||
                  el.getAttribute('data-pdf') || el.getAttribute('data-file');
      if (val && /\.pdf($|\?)/i.test(val)) {
        try {
          pdfUrlSet.add(new URL(val, window.location.href).href);
        } catch (e) {}
      }
    });

    // 4. Balises <embed> / <iframe> / <object> pointant vers un PDF
    document.querySelectorAll('embed[src], iframe[src], object[data]').forEach((el) => {
      const src = el.getAttribute('src') || el.getAttribute('data');
      if (src && /\.pdf($|\?)/i.test(src)) {
        try {
          pdfUrlSet.add(new URL(src, window.location.href).href);
        } catch (e) {}
      }
    });

    resolve({
      tripcardText: tripcardText.trim(),
      pdfUrls: Array.from(pdfUrlSet),
      pageUrl: window.location.href,
      pageTitle: document.title
    });
  });
}

// =========================================================================
// Téléchargement + extraction de texte d'un PDF via pdf.js (contexte popup)
// =========================================================================
async function extractPdfTextFromUrl(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} lors du téléchargement.`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
  }

  return fullText.trim();
}

// =========================================================================
// Construction du prompt d'audit final
// =========================================================================
function buildAuditPrompt(pageData, pdfTexts) {
  const vouchersSection = pdfTexts.map((p, i) => {
    return `\n### VOUCHER ${i + 1}\nSource : ${p.url}\n\nContenu extrait :\n${p.text}\n`;
  }).join('\n---------------------------------------------\n');

  return `# AUDIT DE COHÉRENCE — DOSSIER DE VOYAGE ONSPOT

Tu es un auditeur expert spécialisé dans la vérification de dossiers de voyage (agences, tour-opérateurs). Ta mission est de comparer, ligne par ligne, les informations de la TRIPCARD (page de résumé du dossier) avec le contenu de chaque VOUCHER PDF fourni ci-dessous, et de signaler la moindre incohérence.

## CONTEXTE DU DOSSIER
- Page source : ${pageData.pageUrl}
- Titre de la page : ${pageData.pageTitle}
- Nombre de vouchers PDF analysés : ${pdfTexts.length}

## POINTS DE CONTRÔLE À VÉRIFIER SYSTÉMATIQUEMENT
1. **Noms des voyageurs** : orthographe exacte, prénom/nom dans le bon ordre, nombre de voyageurs cohérent entre Tripcard et chaque voucher.
2. **Dates** : dates de check-in/check-out, dates de vol, dates d'activité — doivent correspondre exactement entre la Tripcard et les vouchers.
3. **Prestations réservées** : type de chambre, catégorie de vol, type de transfert, activité réservée — doivent être identiques dans les deux sources.
4. **Régimes alimentaires / allergies** : toute mention de régime spécial, allergie, ou préférence alimentaire doit être reportée à l'identique sur tous les documents concernés. Signale toute mention présente sur un document mais absente d'un autre.
5. **Nombre de personnes / répartition par chambre ou par réservation** : vérifie la cohérence des effectifs.
6. **Références de réservation / numéros de confirmation** : vérifie qu'ils sont cohérents ou correctement mappés entre Tripcard et vouchers.
7. **Adresses et lieux** : hôtels, aéroports, points de rendez-vous — cohérence des noms et adresses.
8. **Horaires** : heures de vol, heures de transfert, heures de check-in/out.
9. **Statut de paiement / mentions "payé"/"à payer"** si présentes.
10. **Éléments manquants** : signale si un service mentionné dans la Tripcard n'a aucun voucher correspondant, ou inversement.

## FORMAT DE RÉPONSE ATTENDU
Produis un rapport structuré avec :
- Un tableau récapitulatif des incohérences trouvées (colonne : Type d'anomalie | Tripcard | Voucher concerné | Détail)
- Une section "Points critiques" (erreurs pouvant affecter le voyageur : mauvaise date, mauvais nom, allergie non reportée)
- Une section "Points mineurs" (différences de formulation sans impact)
- Une conclusion : dossier "conforme" ou "à corriger avant envoi au client", avec la liste des corrections nécessaires.

---

## CONTENU DE LA TRIPCARD (texte brut extrait de la page)

${pageData.tripcardText}

---

## CONTENU DES VOUCHERS PDF EXTRAITS
${vouchersSection || '\n(Aucun voucher PDF détecté sur cette page.)\n'}

---

Effectue maintenant l'audit complet en suivant scrupuleusement les points de contrôle listés ci-dessus.
`;
}
