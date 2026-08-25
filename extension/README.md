# OnSpot Audit Assistant — extension Chrome v2

Cette extension est destinée à un **usage personnel local** avec TripCard ELITE. Elle ne contient ni authentification, ni API, ni envoi automatique de données. Elle lit uniquement l’onglet OnSpot actif lorsque vous cliquez sur **« Analyser la TripCard et les vouchers »**.

## Installation dans Google Chrome

Ouvrez `chrome://extensions`, activez le **Mode développeur**, puis cliquez sur **Charger l’extension non empaquetée**. Sélectionnez le dossier `onspot-audit-assistant-v2` après l’avoir décompressé. Épinglez ensuite l’icône OnSpot depuis la barre d’outils Chrome.

## Utilisation

Ouvrez une TripCard sur `app.onspot.travel`, cliquez sur l’icône de l’extension, puis lancez l’analyse. Après la lecture des onglets et fichiers visibles, choisissez **Copier le JSON TripCard ELITE** ou **Télécharger le JSON TripCard ELITE**. Importez ensuite le fichier dans TripCard ELITE ou utilisez son bouton de collage depuis le presse-papiers.

## Données exportées

Le JSON v2 conserve le texte des onglets tout en ajoutant : les métadonnées de dossier, les voyageurs reconnus, les prestations structurées quand elles sont lisibles, l’onglet Tickets, les notes de profil détectées, l’inventaire PDF/DOCX/XLSX et le classement des documents de type plan de vol, identité ou voucher. L’extension ne clique plus l’onglet Rappels.

## Limites à tester

L’interface OnSpot est dynamique : certains vouchers, sections repliées ou documents chargés dans une visionneuse peuvent ne pas apparaître dans le DOM initial. Sur un dossier réel, vérifiez la ligne de statut de l’extension, notamment le nombre de PDF, DOCX, XLSX et images détectés. Le JSON reste exploitable même si un fichier indique une erreur d’extraction : son URL et son statut sont conservés.
