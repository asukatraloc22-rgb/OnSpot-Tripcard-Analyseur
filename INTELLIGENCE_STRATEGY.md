# TripCard ELITE — stratégie d’intelligence et comparaison fonctionnelle

> **Décision d’architecture :** l’audit pré-départ reste **déterministe, local et fondé sur des preuves**. Une IA n’est ni nécessaire ni autorisée à valider seule une pièce d’identité, un PNR, un voucher, une distance, un horaire ou un statut « conforme ».

## Comparatif avec le référentiel transmis

| Élément du référentiel transmis | État dans TripCard ELITE | Décision |
|---|---|---|
| Import extension → JSON local | Disponible, avec extension autonome | Conserver tel quel |
| Persistance multi-dossiers | Disponible dans `localStorage` | Conserver tel quel |
| Checklist humaine | Checklist détaillée par contrôle, avec cases à cocher et progression locale | Renforcer sans revenir à une checklist fixe de huit étapes |
| Chronologie du voyage | Reconstruction depuis `services[]`, avec compatibilité historique | Conserver et enrichir l’export, pas d’IA obligatoire |
| Audit itinéraire ↔ vouchers | Rapprochement déterministe avec preuve, PNR, documents, conflits horaires et rappels | Cœur du produit ; ne pas déléguer la décision finale à une IA |
| Rappels H-24 et welcome call | Règles explicites UTC/fuseau de destination | Conserver déterministe |
| Suggestions de restaurants ou activités | Absent | Hors périmètre de l’audit pré-départ ; à isoler dans un futur module de personnalisation |
| Messages Welcome / Goodbye | Absent | À placer dans le Voucher Builder ou un module de communication distinct, jamais dans la décision d’audit |
| Export / impression | Non prioritaire | À traiter seulement après stabilisation des exports et des règles |

## Ce qui est faisable sans IA

Les contrôles suivants doivent rester des règles locales parce qu’ils ont une définition vérifiable : présence d’un fichier identité réel, plan de vol, PNR par segment, concordance service-voucher, conflits d’horaires attestés, check-in H-24, reconfirmation explicitement demandée et welcome call à l’heure locale de destination. Les lieux et distances restent « à vérifier » tant qu’aucune source d’itinéraire fiable n’est disponible.

Le moteur ne doit jamais conclure « conforme » sur une simple mention textuelle. La checklist agent ajoute une confirmation humaine persistée localement, sans transformer l’action de l’agent en donnée automatique et sans modifier la conclusion calculée.

## IA : uniquement une aide opt-in ultérieure

L’IA pourrait apporter une valeur limitée sur trois tâches non décisionnelles : proposer une **liste de passages ambigus** à lire dans un voucher long, suggérer un classement provisoire d’un document mal structuré, ou rédiger un brouillon de message à l’agence à partir d’actions déjà déterminées. Chaque résultat devrait être étiqueté « proposition IA », comporter ses extraits source et exiger une validation humaine.

Pour cet usage, une option manuelle avec **Gemini 3.7 Flash** serait le candidat le plus cohérent si l’on conserve Google AI Studio : le modèle est présenté comme adapté aux flux agentiques/multimodaux et le niveau gratuit propose certains modèles et des jetons gratuits [1]. Cela ne garantit toutefois ni volume ni disponibilité : les quotas sont appliqués **par projet**, varient selon le modèle et peuvent renvoyer une limitation [2].

Le niveau gratuit indique également que le contenu peut être utilisé pour améliorer les produits Google [1]. Par conséquent, aucune pièce d’identité, numéro de document, PNR complet ou donnée client non nécessaire ne doit être envoyée à une IA gratuite. Avant tout appel futur, TripCard devrait afficher un consentement explicite, masquer les données sensibles et envoyer des fragments courts, jamais le JSON complet.

## Recommandation actuelle

Ne pas ajouter d’IA dans cette version. La qualité de l’extraction structurée, les preuves et la checklist humaine sont aujourd’hui le meilleur levier pour des audits rigoureux et répétables. Une IA peut être ajoutée plus tard comme bouton facultatif « Examiner les ambiguïtés », sans changer le fonctionnement local par défaut.

## Références

[1] [Google AI for Developers — Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)

[2] [Google AI for Developers — Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
