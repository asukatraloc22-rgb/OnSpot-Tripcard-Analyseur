# Trip Card Elite — dossier de voyage vivant et copilote tickets

## Vision

L’extension Chrome ne doit pas devenir un second outil de travail. Elle doit rester une **commande de collecte contextuelle** dans OnSpot. Trip Card Elite doit devenir l’unique espace de compréhension, de contrôle, de suivi et de résolution.

Le principe cible est le suivant :

> **Capturer une fois le voyage, puis l’enrichir sans écraser l’existant avec les tickets, rappels, nouveaux événements, documents et résultats de résolution.**

Le même dossier accompagne les trois moments opérationnels : vérification avant départ, traitement des incidents pendant la vie du voyage et compte rendu après voyage.

## 1. Ce qui existe déjà et peut être conservé

Le dépôt [`OnSpot-Tripcard-Analyseur`](https://github.com/asukatraloc22-rgb/OnSpot-Tripcard-Analyseur) possède déjà une base adaptée à cette évolution [1]. L’extension sait capturer l’itinéraire par onglets, extraire le texte des PDF/DOCX/XLSX, classer les documents et produire un JSON. L’application Trip Card Elite sait importer ce JSON, conserver le dernier dossier et des dossiers récents localement, appliquer des contrôles déterministes et afficher les preuves utilisées.

Le point faible actuel est volontairement limité : la présence des tickets est observée depuis la TripCard, mais l’extension ne clique pas encore sur les tickets et ne produit pas d’objet ticket structuré. Dans le moteur d’audit, les tickets peuvent également apparaître sous la forme ancienne `metadata.ticketsText`, ce qui constitue un point de compatibilité à préserver pendant la migration.

| Élément actuel | Évolution recommandée |
|---|---|
| `extractPageContentPerTabAndFiles()` | Ajouter un collecteur ticket à portée contrôlée |
| `ticketsPresence` | Le conserver comme indicateur de compatibilité, puis ajouter `tickets[]` |
| `buildTripCardPayload()` | Produire un paquet dossier versionné et fusionnable |
| `AuditMetadata.tickets` / `ticketsText` | Les conserver pour les anciens exports et ajouter un modèle ticket typé |
| `analyzeTrip()` | Ajouter une analyse des tickets sans modifier les contrôles itinéraire existants |
| `Home.tsx` | Ajouter les vues tickets, timeline unifiée, actions et bilan post-voyage |
| `localStorage` des récents | Garder pour les préférences légères ; utiliser un stockage local plus adapté pour les dossiers volumineux |

## 2. Les modes de collecte à ajouter dans l’extension

Le popup doit présenter une sélection explicite du périmètre. L’utilisateur ne doit jamais se demander si l’extension est en train de collecter tout OnSpot ou seulement la page courante.

| Mode | Point de départ | Données capturées | Usage |
|---|---|---|---|
| **Voyage uniquement** | Page TripCard | Métadonnées, voyageurs, itinéraire, vouchers et documents | Audit avant départ |
| **Voyage + tickets actifs** | Page TripCard | Voyage plus tickets nouveaux, ouverts ou en attente liés au voyage | Vérification pré-départ renforcée |
| **Ticket courant** | Page détail d’un ticket | Métadonnées, conversation, événements, statut, rappels, pièces jointes et liens | Traitement immédiat d’un cas |
| **Tickets sélectionnés** | Liste ou page TripCard | Tickets cochés ou identifiés par l’utilisateur | Analyse ciblée de plusieurs dossiers |
| **Tous les tickets du voyage** | Page TripCard ou liste filtrée | Tout l’historique disponible pour cette TripCard | Compréhension complète et bilan |
| **Tickets d’une section** | Liste Tickets avec filtre courant | Les tickets visibles dans la section, avec pagination si demandée | Travail par file : nouveaux, agence, voyageur, résolus, Elite |
| **Enrichir le dossier existant** | Dossier local déjà ouvert | Seulement les nouveaux tickets/événements/documents | Mise à jour quotidienne sans doublon |

Le mode de collecte doit afficher avant exécution un aperçu : TripCard détectée, nombre de tickets trouvés, tickets qui seront ajoutés, date du dernier export et éventuels doublons. La collecte doit être idempotente : relancer deux fois le même ticket ne doit pas créer deux copies.

### Collecte depuis une page de ticket

Sur une page `/tickets/{id}`, l’extension doit lire le DOM rendu, car l’accès est déjà authentifié dans l’onglet OnSpot. Elle collecte l’identifiant interne, le numéro fonctionnel, la priorité, le statut courant, la catégorie, le sujet, les intentions, l’agence, le voyage lié, le voyageur, les assignés, le fil d’événements, les changements de statut, les rappels, les pièces jointes et les liens vers les conversations externes.

Le collecteur doit séparer les messages humains des événements système. Un changement `Résolu → En attente (Front Office)` ne doit pas être traité comme un message. Un rappel créé, complété ou réouvert doit devenir un événement de type rappel. Chaque pièce jointe doit conserver son nom, son URL, son type, son statut d’extraction et son extrait textuel lorsque le téléchargement est possible.

### Collecte de plusieurs tickets

Pour les tickets sélectionnés ou tous les tickets d’une section, l’extension repère les liens de détail dans la liste, conserve leurs identifiants et ouvre les pages une par une dans le même onglet ou dans des onglets temporaires. Elle attend le rendu dynamique, collecte le contenu, revient à la liste et passe au suivant.

La pagination et les filtres doivent être visibles dans le paquet exporté. L’export doit indiquer s’il est complet ou partiel : `collectionStatus: "complete" | "partial"`, `requestedScope`, `filtersObserved`, `pagesVisited`, `ticketsFound`, `ticketsCaptured` et `warnings`. Il vaut mieux signaler « 18 tickets capturés sur 42 visibles dans le filtre » que présenter silencieusement une vue incomplète.

## 3. Paquet JSON cible

Le paquet doit devenir un **dossier versionné**, et non un simple export ponctuel. Les données de chaque capture restent séparées des analyses afin de pouvoir recalculer une analyse lorsque les règles évoluent.

```json
{
  "schemaVersion": "3.0.0",
  "source": "onspot-audit-assistant",
  "collection": {
    "capturedAt": "2026-08-27T16:30:00.000Z",
    "scope": "trip_and_active_tickets",
    "pageUrl": "https://app.onspot.travel/trips/...",
    "collectionStatus": "complete",
    "filtersObserved": [],
    "warnings": []
  },
  "trip": {
    "id": "trip_...",
    "cardNumber": "302501070",
    "package": "ELITE",
    "travelers": [],
    "agency": {},
    "dates": {},
    "destinations": [],
    "itinerary": [],
    "vouchers": [],
    "documents": []
  },
  "tickets": [
    {
      "id": "tkt_...",
      "ticketNumber": 100574,
      "current": {},
      "classification": {},
      "tripRef": "trip_...",
      "travelers": [],
      "messages": [],
      "events": [],
      "statusTransitions": [],
      "reminders": [],
      "attachments": [],
      "linkedTickets": [],
      "sourceRefs": []
    }
  ],
  "analyses": {
    "preTrip": null,
    "liveOperations": [],
    "postTrip": null
  },
  "operatorNotes": [],
  "resolutionRecords": []
}
```

Chaque objet doit porter une source et un horodatage lorsque ces valeurs sont disponibles. Les analyses doivent référencer des identifiants de messages, d’événements ou de documents. L’outil doit pouvoir répondre à la question « pourquoi cette alerte apparaît-elle ? » en affichant la preuve qui l’a déclenchée.

## 4. Dossier vivant et fusion des captures

Trip Card Elite doit traiter l’import comme une opération **ajouter / mettre à jour**, jamais comme un remplacement aveugle.

| Règle de fusion | Comportement |
|---|---|
| Même `trip.id` ou même numéro de TripCard | Ouvrir le dossier existant |
| Même `ticket.id` | Mettre à jour le ticket et ajouter uniquement les nouveaux événements |
| Même message avec même identifiant ou empreinte stable | Ne pas dupliquer |
| Nouveau ticket lié au même voyage | Ajouter le ticket à la collection du voyage |
| Ticket résolu déjà connu | Conserver sa résolution et sa date ; ne pas le requalifier comme nouveau |
| Nouveau message sur ticket résolu | Créer un nouvel épisode ou marquer le ticket comme rouvert |
| Nouveau document ou voucher | Ajouter une preuve et relancer uniquement les contrôles concernés |
| Capture partielle | Ne jamais supprimer les informations présentes dans une capture antérieure complète |

Pour la première version, les dossiers peuvent être conservés dans le navigateur. Le stockage local actuel est suffisant pour les préférences et les petits rapports, mais les conversations et extraits documentaires peuvent rapidement dépasser un usage confortable de `localStorage`. Une base locale de type IndexedDB est préférable pour stocker plusieurs dossiers, les versions de capture et les textes de pièces jointes.

Cette approche est privée et rapide, mais le dossier restera lié au navigateur de Patrick. Une synchronisation d’équipe devra constituer une seconde étape explicite, avec authentification, politique de conservation, contrôle d’accès et chiffrement adapté aux données de voyage.

## 5. Les quatre vues principales dans Trip Card Elite

### Vue 1 — Avant départ : audit de préparation

Cette vue reprend l’audit actuel et y ajoute l’état des tickets. Elle répond à : « Le voyage est-il prêt et quels tickets peuvent encore compromettre le départ ? »

Elle affiche les métadonnées, l’itinéraire, les vouchers, les contrôles de cohérence, les tickets actifs, les rappels H-24, les demandes en attente agence/fournisseur/voyageur et les pièces manquantes. Un ticket résolu n’est pas remonté comme bloquant, sauf si un nouvel événement l’a rouvert.

### Vue 2 — Pendant le traitement : copilote du ticket

Cette vue devient l’espace principal de travail. Elle présente une synthèse factuelle, une chronologie ramifiée, les sous-problèmes, les preuves, les actions à faire, le prochain interlocuteur et une proposition de message.

Pour le ticket #100574, elle doit faire apparaître séparément le vol perturbé, la reprotection, l’information du passager et le transfert aéroport-hôtel sans coordonnées de chauffeur. Elle doit expliquer que la résolution à 08:37 était intermédiaire et que l’événement de 10:11 a rouvert le dossier.

### Vue 3 — Timeline unifiée du voyage

Cette vue rassemble les événements de la TripCard, des tickets, des rappels, des vouchers et des changements d’assignation sur une seule ligne temporelle. Des filtres permettent d’afficher uniquement les tickets, les actions agence, les événements passager, les documents ou les reconfirmations.

Elle doit préserver l’ordre et le fuseau horaire d’origine. Un événement dont le fuseau est inconnu doit être marqué comme tel, et non converti silencieusement.

### Vue 4 — Après voyage : bilan opérationnel

Le bilan doit être activé lorsque le voyage est terminé ou lorsque l’opérateur le demande. Il compare la préparation prévue, les incidents survenus, les tickets ouverts puis résolus, les réouvertures, les rappels manqués, les fournisseurs sollicités et les conséquences client.

Le résultat attendu n’est pas un jugement automatique sur un agent ou une agence. Il s’agit d’un compte rendu exploitable : événements majeurs, actions réalisées, points restés ouverts, causes récurrentes, qualité des preuves et améliorations à intégrer dans les règles Elite.

## 6. Chronologie ramifiée en CSS

La chronologie ne doit pas être un simple fil vertical. Elle doit montrer le voyage comme un tronc et chaque ticket comme une branche, avec des sous-branches pour les actions et les preuves.

```text
TRIPCARD 302501070 · 27 août → 6 septembre
│
├── Vol CDG → JFK · perturbation météo
│   ├── Ticket #100574 · priorité urgente
│   │   ├── Alerte météo reçue
│   │   ├── Vérification BO demandée
│   │   ├── Rappel H-24 créé puis complété
│   │   ├── Résolution intermédiaire : départ annoncé 09:25
│   │   ├── Réouverture : nouveau départ annoncé 10:00
│   │   └── Reprotection confirmée par l’agence
│   │
│   └── État restant
│       ├── Coordonnées chauffeur absentes du voucher
│       ├── Civitatis contacté par l’agence
│       └── Numéro chauffeur à obtenir puis transmettre aux 4 passagers
│
└── Transfert aéroport → hôtel
    ├── Voucher PDF présent
    ├── Coordonnées de chauffeur non prouvées
    └── Ticket en attente agence
```

Chaque nœud doit porter une couleur d’état : fait, en cours, en attente, bloquant ou à confirmer. La couleur ne doit jamais être la seule information : une légende textuelle et une preuve doivent être accessibles.

## 7. Pipeline d’analyse

L’analyse doit être organisée en deux couches.

La première couche est déterministe. Elle calcule le statut courant, le dernier interlocuteur, la dernière réponse, les réouvertures, les rappels actifs, les pièces jointes présentes, les documents manquants, les liens entre tickets, les échéances et les conditions de clôture. Elle empêche les faux positifs et les répétitions d’anomalies résolues.

La seconde couche utilise l’IA sur des fragments ciblés : contexte du voyage, ticket courant, événements, documents, tickets liés et résultats déterministes. Elle produit une explication, des sous-problèmes, une priorisation, des actions et des brouillons de messages. Le système doit afficher que ces éléments sont des recommandations et non des actions exécutées.

| Analyse | Sortie attendue |
|---|---|
| Compréhension | Résumé des faits, personnes, prestations et enjeu actuel |
| Qualification | Sujet, intention, cause, priorité et niveau de risque |
| Chronologie | Épisodes, statuts, rappels, réouvertures et responsabilités |
| Résolution | Ce qui est fait, ce qui est prouvé, ce qui manque et la prochaine action |
| Coordination | Interlocuteur attendu : voyageur, agence, fournisseur ou équipe interne |
| Communication | Brouillon interne, message agence et message client, séparés |
| Contrôle de clôture | Conditions de résolution satisfaites ou non satisfaites |
| Bilan | Impact client, délais, réouvertures, causes et leçons opérationnelles |

## 8. Éviter le travail en double

Le workflow idéal tient en quatre gestes : l’opérateur ouvre ou sélectionne le dossier dans OnSpot ; il choisit le périmètre dans l’extension ; il clique sur « Capturer et enrichir » ; il traite ensuite le dossier dans Trip Card Elite.

Dans la première version, le transfert peut rester volontairement simple : copie du paquet JSON et import/enrichissement dans Trip Card Elite. L’application doit mémoriser le dernier dossier et proposer immédiatement « Ajouter à ce dossier » au lieu de demander de recréer une fiche.

Dans une version ultérieure, l’extension peut ouvrir automatiquement Trip Card Elite après la capture et transmettre le paquet par un pont sécurisé entre l’extension et l’origine hébergée de l’outil. Cette intégration éliminerait même le copier-coller, mais elle doit être conçue après la stabilisation du schéma et des protections de confidentialité.

Le principe important est que l’opérateur ne doit jamais analyser le même ticket dans OnSpot puis le ressaisir manuellement dans Trip Card Elite. OnSpot reste la source et le lieu d’action ; Trip Card Elite devient la couche de lecture, de mémoire, de preuve et d’aide à la décision.

## 9. Trois options de mise en œuvre

| Approche | Arbitrages | Coût | Complexité de mise en place |
|---|---|---|---|
| **Extension enrichie + Trip Card Elite local** | Très privée, rapide, compatible avec le fonctionnement actuel ; pas de partage automatique entre ordinateurs | Faible ; pas de serveur obligatoire | Faible à moyenne |
| **Extension + Trip Card Elite avec dossier partagé** | Consultation par les collègues et historique centralisé ; exige authentification, sécurité, rétention et gouvernance des données | Moyenne ; hébergement et éventuelle base de données | Moyenne à élevée |
| **Export JSON enrichi uniquement** | Solution légère pour valider le modèle ; pas de vraie timeline vivante ni de fusion ergonomique | Très faible | Faible |

La recommandation est de commencer par la première approche, puis d’ajouter le pont automatique extension → Trip Card Elite. La deuxième approche ne doit être activée que lorsque le schéma est validé et qu’un besoin réel de partage intercollègues est confirmé.

## 10. Feuille de route concrète

### Étape 1 — Contrat de données

Ajouter le schéma `3.0.0`, les types `Ticket`, `TicketEvent`, `TicketAttachment`, `TicketReminder`, `SubProblem`, `ActionItem` et `ResolutionRecord`. Préserver la lecture des anciens JSON.

### Étape 2 — Extension

Ajouter les modes de collecte, le collecteur de page ticket, la collecte multi-ticket, les empreintes anti-doublons, les limites de pagination et un aperçu avant export. Ne pas modifier le scraping itinéraire qui fonctionne déjà.

### Étape 3 — Application

Ajouter une opération d’enrichissement par `trip.id`/numéro de TripCard, puis les onglets `Tickets`, `Timeline`, `Actions` et `Bilan`. Remplacer les tickets textuels par une collection structurée tout en conservant le fallback historique.

### Étape 4 — Analyse du ticket

Construire d’abord les règles déterministes, puis les prompts IA fragmentés. Ajouter les références de preuve et le contrôle « déjà résolu / nouvel épisode ».

### Étape 5 — Test réel

Tester sur trois cas : un ticket nouveau, un ticket en attente agence avec pièce jointe et un ticket résolu puis rouvert. Le ticket #100574 est le cas de test idéal pour vérifier la ramification, la réouverture et le blocage du transfert.

### Étape 6 — Pont sans copier-coller

Après validation, ajouter l’ouverture automatique de Trip Card Elite et la transmission contrôlée du paquet capturé. Garder le téléchargement JSON comme solution de secours.

## Décision proposée

Le bon produit n’est pas « un scraper de tickets » ajouté à côté de l’audit. C’est **un dossier de voyage vivant avec un copilote de résolution**. L’extension fournit le contexte au bon moment et dans le bon périmètre ; Trip Card Elite conserve la mémoire, croise les preuves, dirige l’action et produit le bilan.

La première implémentation doit donc viser la capacité suivante : **TripCard uniquement, TripCard + tickets actifs, ticket courant, tickets sélectionnés ou tous les tickets du voyage, avec fusion dans un dossier existant et visualisation de la situation actuelle**. Le bilan post-voyage pourra utiliser exactement le même dossier, sans nouvelle collecte ni nouvelle saisie.

## Références

[1]: https://github.com/asukatraloc22-rgb/OnSpot-Tripcard-Analyseur — dépôt du prototype Trip Card Elite et de l’extension OnSpot Audit Assistant.
