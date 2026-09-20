# Relais Claude — TripCard Elite / OnSpot Audit Assistant

## Objet

Ce document constitue l’état de référence du projet au 20 septembre 2026. Le produit doit contrôler un dossier de voyage haut de gamme avant départ. Il ne doit pas inventer de prestations et ne doit pas demander à l’IA de reconstruire un deuxième itinéraire lorsque les prestations peuvent être normalisées localement.

## Décision métier de référence

L’analyse doit produire une décision **GO**, **GO_WITH_CHECKS** ou **NO_GO**, ainsi que des éléments rouges, orange et verts exploitables. Chaque anomalie doit contenir une preuve ou une absence de preuve, une conséquence opérationnelle, une action, un responsable et, lorsque pertinent, la preuve attendue.

Le 360° doit comparer les valeurs observées dans l’itinéraire, les vouchers et le roadbook. Les doublons entre itinéraire et voucher ne sont pas des doublons métier : ce sont des sources à rapprocher. Un doublon local ne doit être signalé que si deux prestations distinctes semblent réellement enregistrées dans l’itinéraire.

L’IA ne doit pas reconstruire un nouvel itinéraire. La frise est construite localement à partir des prestations normalisées. OpenRouter est réservé à l’interprétation, à la comparaison des sources et à la décision métier.

## Règle d’année corrigée

Une date TripCard affichée sous la forme `22 sept.` ne signifie pas automatiquement l’année suivante. L’année doit être déterminée dans cet ordre :

1. année explicite et majoritaire dans les vouchers, billets et documents extraits ;
2. année explicitement portée par les prestations ou les dates racines ;
3. année de `generatedAt` ou `createdAt` ;
4. année courante en dernier recours.

Un export peut donc afficher une date TripCard courte et produire `22/09/2026` si les vouchers et billets indiquent 2026. Le passage décembre → janvier reste à traiter comme un changement d’année lorsque l’ordre des mois l’impose.

## Règle allergies / profil

Une phrase telle que `Aucune allergie signalée`, `Pas d’allergie`, `Sans allergie` ou équivalent ne doit pas être transformée en alerte positive. Elle doit être ignorée dans `profileNotes`. Une alerte allergie n’est créée que lorsqu’une allergie positive, précise ou non, est réellement indiquée.

Les données de profil doivent rester séparées des prestations. Les noms d’hôtels, lodges, camps, villas, activités, transferts et catégories de chambres ne doivent jamais devenir des voyageurs.

## Parcours extension définitif

L’extension ne doit plus exposer les six anciens périmètres `ticket courant`, `tickets actifs`, `tickets sélectionnés`, etc. L’interface contient désormais seulement :

- **Voyage** : première page, voyageurs, métadonnées, itinéraire, vouchers, documents visibles et diagnostic des onglets ;
- **Voyage + tous les tickets** : même collecte du voyage, puis ouverture séquentielle des tickets liés, lecture des échanges, statuts, rappels et pièces jointes, retour à la page principale, puis ticket suivant.

L’ordre attendu pour le mode complet est :

1. capturer le bandeau initial comme filet de sécurité ;
2. ouvrir `Itinéraire` ;
3. cliquer séquentiellement sur `Tous`, `Hôtels`, `Vols`, `Activités`, `Transferts`, `Trains` et `Locations` ;
4. lire le panneau actif ciblé, jamais le `document.body.innerText` comme source normale de prestation ;
5. ouvrir `Vouchers` et accumuler les fichiers ;
6. si le mode complet est choisi, ouvrir chaque fiche ticket liée, extraire toute la conversation, revenir sur la TripCard principale et continuer ;
7. retourner à l’écran principal de la TripCard ;
8. construire le JSON via le même constructeur pour Analyser, Copier et Télécharger.

Le mode complet doit conserver `tabDiagnostics`, `collectionStatus`, `warnings`, `scope` et les preuves d’extraction. Un ticket absent, un ticket non chargé et un onglet vide sont trois situations différentes.

## Classification des prestations

Les types canoniques sont : `Vol`, `Hôtel`, `Activité`, `Transfert`, `Train`, `Location voiture`, `Ferry / bateau`.

Les titres doivent être commerciaux et placés avant la catégorie :

- hôtel : nom de l’hôtel puis chambre et formule en sous-titre ;
- vol : numéro de vol, PNR, départ, arrivée et horaires ;
- activité : nom commercial, prestataire, description et horaire ;
- transfert : prestataire puis trajet départ → arrivée et heure ;
- location : loueur, intermédiaire BSP/Flexible si présent, références et lieux de prise en charge/restitution ;
- ferry/bateau : opérateur, trajet et horaires.

Une catégorie de chambre telle que `Deluxe Room`, `Sea View Suite` ou `Suite A Sea Side` n’est jamais le titre de l’hôtel lorsque le voucher donne le nom commercial.

## Rappels obligatoires

- Boarding pass : H-24 avant le départ de chaque vol, avec numéro de vol et PNR ;
- Welcome call : H+5 après l’arrivée du premier vol à destination ; si l’échéance est à partir de 20:00, lendemain à 09:00 heure locale ;
- Reconfirmation : H-24 uniquement lorsqu’une instruction est prouvée dans un voucher, une note ou une prestation ;
- Anniversaire : uniquement lorsqu’une date ou une mention positive est détectée ;
- Les rappels génériques de comparaison voucher ne doivent pas polluer l’onglet opérationnel.

## Faiblesses encore à surveiller

La navigation séquentielle des tickets repose sur le comportement SPA de la page OnSpot. Si OnSpot force une navigation complète lors d’un clic, l’extraction injectée sera interrompue ; il faudra alors mettre en place un mécanisme de reprise par `chrome.storage.session` ou un orchestrateur popup/background, sans perdre le résultat du voyage déjà capturé.

La classification des documents doit éviter de classer un simple voucher hôtel ou transport comme `flight-plan` uniquement parce qu’il contient les mots `departure`, `arrival` ou `date`. Un document aérien doit présenter un marqueur aérien suffisamment fort : compagnie aérienne, numéro de billet, numéro de vol explicite, boarding pass ou itinéraire aéroportuaire.

## Fichiers principaux

- `extension/popup.js` : parcours DOM, voyageurs, onglets, vouchers, tickets et JSON final ;
- `extension/popup.html` : deux modes de capture ;
- `client/src/lib/tripcard.ts` : normalisation, année, titres commerciaux et projection ;
- `client/src/lib/tripAudit.ts` : règles déterministes locales ;
- `client/src/lib/reminders.ts` : rappels opérationnels ;
- `client/src/lib/openrouter.ts` : audit 360° et comparaison des sources ;
- `client/src/pages/Home.tsx` : dashboard et onglets ;
- `scripts/validate-extension-contract.mjs` : contrat de l’extension ;
- `docs/CLAUDE_HANDOFF_TRIPCARD_ELITE.md` : présent document.

## Validation obligatoire avant push

```bash
pnpm run check
pnpm exec vitest run
pnpm run build
node --check extension/popup.js
pnpm run validate:extension
pnpm run package:extension
git diff --check
git status --short --branch
```

Le ZIP de l’extension doit exister sous `release/onspot-audit-assistant-v2.2.0.zip`. Ne jamais créer de fichier `.env` ni inclure de clé OpenRouter dans le dépôt.

## Dernier état avant ce relais

Les commits existants sur `main` incluent la refonte du prompt 360°, la limitation du coût OpenRouter, la correction d’année placeholder `2000`, le filtrage des voyageurs et la récupération des noms commerciaux d’hôtels. Les modifications de cette reprise simplifient les modes tickets, ajoutent l’ouverture séquentielle des fiches tickets, corrigent la classification aérienne trop large, font primer l’année des documents et ignorent les phrases négatives sur les allergies.

Claude doit continuer à partir de cet état, vérifier le comportement réel sur plusieurs TripCards et ne pas réintroduire les anciens périmètres de tickets.

## Priorité de suite

1. Tester une TripCard réelle en mode **Voyage** ; vérifier voyageurs, année, titres et dates.
2. Tester le mode **Voyage + tous les tickets** avec au moins deux tickets ; vérifier le retour à la page principale entre chaque ticket.
3. Comparer les services normalisés aux vouchers extraits et au roadbook.
4. Ajouter des tests de régression pour l’année prouvée par les vouchers et pour `Aucune allergie signalée`.
5. Vérifier que l’audit 360° signale les divergences, mais ne reconstruit pas l’itinéraire.
6. Publier uniquement après validation complète et ZIP vérifié.

## Message court à transmettre

> Reprends le dépôt depuis `main` et lis `docs/CLAUDE_HANDOFF_TRIPCARD_ELITE.md`. La règle d’année est maintenant : vouchers/billets explicites avant `generatedAt`; `22 sept.` doit donc rester en 2026 lorsque les preuves documentaires indiquent 2026. `Aucune allergie signalée` n’est pas une allergie. L’extension doit avoir uniquement les modes Voyage et Voyage + tous les tickets, avec capture séquentielle des fiches tickets et retour à la TripCard principale. Les titres commerciaux doivent venir des vouchers lorsque l’itinéraire ne contient qu’une catégorie de chambre. Ne réintroduis pas les anciens scopes et ne fais pas reconstruire un second itinéraire par l’IA.
