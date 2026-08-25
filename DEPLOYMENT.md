# Procédure de livraison TripCard Analyzer

Chaque correction fonctionnelle doit suivre le même circuit : validation TypeScript et build de production, création d’un checkpoint, push du SHA du checkpoint sur `main` du dépôt GitHub `asukatraloc22-rgb/OnSpot-Tripcard-Analyseur`, puis vérification que le dernier déploiement Vercel est `READY` et référence exactement ce même SHA.

Le domaine de production est [on-spot-tripcard-analyseur.vercel.app](https://on-spot-tripcard-analyseur.vercel.app). Une version ne doit pas être considérée comme livrée lorsque GitHub affiche le nouveau commit mais que Vercel référence encore l’ancien. Dans ce cas, il faut attendre le nouveau déploiement et contrôler ses métadonnées avant de communiquer le lien.

Le dernier cycle vérifié correspond au SHA `2eaf37ce687fb3ff7773a847e50351db68bbe332`. GitHub `main` et le déploiement Vercel `dpl_2bHCRxP5LBxnaPkHHEaFRbXxcRHg` référencent ce même commit, avec un état Vercel `READY`.
