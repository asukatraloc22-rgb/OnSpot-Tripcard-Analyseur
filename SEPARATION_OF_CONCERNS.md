# Séparation des responsabilités

La nouvelle version est volontairement centrée sur un seul poste de contrôle. L’identité Liquid Glass est conservée, mais l’ancien découpage de dashboard n’est pas reconduit : chaque responsabilité métier est isolée dans un module court.

| Couche | Responsabilité | Ne fait pas |
| --- | --- | --- |
| `Home.tsx` | État de l’écran, import, onglets, déclenchement des actions et rendu | Ne décode pas en profondeur toutes les variantes JSON |
| `tripcard.ts` | Normalisation du JSON extension/plat, métadonnées, prestations, vouchers, tickets et résumé local | Ne contacte pas OpenRouter |
| `openrouter.ts` | Transport OpenRouter, gestion des erreurs, contrats de construction d’itinéraire et d’analyse 360° | Ne manipule pas le DOM ni `localStorage` |
| `index.css` | Identité Liquid Glass, cartes de preuve et hiérarchie visuelle | Ne contient pas de règles métier |
| `extension/` | Collecte détaillée du contexte OnSpot et export JSON | Ne rend pas le dashboard TripCard |
| `server/` | Santé et futur point de sécurisation | N’est pas requis pour le mode OpenRouter direct de test |

## Double appel IA

Le bouton **Construire l’itinéraire** appelle uniquement le contrat de chronologie. Il reçoit les métadonnées, les prestations et le résumé des vouchers.

Le bouton **Lancer l’analyse 360°** appelle uniquement le contrat d’audit. Il reçoit le dossier complet normalisé, les vouchers, les tickets, les notes opérateur et l’itinéraire construit lorsqu’il est disponible.

Les appels sont indépendants : l’échec de la construction de l’itinéraire ne bloque pas une analyse 360° et inversement.

## Sécurité de test

La clé OpenRouter est saisie localement dans le navigateur et stockée dans `localStorage` pour le prototype. Elle n’est pas committée, n’est pas placée dans le bundle source et aucun fichier `.env` n’est nécessaire. Avant production, cette stratégie devra être remplacée par un relais serveur protégé ou un trousseau système local.
