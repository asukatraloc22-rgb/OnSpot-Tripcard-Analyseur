document.getElementById('extractBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractAndAnonymize
  }, (results) => {
    if (results && results[0] && results[0].result) {
      navigator.clipboard.writeText(results[0].result);
      document.getElementById('status').innerText = "✅ Copié avec succès !";
    } else {
      document.getElementById('status').innerText = "❌ Erreur d'extraction";
    }
  });
});

function extractAndAnonymize() {
  let text = document.body.innerText;

  // 1. Anonymisation RGPD (Emails et Téléphones)
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_MASQUÉ]");
  text = text.replace(/(\+33|0)[1-9](\s?\d{2}){4}/g, "[TEL_MASQUÉ]");

  // 2. Construction du Prompt pour l'IA
  let prompt = `Tu es un assistant expert en conciergerie de voyage. Analyse le contenu anonymisé ci-dessous de ce dossier OnSpot :\n\n1. Vérifie la concordance des noms/vouchers et dates.\n2. Liste les particularités à transmettre à Mayara (voyage de noces, allergies, etc.).\n3. Identifie les rappels obsolètes.\n\n--- CONTENU DOSSIER ---\n` + text;

  return prompt;
}
