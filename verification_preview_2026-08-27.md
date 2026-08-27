# Vérification du preview Vercel — 27 août 2026

URL vérifiée : https://on-spot-tripcard-ticket-preview.vercel.app/

Le projet Vercel `on-spot-tripcard-ticket-preview` est en état READY et l’interface se charge correctement. La page vide affiche l’import JSON et le dossier de démonstration. Après ouverture de la démo, l’écran Trip Card Elite s’affiche avec les onglets existants et les deux nouveaux onglets `Tickets` et `Timeline`.

La démo intégrée ne contient pas de tickets structurés : les compteurs des onglets Tickets et Timeline apparaissent donc avec un point neutre. C’est attendu, car la capture de ticket doit venir du nouveau flux de l’extension ou d’un JSON enrichi. Les vues ont néanmoins été intégrées sans casser l’audit existant, les contrôles, l’itinéraire, les documents ni les actions.

Le rendu visuel conserve le dock bleu, les surfaces glass, la hiérarchie OnSpot et le rail de contrôle. Le build Vercel est donc consultable ; le prochain test fonctionnel doit utiliser un export réel ou anonymisé contenant `tickets[]` pour valider la timeline et le détail ticket.

## Contrôle des nouveaux onglets

L’onglet `Tickets` s’ouvre correctement et affiche les quatre compteurs `Actifs / en attente`, `Urgents`, `En attente agence` et `Résolus`, suivis des filtres `Tous`, `À traiter`, `Urgents` et `Résolus`. En l’absence de tickets structurés dans la démo, l’état vide explique que la capture doit venir du mode ticket courant ou d’un export enrichi.

L’onglet `Timeline` s’ouvre correctement et affiche le titre `Branches de résolution`, l’explication du tronc et des branches, ainsi qu’un état vide propre avec `0 événements`. Aucun crash ni débordement visuel n’a été observé dans le viewport de vérification.

## Préparation du test ticket

Le bouton `Importer` est visible sur le dossier chargé, mais son activation ne présente pas de modale persistante dans le rendu observé ; le bouton semble déclencher directement l’ouverture native du sélecteur de fichier. Le preview reste stable et l’onglet Timeline conserve son état vide.

Un test fonctionnel complet nécessite maintenant un fichier JSON enrichi avec `tickets[]`. Il peut être chargé via le bouton d’import ou par collage du JSON dans l’outil ; aucun ticket n’est présent dans la démo intégrée.

## Accès partagé

Le lien temporaire Vercel généré pour le dernier déploiement ouvre correctement l’application sans connexion au compte Vercel. Le projet et son URL de déploiement sont donc utilisables pour la vérification externe. Le test d’import du fixture doit encore être réalisé dans le navigateur ; le bouton d’import est présent, mais le sélecteur de fichier natif ne laisse pas apparaître directement son champ dans la liste visuelle des éléments.

## Test d’import automatisé

Le DOM du preview contient bien un champ `input[type=file]` acceptant `application/json,.json`, mais le ciblage direct par l’index d’upload n’a pas trouvé le champ caché. Le champ a été rendu temporairement visible par inspection contrôlée du DOM pour poursuivre le test ; cette modification ne concerne que la session de vérification du navigateur et n’est pas incluse dans le code du projet.

## Import du fixture ticket

Le fixture `ticket-100574-living-dossier.json` est accepté par le preview et produit bien les compteurs `Tickets 1` et `Timeline 4`. L’import ticket seul déclenche toutefois les contrôles de voyage attendus : dates, voyageurs et itinéraire sont absents du fixture courant, donc le dossier obtient des alertes de complétude. Cela confirme le besoin d’une vraie opération d’enrichissement qui fusionnera le ticket dans une TripCard déjà capturée au lieu de présenter un ticket isolé comme un voyage complet.

## Vérification du détail ticket

Après import, l’onglet Tickets affiche `1 actif`, `1 urgent` et `1 en attente agence`. La carte du ticket #100574 est correctement classée `Rouvert`, avec le statut `En attente (Agence)`, la priorité `Urgent`, l’assigné, la prochaine action et les compteurs message/pièce jointe.

Le détail ticket s’ouvre dans une fenêtre dédiée et affiche l’épisode `Rouvert`, la catégorie, l’assigné, le nombre d’actions restantes, le dernier message et la pièce jointe. Le comportement attendu pour un ticket résolu puis repassé en attente est donc confirmé sur le preview.

## Vérification de la timeline avec ticket

L’onglet `Timeline` affiche 4 événements pour le ticket #100574 : rappel H-24 complété, passage de l’attente Back Office à Résolu, réouverture vers En attente (Agence), puis message de l’agence. L’ordre chronologique est correct et la réouverture est lisible comme un changement distinct.
