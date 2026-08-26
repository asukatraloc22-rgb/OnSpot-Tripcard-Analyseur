# Référentiel de contrôle — TripCard ELITE

Ce référentiel définit les contrôles exécutés par **TripCard ELITE**. Chaque conclusion doit comporter un statut, un constat factuel, une preuve provenant de l’export et, lorsqu’une action est nécessaire, une action précise. Une mention présente dans un texte n’est **jamais** considérée comme une pièce justificative.

## Statuts utilisés

| Statut | Signification opérationnelle | Règle de restitution |
| --- | --- | --- |
| **Conforme** | La règle a été vérifiée avec une preuve exploitable. | Le rapport indique ce qui a été comparé et sa source. |
| **À vérifier** | Les données existent, mais une comparaison ou une information nécessaire manque. | Le rapport explique exactement ce qui manque. |
| **Bloquant** | Une contradiction objective ou une pièce indispensable absente empêche de considérer le dossier prêt. | Le rapport décrit le conflit et l’action de résolution. |
| **Non applicable** | Le service concerné n’existe pas dans le voyage. | Aucun rappel ni alerte n’est créé. |
| **Non vérifiable** | Le service existe, mais aucune preuve documentaire exploitable n’a été exportée. | Le rapport ne présume pas du résultat. |

## Contrôles de dossier et voyageurs

| Contrôle | Conforme lorsque | À vérifier / bloquant lorsque | Preuve requise |
| --- | --- | --- | --- |
| Référence et Trip ID | Référence et identifiant sont exportés. | Une des deux données est absente. | Bandeau TripCard ou métadonnées structurées. |
| Dates globales | Date de départ et de retour sont lisibles. | Une date est absente ou contredit un segment de transport. | Bandeau, itinéraire et billet aérien. |
| Pays et destination | Pays et villes de séjour ne se contredisent pas. | Hôtel, transfert ou activité indique un autre pays non expliqué. | Itinéraire et voucher concerné. |
| Liste des voyageurs | Nombre de voyageurs et noms exportés sont cohérents. | Le bandeau indique davantage de voyageurs que l’export ne nomme. | Bloc Voyageurs et noms dans les vouchers. |
| Profil client | Les notes exportées sont visibles dans la synthèse. | Une note est mentionnée mais non rattachée au voyageur ou à la prestation. | Notes profil explicites. |
| Anniversaire | Une date d’anniversaire existe dans les données exportées. | Une simple mention « anniversaire » sans date est une attention, pas un rappel daté. | Profil voyageur ou note structurée. |

## Contrôles des documents

| Document | Conforme lorsque | Important |
| --- | --- | --- |
| **Plan de vol / billet aérien** | Un PDF, DOCX ou XLSX comporte un numéro de billet ou une référence aérienne, les segments, aéroports et heures de départ / arrivée. | Un nom de fichier ou une mention « vol » ne suffit pas. |
| **PNR complet** | Chaque segment aérien comporte un PNR ou code de réservation complet, lu dans le billet ou le segment structuré. | Un PNR manquant reste un point à clarifier avec l’agence, même si le vol est présent. |
| **Passeport / CNI** | Un fichier joint est explicitement nommé ou catégorisé passeport/CNI, ou son contenu provient d’une pièce d’identité. | La phrase d’un hôtel indiquant qu’une pièce d’identité est requise ne vaut jamais preuve. |
| **Voucher hôtel** | Le voucher contient le nom de l’hôtel, les dates, le voyageur ou l’occupation et une référence. | Les hôtels peuvent avoir plusieurs vouchers, notamment par chambre. |
| **Voucher transfert** | Le document contient la date, l’heure, le point de prise en charge, la destination et la référence. | Une confirmation limousine n’est pas un plan de vol. |
| **Voucher activité** | Le document contient la date, l’heure ou créneau, l’activité, les participants et une référence. | Une activité sans voucher est à vérifier, pas automatiquement bloquante si le service n’en produit pas. |
| **Train, ferry, location de voiture** | Le document identifie le segment, la date et la référence. | Le contrôle est non applicable si aucun service de ce type n’est détecté. |

## Comparaisons itinéraire ↔ voucher

Pour chaque prestation détectée, l’outil doit rechercher une preuve de même type. Une correspondance est considérée forte lorsque le fournisseur ou le titre, la date et au moins un élément secondaire (voyageur, ville, référence, horaire) concordent. Si cette comparaison est impossible, le statut est **non vérifiable** et non « conforme ».

| Prestation | Comparaisons attendues |
| --- | --- |
| Vol | Numéro de vol, date, aéroports, départ, arrivée, référence / billet, voyageur. |
| Hôtel | Nom, ville/adresse, check-in, check-out, chambre, nombre de voyageurs, référence. |
| Transfert | Date, heure de prise en charge, lieu de prise en charge, destination, vol associé s’il existe, nombre de passagers. |
| Activité | Date, heure, lieu de rendez-vous, nombre de participants, fournisseur, référence, conditions de reconfirmation. |
| Train / ferry / voiture | Date, itinéraire, horaires, référence, conducteur ou voyageurs selon le type. |

## Cohérence chronologique et géographique

Un nombre élevé de prestations le même jour n’est **pas une anomalie**. TripCard ELITE ne crée une alerte que lorsqu’il existe un conflit objectivable : deux départs à la même heure, un transfert avant l’arrivée du vol associé, une prestation commençant avant la fin connue de la précédente ou une distance incompatible avec le temps disponible.

La comparaison géographique n’est rendue que si les adresses ou coordonnées sont suffisamment précises. En l’absence de géocodage fiable, le statut est **non vérifiable** ; l’outil ne doit pas estimer une distance à partir d’un nom de ville incomplet.

## Rappels opérationnels

| Rappel | Déclenchement | Donnée indispensable |
| --- | --- | --- |
| Check-in de vol | 24 h avant chaque départ de vol. | Heure de départ et date, converties en UTC. |
| Welcome call | Un seul appel, 5 h après l’arrivée finale du premier trajet à destination. Si H+5 atteint ou dépasse 20:00 locale, le rappel est déplacé au lendemain à 09:00 locale. | Heure d’arrivée réelle, aéroport/destination et fuseau local fiable ; l’interface restitue aussi l’équivalent UTC. |
| Reconfirmation H-24 | Seulement si le voucher de l’activité ou du transfert mentionne une reconfirmation. | Formulation explicite de reconfirmation et date de prestation. |

## Architecture recommandée

Le moteur local déterministe reste la première couche : il est gratuit, traçable et partageable. Une IA, si elle est ajoutée plus tard, doit être **facultative** et intervenir uniquement sur des fragments déjà structurés pour proposer une hypothèse à l’agent. Elle ne doit pas valider un document, une identité ou une cohérence horaire sans règle ni preuve.
