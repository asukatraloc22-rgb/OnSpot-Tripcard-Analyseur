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

## Preview final après ajout du panneau Elite

URL de déploiement : https://on-spot-tripcard-ticket-preview-qea8z6p16.vercel.app/

Lien temporaire vérifié : https://on-spot-tripcard-ticket-preview-qea8z6p16.vercel.app/?_vercel_share=PNaVF9mvMakYbhiUUIVVP3iTSKVGYXo2

Le déploiement Vercel est en état READY. L’écran d’import se charge sans authentification via le lien temporaire. Le rendu conserve la navigation Trip Card Elite et est prêt à recevoir un export v3.1.0 avec `elite.flags` et `elite.reminderPlan`.

## Test fonctionnel du fixture Elite enrichi

Le fixture `ticket-100574-living-dossier.json` s’importe correctement dans le preview `4zy1abmpo`. L’interface affiche 4 prestations, 1 ticket, 4 événements, 13 contrôles et le drapeau de destination Portugal. La synthèse montre 1 blocage et 5 points à vérifier ; le ticket et la timeline sont disponibles dans les onglets dédiés. Le panneau Actions sera contrôlé séparément pour vérifier les trois drapeaux Elite et le plan de rappels importés.

## Vérification Actions et Tickets

L’onglet Actions affiche bien trois drapeaux importés : un blocage « Contact prestataire manquant », un avertissement de contact client et une information anniversaire. Le plan affiche les responsabilités Agent Elite, Mayara et automatique, les rappels J-10, Welcome Call, H-24, Good Bye Call et compte rendu à J+1, ainsi que deux suggestions proactives à ajouter.

L’onglet Tickets affiche 1 ticket capturé, 1 actif/en attente, 1 urgent, 1 en attente agence et 0 résolu. Le ticket #100574 est correctement classé « Rouvert », avec l’action « Obtenir la réponse attendue de l’agence ou du fournisseur ». Le rendu est lisible et cohérent avec le dossier vivant.

## Vérification Timeline

L’onglet Timeline affiche 4 événements dans l’ordre : rappel H-24 complété, passage de l’attente Back Office à Résolu, réouverture en attente agence, puis message de l’agence. La chronologie ramifiée est lisible et montre correctement qu’une résolution suivie d’un nouvel événement doit être traitée comme une réouverture.

## Vérification du 31 août 2026 — IA et itinéraire

Le preview `on-spot-tripcard-ticket-preview-g19tyhbvr.vercel.app` charge correctement avec `?demo=1`. La Synthèse affiche le panneau « Analyse IA 360° » avec clé OpenRouter locale, modèle configurable et bouton manuel. L’onglet Itinéraire affiche les filtres emoji `Tout`, `Vol`, `Activité`, `Hôtel`, `Ferry`, `Train`, `Restaurant`, `Location voiture` et `Transfert`. Après clic sur `✈️ Vol`, seules les deux étapes aériennes sont conservées. Aucun appel IA n’est déclenché sans action explicite de l’agent.
