document.getElementById('extractBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  document.getElementById('status').innerText = "⏳ Extraction complète en cours...";

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractAllTripData
  }, (results) => {
    if (results && results[0] && results[0].result) {
      navigator.clipboard.writeText(results[0].result);
      document.getElementById('status').innerText = "✅ Analyse complète copiée !";
    } else {
      document.getElementById('status').innerText = "❌ Erreur lors de la lecture";
    }
  });
});

async function extractAllTripData() {
  // 1. Cibler et cliquer automatiquement sur tous les onglets de la section Itinéraire
  // (Hôtels, Vols, Activités, Locations, Transferts, Trains) ainsi que les sections repliées
  const buttonsAndTabs = document.querySelectorAll('button, [role="tab"], .tab, a[href*="#"]');
  
  buttonsAndTabs.forEach(el => {
    // Vérifie si l'élément correspond à un onglet ou un bouton d'affichage
    const text = el.innerText.toLowerCase();
    if (
      text.includes('hôtel') || 
      text.includes('vol') || 
      text.includes('activité') || 
      text.includes('location') || 
      text.includes('transfert') || 
      text.includes('train') ||
      text.includes('plus') ||
      text.includes('voir')
    ) {
      try {
        el.click();
      } catch (e) {
        // Ignorer si l'élément n'est pas cliquable
      }
    }
  });

  // 2. Attendre 600 ms pour que le DOM se mette à jour après les clics
  await new Promise(resolve => setTimeout(resolve, 600));

  // 3. Extraire l'intégralité du texte visible de la page enrichie
  let fullText = document.body.innerText;

  // 4. Structurer le prompt pour DeepSeek
  let prompt = `Tu es un assistant expert en audit et conciergerie de voyage.
Analyse en détail l'intégralité de cette fiche Tripcard OnSpot.

TON OBJECTIF :
1. **Contrôle de cohérence global :** Vérifie si l'itinéraire reconstruit sur la Tripcard (Hôtels, Vols, Activités, Transferts, Trains) correspond parfaitement aux vouchers, dates et notes d'agence.
2. **Recherche d'anomalies / Manques :** Détecte toute incohérence de dates, de noms de voyageurs, d'heures, de prestations manquantes ou de régimes alimentaires/allergies non pris en compte.
3. **Synthèse Reconfirmation :** Liste les particularités spécifiques (anniversaires, régimes, demandes spéciales) à transmettre à l'équipe reconfirmation.

--- CONTENU COMPLET DU DOSSIER ONSPOT ---
` + fullText;

  return prompt;
}
