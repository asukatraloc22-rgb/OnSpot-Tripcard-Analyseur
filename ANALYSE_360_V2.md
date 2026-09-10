# TripCard ELITE — Cible fonctionnelle de l’analyse 360°

## 1. Positionnement produit

TripCard ELITE ne doit pas être un simple lecteur de JSON ni un générateur de résumé. Sa fonction principale est de répondre à une question opérationnelle : **ce voyage peut-il être pris en charge sereinement avant le départ, et que faut-il corriger avant qu’il ne devienne un incident client ?**

L’application doit donc transformer un TripCard en trois livrables immédiatement exploitables : une **lecture synthétique du voyage**, un **registre des risques et incohérences**, et une **liste d’actions ordonnée avec preuve et responsable**.

L’IA 360° doit enrichir cette lecture. Elle ne doit pas remplacer les règles déterministes, ni produire une analyse générale déconnectée des pièces réellement présentes.

## 2. Parcours utilisateur cible

Le parcours recommandé comporte cinq étapes.

| Étape | Question de l’agent | Résultat attendu |
|---|---|---|
| Import | Le dossier est-il lisible et complet techniquement ? | Rapport d’import, structure reconnue, éléments ignorés et alertes de qualité |
| Lecture rapide | Quel est le voyage et quel est son niveau de risque ? | Synthèse exécutive, score de complétude, trois priorités maximum |
| Contrôle détaillé | Qu’est-ce qui est prouvé, manquant, contradictoire ou à confirmer ? | Contrôles par domaine avec statut, source et action |
| Arbitrage | Que dois-je demander à l’agence ou corriger maintenant ? | Plan d’actions priorisé, formulation prête à envoyer, responsable et échéance |
| Validation finale | Le dossier est-il prêt avant le départ ? | Décision humaine : prêt, prêt sous réserve ou non prêt, avec checklist persistée |

## 3. Les neuf domaines d’un contrôle complet

### 3.1 Métadonnées et identité du dossier

Le moteur doit contrôler la présence et la cohérence de la référence, du nom du voyage, de la destination, de l’agence, des dates de début et de fin, du nombre de voyageurs et des notes importantes.

Il doit détecter les situations suivantes : référence absente ou dupliquée, destination vide, dates inversées, voyageur présent dans une section mais absent d’une autre, différence entre le nombre annoncé et le nombre de noms, notes client non exploitées, dossier ancien ou période incohérente.

Chaque résultat doit préciser la valeur lue, la source et la correction attendue.

### 3.2 Voyageurs et exigences particulières

Pour chaque voyageur, l’application doit afficher les informations disponibles et les éléments manquants : nom complet, âge ou profil lorsque disponible, document requis, besoin particulier, régime alimentaire, mobilité, anniversaire ou attention commerciale.

Une mention textuelle du type « passeport envoyé » ne doit pas être considérée comme une preuve documentaire. Le statut doit distinguer **mention**, **document trouvé**, **document lisible**, et **validation humaine requise**.

### 3.3 Itinéraire et chronologie

L’itinéraire doit être reconstruit dans l’ordre chronologique, sans se limiter à un tableau brut. Chaque étape doit afficher son type, sa date, son horaire, son lieu, son fournisseur, son identifiant de réservation et les documents associés.

Le moteur doit signaler les trous de chronologie, les dates ambiguës, les étapes qui se chevauchent, les temps de correspondance insuffisants, les changements de ville non couverts, les arrivées après le début d’une prestation, les départs avant le check-out et les incohérences entre trajet aller et retour.

La vue doit permettre de filtrer par jour, type de prestation, ville et niveau de risque.

### 3.4 Vols, trains, ferries et transports

Chaque segment doit faire l’objet d’une fiche de contrôle indépendante. Elle doit contenir la compagnie, le numéro, le trajet, la date, l’heure locale, le fuseau, le terminal lorsque disponible, le PNR, le billet ou plan de vol associé et les rappels opérationnels.

Le système doit distinguer : segment trouvé dans l’itinéraire, preuve de transport trouvée, PNR trouvé, PNR complet, cohérence entre les deux sources et action requise. Les vols sans plan de vol ou sans billet doivent être mis en priorité élevée.

### 3.5 Hôtels et hébergements

Pour chaque hôtel, il faut comparer l’itinéraire et le voucher : nom, ville, adresse, check-in, check-out, nombre de nuits, type de chambre, voyageurs, pension, inclusions, numéro de réservation et conditions particulières.

Les anomalies importantes sont les nuits non couvertes, l’hôtel situé dans une autre ville, le nombre de nuits incompatible avec les dates, le check-in postérieur à l’arrivée sans explication, le check-out antérieur au départ, la chambre absente du voucher et les différences de nom ou d’adresse.

### 3.6 Activités, excursions et restaurants

Chaque activité doit être contrôlée sur sa date, son heure, son lieu de rendez-vous, son fournisseur, les participants, la réservation, le paiement, les inclusions, les exclusions, la langue et les conditions d’annulation.

L’outil doit mettre en évidence les détails réellement actionnables : heure de prise en charge, adresse de rendez-vous, numéro local, équipement demandé, restriction d’âge ou besoin de réservation préalable.

### 3.7 Transferts et logistique locale

Les transferts doivent être rapprochés des arrivées et départs. Le contrôle porte sur le chauffeur ou fournisseur, le numéro de réservation, le lieu et l’heure de prise en charge, le nombre de passagers, les bagages, le véhicule et le contact d’urgence.

Un transfert absent ne doit pas être présenté automatiquement comme une erreur : il doit être classé selon le contexte. Exemple : arrivée tardive sans transfert prévu, transfert attendu mais absent du voucher, ou transport non nécessaire car location de voiture confirmée.

### 3.8 Documents et vouchers

Le dossier doit présenter un inventaire documentaire : document trouvé, famille reconnue, document lisible, rattachement à une prestation, date, référence, informations extraites et éléments manquants.

Les contrôles doivent couvrir les billets, plans de vol, vouchers hôtel, transferts, activités, assurances, documents d’identité, autorisations, confirmations de paiement et contacts d’urgence.

Un document doit pouvoir être ouvert avec son extrait source. La règle fondamentale est : **aucun statut conforme sans preuve associée**.

### 3.9 Cohérences et erreurs de voyage

Une vue dédiée doit regrouper les erreurs transversales : chevauchement horaire, distance ou changement de ville non réaliste, prestation impossible à rejoindre, date contradictoire entre deux sources, réservation associée au mauvais voyageur, doublon, référence discordante, service annoncé mais non voucherisé et élément voucherisé mais absent de l’itinéraire.

Ces erreurs doivent être classées en bloquantes, critiques, importantes, à confirmer ou informatives. Le classement doit rester explicable et reposer sur les données disponibles.

## 4. Restitution attendue pour chaque contrôle

Chaque carte de résultat doit utiliser une structure constante :

1. **Statut** : conforme, à vérifier, manquant, incohérent ou bloquant.
2. **Constat** : ce que le moteur a réellement trouvé.
3. **Preuve** : fichier, section, extrait ou champ source.
4. **Risque** : conséquence possible pour le voyageur ou l’opération.
5. **Action** : demande précise à formuler ou correction à effectuer.
6. **Responsable** : agent, agence, fournisseur ou client.
7. **Échéance** : immédiate, avant émission, H-72, H-24 ou avant arrivée.
8. **Validation humaine** : case persistée localement avec date et auteur.

Cette structure évite les phrases générales comme « vérifier les vouchers » et les remplace par « demander le voucher du transfert Catane → Noto du 16 septembre, car aucun document ni référence ne couvre cette étape ».

## 5. Rôle d’une IA 360° réellement utile

L’IA doit recevoir le rapport structuré et les extraits pertinents, puis travailler comme un **second lecteur opérationnel**. Elle doit produire :

- une synthèse exécutive en cinq lignes maximum ;
- les trois risques prioritaires, avec justification ;
- les incohérences nouvelles non détectées par les règles simples ;
- les passages ambigus à relire dans les vouchers ;
- une chronologie narrative du séjour ;
- les dépendances critiques entre prestations ;
- les responsabilités probables par action ;
- un brouillon de message agence regroupant les demandes ;
- les limites de l’analyse et les éléments nécessitant une validation humaine.

L’IA ne doit jamais inventer un PNR, une adresse, une confirmation ou un statut conforme. Chaque proposition doit porter le label **proposition IA** et renvoyer vers une preuve source ou indiquer explicitement qu’aucune preuve n’a été trouvée.

## 6. Architecture d’écran recommandée

### Bandeau de décision

Afficher immédiatement : destination, période, voyageurs, état global, complétude documentaire, nombre de bloquants, nombre d’actions urgentes et prochaine échéance.

### Synthèse exécutive

Afficher : résumé du voyage, points forts, risques majeurs, éléments manquants et décision suggérée. La décision finale reste contrôlée par l’agent.

### Registre des risques

Afficher toutes les anomalies dans une table filtrable par sévérité, domaine, responsable, échéance et statut de traitement.

### Contrôle par domaine

Afficher les neuf domaines avec progression, preuve lue, éléments manquants et accès direct aux documents ou à l’itinéraire concerné.

### Chronologie interactive

Afficher les journées et prestations sur une ligne de temps avec conflits, temps morts critiques, changements de ville et rappels H-24.

### Centre d’actions

Regrouper les demandes à adresser à l’agence, les actions internes, les relances fournisseur et les validations à obtenir. Un bouton doit permettre de copier un message structuré, sans réécriture manuelle.

### Décision pré-départ

Permettre à l’agent de choisir : **prêt**, **prêt sous réserves**, ou **non prêt**, avec commentaire obligatoire lorsqu’un risque bloquant subsiste.

## 7. Priorités de construction

### Phase 1 — rendre le contrôle local exhaustif

Renforcer le modèle de données pour rattacher chaque anomalie à une ou plusieurs preuves, créer les contrôles par domaine et enrichir les rapprochements itinéraire-voucher.

### Phase 2 — rendre le travail quotidien rapide

Ajouter les filtres, la recherche, la vue chronologique, le centre d’actions, les responsables, les échéances et l’export d’un rapport opérationnel.

### Phase 3 — transformer l’IA en second lecteur

Remplacer le résumé générique par une sortie structurée par risques, ambiguïtés, dépendances, responsabilités et brouillon agence. Ajouter des extraits source contrôlés et un affichage clair des limites.

### Phase 4 — assurer la traçabilité

Conserver les validations humaines, les changements de statut, les versions du dossier, la date du dernier contrôle et le motif de décision finale.

## 8. Critère de réussite

Un agent doit pouvoir ouvrir un TripCard et répondre en moins de cinq minutes aux questions suivantes :

- Qui voyage, où, quand et selon quelle configuration ?
- Quelles prestations sont prévues, dans quel ordre et avec quelles réservations ?
- Qu’est-ce qui est prouvé par un document réel ?
- Qu’est-ce qui manque ou se contredit ?
- Quel est le risque concret pour le voyageur ?
- Que dois-je demander, à qui et pour quand ?
- Le voyage est-il prêt, prêt sous réserves ou non prêt ?

Si l’application ne permet pas de répondre à ces questions avec une preuve et une action associées, elle reste un tableau de lecture, pas encore un outil opérationnel de contrôle pré-départ.

## Recommandation

La prochaine évolution ne devrait pas être d’envoyer davantage de données à l’IA. Elle devrait être de construire un **moteur de preuves et d’actions plus complet**, puis de donner à l’IA un rôle de synthèse critique au-dessus de ce socle. Cette approche rend l’outil utile même lorsque l’API est indisponible et évite qu’une réponse persuasive mais non prouvée masque une erreur de voyage.
