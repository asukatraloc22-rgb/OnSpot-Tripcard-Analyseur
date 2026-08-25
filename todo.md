# Périmètre opérationnel validé

- [ ] Comparer chaque prestation d’itinéraire avec son voucher associé.
- [ ] Vérifier la chronologie des vols, nuits, activités, transferts, ferries et voitures.
- [ ] Détecter séparément les plans de vol manquants, indépendamment des autres documents.
- [ ] Vérifier passeports/CNI, hôtels, transports, activités et vouchers manquants ou non finalisés.
- [ ] Contrôler les adresses, lieux de rendez-vous et distances lorsqu’une comparaison fiable est possible.
- [ ] Générer une synthèse d’actions exploitable par l’agent.
- [ ] Utiliser le logo OnSpot fourni depuis une URL d’asset web stable.
- [ ] Configurer le même asset ou une version favicon compatible pour l’onglet Chrome.
- [ ] Tester localement, sur le dossier Japon et en production.
- [ ] Pousser systématiquement le checkpoint final sur GitHub et vérifier le SHA Vercel.

## Extension Chrome OnSpot Audit Assistant

- [ ] Vérifier que le paquet contient manifeste, popup, scripts, bibliothèques et icônes Chrome.
- [ ] Ajouter une exportation structurée des prestations, documents et statuts de la TripCard.
- [ ] Capturer explicitement Tickets, Rappels, notes voyageurs et pièces jointes visibles.
- [ ] Distinguer les plans de vol, passeports/CNI et vouchers associés dans le JSON exporté.
- [ ] Assembler une archive ZIP installable en mode développeur dans Google Chrome.
- [ ] Documenter l’installation locale et le test sur une TripCard réelle.

## Mise à jour d’icône extension

- [ ] Remplacer l’icône actuelle par le logo OnSpot fourni.
- [ ] Reconstruire l’archive Chrome avec la nouvelle icône.
- [ ] Vérifier l’intégrité du manifeste et de l’archive avant livraison.

## Extension : suppression Rappels et synchronisation GitHub

- [ ] Vérifier les sections réellement présentes dans le JSON TripCard fourni.
- [ ] Supprimer le clic et l’export de l’onglet Rappels de l’extension.
- [ ] Conserver Tickets, Vouchers, profil voyageur et onglets d’itinéraire utiles.
- [ ] Ajouter le dossier source de l’extension dans le dépôt GitHub.
- [ ] Pousser le commit et confirmer le SHA distant.
