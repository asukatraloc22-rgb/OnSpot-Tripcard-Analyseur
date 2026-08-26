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

## Favicon OnSpot Vercel

- [ ] Préparer une icône carrée lisible à partir du logo OnSpot fourni.
- [ ] Définir cette icône comme favicon de TripCard ELITE et de l’extension Chrome.
- [ ] Pousser le commit puis confirmer que Vercel sert la nouvelle version.

## Refonte Liquid Glass OnSpot

- [ ] Définir les tokens verre, bleu OnSpot, jaune OnSpot, blanc et ombres optiques.
- [ ] Recomposer la navigation desktop, l’accueil, les cartes et panneaux sur des surfaces glass.
- [ ] Adapter les états de rapport, documents et rappels à la nouvelle hiérarchie visuelle.
- [ ] Vérifier la lisibilité desktop et mobile, puis intégrer les améliorations de style retenues.
- [ ] Pousser la refonte et confirmer le déploiement Vercel sur le même SHA.

## Contrôles explicites et faux positifs

- [x] Reproduire l’alerte générique « plusieurs prestations le même jour » et la remplacer par des conflits prouvés ou une information neutre.
- [x] Exiger un fichier joint, une image ou une référence documentaire pour valider un passeport/CNI ; ne jamais valider une simple mention textuelle.
- [x] Établir une liste exhaustive de contrôles avec résultat conforme, non applicable, à vérifier ou bloquant et la preuve associée.
- [x] Distinguer les données observées, les règles conclues et les actions restantes dans le rapport.
- [x] Déterminer les champs de preuve que l’extension doit exporter pour chaque document et prestation.
- [x] Confirmer la version locale de l’extension et reconstruire un ZIP si son code est modifié.
- [x] Valider l’application sur les exports Las Vegas et Japon, puis confirmer GitHub et Vercel sur le SHA `6c083236`.

## Convergence extension et dashboard — audit détaillé

- [x] Préserver la séparation fonctionnelle : extension autonome d’extraction, TripCard ELITE autonome d’audit ; ne partager que le langage visuel OnSpot.
- [x] Recomposer le popup de l’extension avec le langage Liquid Glass OnSpot de TripCard ELITE.
- [x] Ne plus cliquer les onglets Tickets ni Rappels ; signaler leur présence depuis la page principale sans navigation intrusive.
- [x] Préserver l’extraction de toutes les données et pièces jointes visibles depuis la TripCard principale, y compris PDF, DOCX, XLSX et images.
- [x] Rendre chaque bloc du dashboard ouvrable vers une checklist de données conformes, manquantes et à confirmer avec l’agence.
- [x] Afficher et contrôler le PNR complet de chaque vol avec sa preuve documentaire.
- [x] Limiter le welcome call à l’arrivée finale du premier trajet et calculer son heure selon le fuseau local de destination, avec report à 09:00 si l’échéance dépasse 20:00 localement.
- [x] Ajouter les drapeaux de destination de manière fiable et accessible.
- [x] Finaliser les espaces « Dossiers récents » et « Règles de contrôle » comme vues réellement utilisables.
- [x] Adapter toutes les actions d’attention pour indiquer précisément ce qui doit être revérifié avec l’agence.
- [x] Pousser GitHub et confirmer Vercel READY sur le SHA `88e44dc6306229a55ba39d87c353ca1eca1b6c47` de cette version 2.0.3.
