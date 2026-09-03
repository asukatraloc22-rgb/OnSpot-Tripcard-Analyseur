# Comparaison et refonte de Trip Card Elite

## Conclusion opérationnelle

L’ancienne structure est plus performante sur le raisonnement parce qu’elle impose une séquence explicite : construire d’abord l’itinéraire, reformater le contexte par jour, transmettre l’itinéraire structuré avec le texte source, puis demander une analyse 360° qui ajoute des suggestions sans réécrire la chronologie. La version actuelle est plus propre techniquement et plus économe en tokens, mais elle produit surtout un **résumé de contrôles**. Elle ne construit pas encore une explication suffisamment narrative du voyage et du ticket.

La refonte doit donc conserver le moteur local actuel comme socle de preuve, mais réintroduire la logique de l’ancienne version sous une forme structurée et contrôlable. Le système cible doit répondre dans cet ordre : **de quel voyage s’agit-il, comment est-il composé, que s’est-il passé, quel est l’impact, qu’avons-nous déjà fait, que reste-t-il à faire, qui doit agir et quel message peut être envoyé ?**

## Ce que l’ancienne version faisait mieux

| Mécanisme | Ancienne version | Version actuelle | Décision de refonte |
|---|---|---|---|
| Construction de l’itinéraire | Étape explicite avant l’analyse | Étapes présentes, mais utilisées comme simples lignes | Reconstituer une chronologie structurée avant toute analyse IA |
| Raisonnement par journée | `jourIndex`, prestations prévues et zones vides | Pas de synthèse narrative par journée | Ajouter une vue par jour avec prestations, trous et points à vérifier |
| Contexte transmis à l’IA | Contexte jour par jour + texte itinéraire source | Paquet compact sans texte source complet | Garder un extrait source ciblé en complément des objets normalisés |
| Ticket | Présent dans les données, mais peu expliqué dans l’interface actuelle | Statut, épisode et action restante affichés | Créer une fiche « Comprendre ce ticket » avec objet, cause, événements, actions faites et reste à faire |
| Incohérences | Analyse croisée itinéraire/vouchers | Contrôles locaux séparés des explications | Faire apparaître preuve, conséquence, niveau de confiance et action associée |
| Suggestions | Suggestions par jour injectées au bon endroit | Suggestions globales et drapeaux | Rattacher chaque suggestion à une journée, une prestation ou un ticket |
| Format | JSON strict avec schéma précis | Résultat IA JSON, mais présentation encore courte | Utiliser un schéma explicatif versionné, validé avant affichage |

## Ce que la version actuelle fait mieux

La version actuelle possède trois avantages à conserver. Elle réalise d’abord les contrôles locaux avant l’appel IA, ce qui évite de payer ou de consommer du quota pour les contrôles simples. Elle limite ensuite le contexte transmis aux éléments utiles et plafonne les messages, événements et pièces jointes. Enfin, elle sépare correctement le fait observé de l’action recommandée et conserve les données de preuve dans le dossier vivant.

Le problème n’est donc pas de remplacer la version actuelle par l’ancienne, mais de réunir leurs points forts : **ancienne orchestration du raisonnement, nouveau modèle de données et nouveau contrôle de coût**.

## Structure cible de l’analyse

L’analyse cible doit comporter deux niveaux. Le premier niveau est déterministe et local : itinéraire, prestations, documents, statuts, chronologie, tickets, rappels et contrôles de cohérence. Le second niveau est explicatif et optionnel : une IA reçoit seulement le dossier compact, les exceptions et les éléments nécessaires pour rédiger une lecture humaine.

```text
Données exportées
  ├─ Métadonnées du voyage
  ├─ Itinéraire normalisé par jour
  ├─ Vouchers et preuves
  ├─ Tickets et conversations
  └─ Rappels / responsabilités
          ↓
Moteur local de preuve
  ├─ contrôles de présence
  ├─ contrôles de cohérence
  ├─ statut opérationnel
  ├─ actions déjà réalisées
  └─ actions encore ouvertes
          ↓
Contexte IA compact et factuel
          ↓
Analyse explicative structurée
  ├─ compréhension du voyage
  ├─ explication de chaque ticket
  ├─ incohérences nouvelles
  ├─ actions ordonnées
  ├─ chronologie ramifiée
  └─ compte rendu agence
```

## Modèle explicatif d’un ticket

Chaque ticket doit désormais répondre à une fiche fixe, lisible sans interprétation supplémentaire :

| Bloc | Question à laquelle il répond |
|---|---|
| Objet du ticket | De quoi parle exactement le ticket ? |
| Élément du voyage concerné | Quel vol, hôtel, transfert, activité, document ou événement est impliqué ? |
| Situation initiale | Quel était le problème au départ ? |
| Cause identifiée | Quelle cause est explicitement prouvée, et quelle cause reste inconnue ? |
| Chronologie | Que s’est-il passé, dans quel ordre et avec quel acteur ? |
| Actions réalisées | Qu’avons-nous déjà fait, par qui et avec quel résultat ? |
| État actuel | Le ticket est-il nouveau, actif, en attente, résolu ou rouvert ? |
| Impact client | Le voyageur est-il bloqué, exposé à un risque ou simplement en attente ? |
| Reste à faire | Quelle action précise manque encore ? |
| Prochaine action | Qui doit agir maintenant, avant quelle échéance et avec quel message ? |
| Preuves manquantes | Quelle information doit être obtenue avant de conclure ? |

## Modèle de synthèse du voyage

La synthèse du voyage ne doit pas être un score. Elle doit produire un paragraphe réutilisable par l’agent : destination, voyageurs, dates, composition du séjour, particularités, tickets rencontrés, résolution obtenue, sujets encore ouverts et recommandation à l’agence.

Le compte rendu agence doit disposer de deux versions. La **version interne** contient les responsables, les rappels, les preuves manquantes et les notes opérationnelles. La **version partageable** transforme les événements en retour professionnel, sans exposer les règles internes, les jugements automatiques ou les informations confidentielles.

## Décisions de refonte

La chronologie devient la source de vérité de l’analyse. L’IA ne doit jamais inventer un jour, un contact, une résolution ou une incohérence. Chaque phrase importante doit être rattachée à une preuve ou être marquée comme information manquante. Les contrôles déjà conformes ne doivent pas être répétés dans la synthèse, sauf s’ils expliquent directement un ticket.

Le ticket ne doit plus être affiché comme une simple carte de statut. La première ligne doit expliquer son objet en langage naturel. La seconde doit indiquer l’élément du voyage touché. Le centre de la fiche doit montrer la chronologie et les actions déjà réalisées. La fin doit afficher une seule prochaine action prioritaire, puis les actions secondaires avec responsable et échéance.

L’analyse IA doit rester déclenchée à la demande. Une première passe locale prépare le paquet compact. Une passe IA unique produit l’explication complète. Une seconde passe ne doit être autorisée que si l’agent demande une révision ciblée, par exemple « approfondir le transfert » ou « préparer le compte rendu agence ».

## Refonte proposée de l’interface

La Synthèse doit commencer par un bloc **« Ce voyage concerne… »**, suivi d’une ligne **« Il est composé de… »**, puis d’un bloc **« Situation opérationnelle »** qui liste les problèmes clients et leur état. La vue Tickets doit proposer par défaut une lecture **Comprendre**, puis des onglets secondaires **Chronologie**, **Actions réalisées**, **Reste à faire**, **Preuves** et **Message agence**. La vue Timeline doit présenter le tronc du voyage et les branches ouvertes par ticket.

Cette organisation est préférable à une accumulation de cartes car elle répond immédiatement aux questions de Patrick : où suis-je, que dois-je regarder, qu’est-ce qui est certain, qu’est-ce qui ne l’est pas, que dois-je faire maintenant et que puis-je envoyer à l’agence ?

## Prochaine implémentation

La prochaine itération doit commencer par les types `TripNarrative`, `TicketExplanation` et `AgencyReport`, puis par un générateur local de synthèse déterministe. L’IA sera ensuite chargée uniquement d’améliorer la formulation, de détecter les incohérences croisées non triviales et d’ordonner les actions. Cette séquence garantit qu’un dossier reste utile même sans clé API ou lorsque le service IA est indisponible.
