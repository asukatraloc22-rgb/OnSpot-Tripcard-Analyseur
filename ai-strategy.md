# Stratégie IA 360° — TripCard ELITE

## Décision

Pour une utilisation locale, le choix retenu est OpenRouter avec une clé saisie manuellement dans le navigateur. La clé n’est ni envoyée au serveur de l’application ni ajoutée au dépôt ; les limites et tarifs dépendent du modèle OpenRouter choisi.

DeepSeek est intéressant pour son contexte long et ses prix bas, mais sa page officielle de tarification décrit une facturation par tokens et un solde crédité ; ce n’est donc pas le choix « sans paiement » par défaut. Voir [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/). Il pourra devenir un fournisseur optionnel si Patrick souhaite renseigner une clé et un solde séparés.

## Réduction des tokens

L’IA ne doit jamais être appelée automatiquement pendant l’import. L’analyse 360° est déclenchée par l’agent, après les contrôles locaux. Le prompt envoie uniquement un paquet de preuves compact : métadonnées, prestations structurées, documents classifiés, tickets avec derniers messages et transitions, drapeaux locaux et actions déjà détectées. Les longs textes de vouchers restent disponibles dans l’export mais ne sont envoyés qu’en mode « approfondi » ou sur demande.

Le modèle doit retourner un JSON strict contenant les incohérences nouvelles, les actions ordonnées, la situation actuelle, la chronologie synthétique, les responsabilités et le niveau de confiance. Les contrôles déterministes restent prioritaires ; l’IA propose et explique, mais ne clôture jamais automatiquement un ticket et ne transforme jamais une mention textuelle en preuve documentaire.

## Séquence cible

La séquence économique est : contrôles locaux gratuits, analyse IA 360° compacte à la demande, puis second appel approfondi uniquement si l’agent le demande ou si le premier résultat signale une preuve insuffisante. La clé OpenRouter reste stockée uniquement dans le stockage local du navigateur.
