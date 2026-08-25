# TripCard Analyzer — TripCard ELITE

TripCard Analyzer est l’outil interne de contrôle amont des dossiers de voyage OnSpot Travel Solutions. Il transforme le JSON produit par l’extension **OnSpot Audit Assistant** en une lecture opérationnelle : identité du voyage, dates, destination, étapes, documents présents et points d’attention.

## Utilisation immédiate

L’application fonctionne en front-end statique. Elle ne nécessite aucune clé API, aucun compte fournisseur et n’envoie pas le dossier importé à un serveur dans cette V1. Ouvrez l’application, puis utilisez **Importer un fichier JSON** ou **Coller depuis le presse-papiers**. Le bouton **Voir un dossier de démonstration** permet de tester l’interface sans données réelles.

Après import, l’application affiche une synthèse, un fil d’itinéraire, un registre des anomalies et une vue des documents/vouchers. Les points peuvent être marqués comme traités dans le navigateur. Le JSON source reste consultable via l’icône dédiée.

## Architecture V1

| Brique | Rôle | Dépendance obligatoire |
| --- | --- | --- |
| Extension OnSpot Audit Assistant | Extraction et préparation du dossier JSON | Oui, pour les données réelles |
| TripCard Analyzer | Normalisation, lecture et contrôles locaux | Non |
| Contrôles déterministes | Dates, voyageurs, étapes, hébergements, transferts, documents et doublons de date | Non |
| Analyse IA | Prévue comme couche optionnelle, après validation du socle | Non |

Le moteur local accepte plusieurs noms de collections courants (`flights`, `hotels`, `transfers`, `activities`, `documents`, `vouchers`, etc.) afin de rester compatible avec l’export établi de l’extension. Les règles produisent des signaux de contrôle, mais ne remplacent pas la vérification métier de l’agent ELITE.

## Développement

```bash
pnpm install
pnpm dev
```

La compilation de production se vérifie avec :

```bash
pnpm run build
pnpm run check
```

## Déploiement

Le projet est conçu pour un hébergement statique gratuit. Il peut être connecté à GitHub puis importé dans Vercel avec la commande de build `pnpm run build` et le répertoire de sortie généré par Vite. Aucune variable secrète n’est nécessaire pour la V1.

## Étapes prévues après cette V1

La prochaine itération devra valider l’export JSON réel sur plusieurs longueurs de séjour, renforcer les contrôles de cohérence entre dates et vouchers, ajouter une checklist H-24 exploitable et, seulement si nécessaire, proposer une couche IA optionnelle avec fragmentation des payloads et repli robuste. L’objectif est de conserver un mode local utile même si une API distante est indisponible.
