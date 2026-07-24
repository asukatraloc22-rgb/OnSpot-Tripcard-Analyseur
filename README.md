# OnSpot Tripcard Analyseur

Extension Chrome (Manifest V3) pour analyser un dossier de voyage OnSpot :
extraction de l'itinéraire par onglet (Hôtels, Vols, Activités, Locations,
Transferts, Trains), téléchargement et extraction du texte des vouchers
(PDF, DOCX, XLSX), génération d'un prompt d'audit IA, et pont direct vers
l'outil **Trip Card Elite**.

## Contenu du dépôt

```
extension/          → à installer dans Chrome (chrome://extensions)
  manifest.json
  popup.html
  popup.js
  pdf.mjs, pdf.mjs.map
  pdf.worker.mjs, pdf.worker.mjs.map
  mammoth.browser.min.js
  xlsx.full.min.js
tripcard/
  TripCard_Elite.html   → outil de checklist, à ouvrir dans le navigateur
```

## Installation de l'extension

1. Télécharge ou clone ce dépôt.
2. Va sur `chrome://extensions`.
3. Active le **Mode développeur** (en haut à droite).
4. Clique sur **Charger l'extension non empaquetée**.
5. Sélectionne le dossier `extension/`.
6. L'icône de l'extension apparaît dans la barre d'outils Chrome.

## Utilisation

1. Ouvre la page d'un dossier de voyage OnSpot (`app.onspot.travel/trips/...`).
2. Clique sur l'icône de l'extension.
3. Clique sur **Analyser Page + Vouchers PDF** :
   - clique automatiquement sur les onglets Hôtels / Vols / Activités /
     Locations / Transferts / Trains pour révéler tout le contenu
   - détecte et télécharge les vouchers PDF, DOCX, XLSX
   - liste les images détectées (vérification manuelle pour l'instant)
   - copie un prompt d'audit complet dans le presse-papier, prêt à coller
     dans Claude ou DeepSeek
4. Clique sur **📋 Copier pour Trip Card Elite** pour copier un format
   structuré pensé pour remplir automatiquement `TripCard_Elite.html`.
5. Ouvre `tripcard/TripCard_Elite.html` dans ton navigateur, clique sur
   **📥 Coller depuis l'extension** : les 6 champs d'itinéraire et le
   résumé des vouchers se remplissent automatiquement.
6. Utilise le bouton **✨ Générer les suggestions jour par jour** dans
   Trip Card Elite pour les propositions de restaurants / activités
   (nécessite une clé API Anthropic valide côté appel, voir note
   ci-dessous).

## Note sur les suggestions IA (restaurants / activités)

Le bouton `aiGenerateBtn` de `TripCard_Elite.html` appelle directement
`https://api.anthropic.com/v1/messages` depuis le navigateur. Un appel
client-side sans clé API valide échouera. Il faut soit :
- ajouter une clé API dans les en-têtes de la requête (à ne jamais
  committer publiquement dans ce dépôt), soit
- faire passer cet appel par un petit relais serveur qui détient la clé.

## Mise à jour des librairies PDF/DOCX/XLSX

Ces fichiers sont des builds figés (pas de CDN, requis par la CSP de
Manifest V3) :
- `pdf.mjs` / `pdf.worker.mjs` — issus de `pdfjs-dist`
- `mammoth.browser.min.js` — issu de `mammoth`
- `xlsx.full.min.js` — issu de `xlsx` (SheetJS)

Pour les mettre à jour : `npm pack pdfjs-dist mammoth xlsx`, extraire les
`.tgz`, et remplacer les fichiers correspondants dans `extension/`.
