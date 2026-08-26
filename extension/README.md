# OnSpot Audit Assistant — extension Chrome v2.0.2

Cette extension est destinée à un **usage personnel local** avec TripCard ELITE. Elle ne contient ni authentification, ni API, ni envoi automatique de données. Elle lit uniquement l’onglet OnSpot actif lorsque vous cliquez sur **« Analyser la TripCard et les vouchers »**.

## Installation dans Google Chrome

Ouvrez `chrome://extensions`, activez le **Mode développeur**, puis cliquez sur **Charger l’extension non empaquetée**. Sélectionnez le dossier `extension` après l’avoir décompressé. Épinglez ensuite l’icône OnSpot depuis la barre d’outils Chrome.

## Mise à jour obligatoire dans Chrome

Une extension Manifest V3 chargée localement en mode développeur **ne se met pas à jour automatiquement** depuis GitHub, Vercel ou un ZIP envoyé dans une conversation. Après avoir remplacé les fichiers du dossier, ouvrez `chrome://extensions` puis cliquez sur l’icône **Actualiser** de l’extension OnSpot Audit Assistant. Si vous utilisez un nouveau ZIP, décompressez-le dans un dossier puis rechargez ce dossier avec **Charger l’extension non empaquetée**.

## Utilisation

Ouvrez une TripCard sur `app.onspot.travel`, cliquez sur l’icône de l’extension, puis lancez l’analyse. Après la lecture des onglets et fichiers visibles, choisissez **Copier le JSON TripCard ELITE** ou **Télécharger le JSON TripCard ELITE**. Importez ensuite le fichier dans TripCard ELITE ou utilisez son bouton de collage depuis le presse-papiers.

## Données exportées

Le JSON v2.0.2 conserve le texte des onglets tout en ajoutant : les métadonnées de dossier, les voyageurs reconnus, les prestations structurées quand elles sont lisibles, l’onglet Tickets, les notes de profil détectées et l’inventaire PDF/DOCX/XLSX/images. Chaque document porte une `category`, une `classificationConfidence` et une `classificationEvidence` : plan de vol, identité, hôtel, transport, activité, itinéraire ou autre.

Un passeport/CNI n’est classé comme tel que si le **fichier joint** ou son contenu porte un marqueur fort de pièce d’identité. Une mention de passeport dans le règlement d’un hôtel ne peut donc plus créer de faux positif. De même, un transfert ou un itinéraire n’est plus classé plan de vol sans marqueur aérien exploitable. L’extension ne clique pas l’onglet Rappels.

## Limites à tester

L’interface OnSpot est dynamique : certains vouchers, sections repliées ou documents chargés dans une visionneuse peuvent ne pas apparaître dans le DOM initial. Sur un dossier réel, vérifiez la ligne de statut de l’extension, notamment le nombre de PDF, DOCX, XLSX et images détectés. Le JSON reste exploitable même si un fichier indique une erreur d’extraction : son URL et son statut sont conservés.
