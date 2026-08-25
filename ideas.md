# TripCard ELITE — direction de conception

## Trois pistes initiales

### Approche 1 — Poste de contrôle papier
Une interface de back-office éditoriale, claire et tactile, inspirée des dossiers de voyage imprimés, des cartes d’embarquement et des annotations d’agent. Elle privilégie la lecture rapide, les contrastes francs et une sensation de maîtrise opérationnelle.

**Probability:** 0.037

### Approche 2 — Atlas de mission
Une interface lumineuse structurée autour d’une ligne de voyage et de repères géographiques, avec une sensation de carnet d’exploration contemporain. L’objectif est de rendre la cohérence d’un long séjour lisible comme une carte mentale.

**Probability:** 0.082

### Approche 3 — Console signalétique
Une console sombre, très contrastée, où les alertes, statuts et anomalies deviennent des signaux visuels immédiatement repérables. Cette direction est efficace pour des audits intensifs, mais risquerait de rendre le travail quotidien trop technique.

**Probability:** 0.014

## Direction retenue — Poste de contrôle papier

### Design Movement
**Swiss International Typographic Style**, réinterprété pour un outil opérationnel de voyage : hiérarchie stricte, grille éditoriale asymétrique, repères marginaux et informations découpées en unités vérifiables.

### Core Principles
1. **Lire avant de cliquer.** Les éléments les plus importants — destination, dates, voyageurs, statut et alertes — sont visibles sans interaction.
2. **Séparer le signal du détail.** Un résumé d’audit compact précède les preuves et les fragments sources.
3. **Travailler par étapes.** Chaque vol, hôtel, transfert, excursion ou document devient une unité contrôlable, avec son propre statut.
4. **Assumer l’opérationnel.** L’interface doit être utile à un agent en flux réel, pas seulement convaincante en démonstration.

### Color Philosophy
Le fond **papier coquille** réduit la fatigue lors des vérifications longues. Un **bleu pétrole profond** sert de repère de confiance et de navigation, tandis qu’un **or ticket** indique l’identité ELITE et les éléments certifiés. Les alertes utilisent un rouge terracotta et un ambre contrôlé, jamais des couleurs fluorescentes : une anomalie doit attirer l’attention sans produire de stress inutile.

### Layout Paradigm
Une **colonne latérale de mission** reste visible avec le dossier actif, ses étapes et le score de complétude. Le contenu principal adopte une composition en deux temps : une bande d’identification du voyage, puis un flux de cartes d’audit asymétriques. Les détails et les preuves s’ouvrent dans le même axe, sans perdre le contexte global.

### Signature Elements
- Des **en-têtes façon talon de billet**, avec micro-label, code de dossier et séparation perforée.
- Une **ligne de trajet verticale**, ponctuée par des étapes et des états de contrôle.
- Des **annotations de marge** en IBM Plex Mono pour les sources, horaires, échéances H-24 et décisions de l’agent.

### Interaction Philosophy
Chaque interaction doit répondre à une question de contrôle : importer, analyser, filtrer, ouvrir la preuve, marquer comme traité ou préparer une action. Les boutons portent des verbes métier précis. Les états sont persistants dans le navigateur pour que l’agent puisse reprendre une vérification interrompue.

### Animation
Les changements d’état utilisent des transitions courtes et nettes, comme le déplacement d’un intercalaire dans un dossier. L’import affiche une progression séquentielle par domaine — méta, vols, hébergements, documents/transferts, synthèse — avec une animation discrète. Les cartes apparaissent avec un léger décalage vertical, mais aucun mouvement ne doit masquer une information ou ralentir une action répétée. Le mode `prefers-reduced-motion` désactive les effets non essentiels.

### Typography System
- **Fraunces** pour les titres de dossier, destinations et niveaux de synthèse : une présence éditoriale chaleureuse, mais pas décorative.
- **IBM Plex Sans** pour les libellés, explications, boutons et contenus opérationnels.
- **IBM Plex Mono** pour les codes, dates, horaires, statuts, références de vouchers et annotations de preuve.

Les titres sont courts et contrastés. Les informations de contrôle utilisent le mono en petites capitales. Les paragraphes restent mesurés pour conserver une densité lisible.

### Brand Essence
**TripCard ELITE transforme un dossier de voyage complexe en plan de contrôle actionnable, pour les agents qui doivent sécuriser chaque détail avant le départ.**

Personnalité : **précis, prévoyant, rassurant**.

### Brand Voice
Les titres sont directs et calmes. Les CTA décrivent l’action attendue : « Importer un dossier », « Lancer le contrôle », « Ouvrir la preuve », « Marquer comme traité ». Les microcopies distinguent clairement ce qui est confirmé, à vérifier et bloquant.

Exemples :
- « Le voyage est lisible. Voici maintenant ce qui mérite votre attention. »
- « Trois points à confirmer avant le H-24 — aucun détail ne doit rester implicite. »

### Wordmark & Logo
Le symbole est un **billet vertical découpé par une ligne de trajet**, terminé par un point d’escale doré. Il fonctionne seul en icône, sans reprendre le nom dans une police standard. Le wordmark associera « TripCard » en Fraunces et « ELITE » en IBM Plex Mono, avec une construction éditoriale compacte.

### Signature Brand Color
**Ticket Gold — `#D6A84F`**. Cette teinte évoque la valeur d’un service premium et le talon de contrôle validé, tout en restant suffisamment sourde pour être utilisée quotidiennement.

## Décisions de style

La V1 sera une application front-end statique, sans dépendance obligatoire à une IA ou à une clé API. Elle importera un JSON depuis le presse-papiers ou un fichier, normalisera les formes connues de tripcard, produira des contrôles déterministes et gardera un emplacement optionnel pour une analyse IA ultérieure. Aucun avis client, témoignage ou donnée inventée ne sera ajouté.

## Style Decisions

- Le terracotta est réservé aux anomalies, avertissements, contrôles non résolus ou états nécessitant l’attention ; il ne sert pas d’emphase décorative dans le hero.
- Même l’état vide présente une trame d’audit visible : domaines contrôlés, langage de statut, structure du dossier et motif de trajet/ticket avant toute interaction.
- Les titres Fraunces restent premium et éditoriaux, mais leur formulation répond à une question de contrôle ou décrit une action d’agent ; ils ne deviennent pas une accroche de page marketing.

## Refonte retenue — Liquid Glass OnSpot

### Design Movement
**Liquid Glass opérationnel**, inspiré des surfaces optiques contemporaines d’iOS 26, appliqué avec retenue à un environnement d’audit : couches translucides, bordures lumineuses, profondeur douce et indices de statut immédiatement lisibles.

### Core Principles
1. **Verre au service du signal.** La transparence sépare les niveaux d’information ; elle ne doit jamais réduire le contraste des données de contrôle.
2. **Profondeur fonctionnelle.** La navigation, le dossier actif, les alertes et les preuves vivent sur des plans visuels distincts sans simuler une interface décorative.
3. **Couleur de marque, rôle précis.** Le bleu OnSpot conduit l’action, le jaune OnSpot certifie et attire l’œil, les couleurs d’alerte restent réservées aux écarts.
4. **Densité sereine.** Les états critiques restent faciles à scanner sur un grand écran sans transformer l’outil en tableau de bord anxiogène.

### Color Philosophy
Le fond devient un **bleu nuit OnSpot** très léger, traversé de halos blancs et jaunes floutés. Les surfaces sont des verres blancs à opacité contrôlée ; le **bleu royal OnSpot** (`#3E6FD8`) est la couleur d’action et le **jaune OnSpot** (`#E9BD42`) la couleur de validation, de progression et de repère. Le texte opérationnel reste bleu pétrole très foncé pour préserver la lisibilité sur le verre.

### Layout Paradigm
Un **dock latéral flottant** regroupe la mission et la navigation. Le contenu principal repose sur un espace fluide composé d’un bandeau d’identité en verre, de cartes à niveaux de profondeur variables et d’un rail d’analyse suspendu. Aucun panneau ne doit ressembler à une carte blanche standard collée sur un fond.

### Signature Elements
- Un halo OnSpot bleu-jaune diffus derrière les surfaces principales.
- Des bordures internes à un pixel blanc translucide et des reflets directionnels discrets.
- Des capsules de statut, compteurs et contrôles flottants comme une couche optique au-dessus des données.

### Interaction Philosophy
Les éléments cliquables se soulèvent légèrement au survol, les actions primaires se densifient en bleu, et les onglets actifs se comportent comme une pilule de verre coloré. La rapidité opérationnelle reste prioritaire : aucun effet ne retarde un import, un filtre ou une décision.

### Animation
Sur entrée, les panneaux de contexte apparaissent avec un déplacement vertical de 8 px et une opacité progressive en moins de 260 ms. Les survols utilisent uniquement `transform`, `border-color`, `background-color` et `opacity`. Le mouvement est désactivé pour `prefers-reduced-motion`.

### Typography System
**IBM Plex Sans** devient la police principale, plus nette sur les surfaces translucides. **Fraunces** est conservée seulement pour les titres de voyage et moments de synthèse. **IBM Plex Mono** reste dédiée aux dates, références, sources, statuts et échéances UTC.

### Brand Essence
**TripCard ELITE transforme la vérification d’un voyage en une lecture calme, lumineuse et actionnable, pensée pour l’agent OnSpot qui doit décider vite.**

Personnalité : **lumineux, précis, maîtrisé**.

### Brand Voice
Les titres restent factuels et apaisés : « Le dossier est prêt à être lu. » et « Les actions nécessaires restent visibles, sans bruit. » Les boutons restent orientés métier : « Importer le dossier », « Ouvrir les blocages », « Consulter la preuve ».

### Wordmark & Logo
Le mot-symbole conserve le logo OnSpot, accompagné de « TripCard » et du niveau ELITE dans une construction plus légère, posée sur le dock en verre. L’icône O–S–point devient le repère de l’onglet, du dock et des éléments d’identité.

### Signature Brand Color
**OnSpot Blue — `#3E6FD8`**. Il devient la couleur d’action immédiatement reconnaissable de TripCard ELITE.

### Amendements de style validés

- Avant import, l’écran doit se lire comme une **station de contrôle prête** : trame, flux Extension → JSON → audit local, domaines et statut priment sur toute accroche éditoriale.
- Chaque niveau de verre a une fonction visuelle explicite : **dock** pour la navigation, **mission** pour l’identité du dossier, **preuve** pour les données, **action** pour les alertes et **annotation** pour les sources.
- La ligne de trajet, les bordures perforées, les balises mono de source et les repères de contrôle se répètent sur les rappels, preuves, étapes et alertes.
- Le bleu OnSpot porte les actions et interactions ; le jaune OnSpot indique la progression ou la validation et ne sert pas de couleur décorative de fond générale.
