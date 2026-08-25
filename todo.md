# Vérification JSON réel et logo

- [x] Comparer les champs racine `source`, `generatedAt`, `pageUrl`, `itinerary` et `vouchersSummary` avec le moteur actuel.
- [x] Ajouter la lecture des blocs texte `itinerary.tous`, `itinerary.vols`, `itinerary.transferts`, `itinerary.hotels` et `itinerary.vouchersTab`.
- [x] Extraire les vols, transferts, hôtels, voyageurs, dates, agence, référence et vouchers depuis les textes réellement produits par l’extension.
- [x] Détecter explicitement les contradictions observées dans l’exemple : destination Croatie/Bosnie-Herzégovine et retour le 8 septembre malgré une date de trip indiquée au 7 septembre.
- [x] Remplacer le symbole actuel par le logo OnSpot fourni, utilisé comme image de marque à côté de TripCard ELITE et comme favicon si le format le permet.
- [x] Relancer la vérification TypeScript et la build après adaptation.
