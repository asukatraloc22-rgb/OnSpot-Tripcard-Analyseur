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
