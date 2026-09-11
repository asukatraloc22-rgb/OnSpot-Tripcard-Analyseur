# TripCard Analyzer — TripCard ELITE

TripCard Analyzer est le poste de contrôle OnSpot Travel qui transforme le JSON produit par l’extension **OnSpot Audit Assistant** en dossier exploitable. La refonte conserve l’identité visuelle **Liquid Glass OnSpot Travel** et l’appel direct OpenRouter en mode test, mais simplifie entièrement la structure applicative autour du flux métier.

## Flux fonctionnel

1. Importer un fichier JSON ou coller le JSON de l’extension.
2. Auto-remplir les métadonnées : référence, période, destination, agence, voyageurs et identifiant.
3. Normaliser les prestations de toutes les collections usuelles : vols, hôtels, activités, transferts, trains, locations, ferries et services génériques.
4. Afficher et éditer le résumé des vouchers et des documents.
5. Ajouter des tickets au fur et à mesure et conserver leur statut, priorité, catégorie, messages et récapitulatif.
6. Appeler OpenRouter une première fois pour **construire l’itinéraire** jour par jour.
7. Appeler OpenRouter une deuxième fois, indépendamment, pour **l’analyse 360°** : description du voyage, problèmes, suggestions, rappels et actions.
8. Consulter les vues Résumé, Itinéraire, Vouchers, Tickets et Actions dans un dashboard unique.

## Compatibilité JSON

L’adaptateur accepte le contrat structuré de l’extension (`trip`, `collection`, `tickets`, `documents`, `itinerary`) ainsi que les exports plats courants (`meta`, `travelers`, `flights`, `hotels`, `activities`, `transfers`, `trains`, `documents`). Les champs inconnus sont conservés dans `raw` afin de ne pas perdre d’information métier. Le schéma de référence reste [dossier-vivant.schema.json](./dossier-vivant.schema.json).

## Architecture simple

| Fichier | Responsabilité |
| --- | --- |
| `client/src/pages/Home.tsx` | Interface, onglets et orchestration des actions opérateur |
| `client/src/lib/tripcard.ts` | Adaptation du JSON, métadonnées, prestations, vouchers et tickets |
| `client/src/lib/openrouter.ts` | Deux appels OpenRouter JSON indépendants |
| `client/src/index.css` | Identité visuelle Liquid Glass et composants de contrôle |
| `extension/` | Extension de collecte OnSpot, conservée comme source JSON |

## OpenRouter en phase de test

La clé est saisie dans le champ **Clé OpenRouter locale** du dashboard et enregistrée dans `localStorage` pour éviter de la ressaisir pendant les tests. Aucun fichier `.env` n’est requis ou livré. Cette méthode est adaptée au prototype, mais elle ne constitue pas un stockage sécurisé pour la production.

Le premier appel utilise les données JSON, les prestations et le résumé des vouchers. Le second utilise le JSON, les vouchers, les tickets, les notes opérateur et l’itinéraire construit lorsqu’il existe. Les deux résultats sont JSON et affichés comme assistance : une validation humaine reste nécessaire.

## Développement

```bash
pnpm install
pnpm dev
pnpm run check
pnpm run build
```

Le fichier `client/public/tripcard-sample.json` permet de tester le flux sans export réel.
