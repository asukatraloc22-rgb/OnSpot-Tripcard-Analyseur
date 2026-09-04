# OnSpot Audit Assistant — extension Chrome v2.1.0

Cette extension est destinée à un **usage personnel local** avec TripCard ELITE. Elle ne contient ni authentification, ni API, ni envoi automatique de données. Elle lit uniquement l’onglet OnSpot actif lorsque vous cliquez sur **« Capturer le périmètre »** et prépare un paquet JSON local, versionné et importable.

## Installation dans Google Chrome

Ouvrez `chrome://extensions`, activez le **Mode développeur**, puis cliquez sur **Charger l’extension non empaquetée**. Sélectionnez le dossier `extension` après l’avoir décompressé. Épinglez ensuite l’icône OnSpot depuis la barre d’outils Chrome.

## Mise à jour obligatoire dans Chrome

Une extension Manifest V3 chargée localement en mode développeur **ne se met pas à jour automatiquement** depuis GitHub, Vercel ou un ZIP envoyé dans une conversation. Après avoir remplacé les fichiers du dossier, ouvrez `chrome://extensions` puis cliquez sur l’icône **Actualiser** de l’extension OnSpot Audit Assistant. Si vous utilisez un nouveau ZIP, décompressez-le dans un dossier puis rechargez ce dossier avec **Charger l’extension non empaquetée**.

## Utilisation

Ouvrez une TripCard ou un écran de tickets sur `app.onspot.travel`, cliquez sur l’icône de l’extension, choisissez le périmètre demandé, puis lancez la capture. Les modes disponibles sont : voyage uniquement, ticket courant, voyage + tickets actifs visibles, tickets sélectionnés, tous les tickets visibles du voyage et tickets de la section courante. L’extension ne force pas l’ouverture de pages cachées et indique dans `collection.warnings` si le périmètre demandé n’est pas entièrement observable.

L’extension reste un **extracteur autonome** : elle lit l’itinéraire, les vouchers, les documents et les tickets accessibles dans le DOM au moment de la capture, puis revient sur l’onglet actif au départ. La version 2.2.0 ajoute un parcours de tickets sur les listes visibles et les pages de pagination détectées, en respectant le périmètre choisi (voyage uniquement, ticket courant, voyage + tickets actifs, tickets sélectionnés, tous les tickets visibles du voyage, tickets de la section courante). Choisissez ensuite **Copier le JSON TripCard ELITE** ou **Télécharger le JSON**. Importez le fichier dans Trip Card Elite ou utilisez son bouton de collage depuis le presse-papiers.

## Données exportées

Le JSON v3.1.0 conserve le texte des onglets utiles et ajoute les métadonnées de dossier, la destination, les voyageurs reconnus, les prestations structurées, les notes de profil détectées, l’inventaire PDF/DOCX/XLSX/images et le tableau `tickets[]`. Chaque ticket contient son statut courant, sa priorité, sa catégorie, ses messages, événements, transitions de statut, rappels, pièces jointes, références liées et source. Les tickets visibles sont dédoublonnés par identifiant et peuvent être classés comme nouveaux, actifs, en attente, résolus ou rouvert après une résolution antérieure.

Le paquet contient également `elite.flags`, `elite.reminderPlan`, `elite.responsibilities`, `elite.internalNote` et `elite.proactiveSuggestions`. Ces éléments traduisent les règles Elite en contrôles et actions à vérifier : contact voyageur, passeport/CNI, PNR, preuve boarding pass, contacts prestataires, Welcome Call, Here For You/FUP, anniversaire, reconfirmations H-24, Good Bye Call, note Internal — OnSpot only, deux suggestions proactives et compte rendu post-voyage.

Un passeport/CNI n’est classé comme tel que si le **fichier joint** ou son contenu porte un marqueur fort de pièce d’identité. Une mention de passeport dans le règlement d’un hôtel ne peut donc plus créer de faux positif. De même, un transfert ou un itinéraire n’est plus classé plan de vol sans marqueur aérien exploitable.

L’extension ne navigue pas automatiquement vers des pages non ouvertes et ne devine pas les tickets hors écran. Sur une page de tickets, elle peut capturer le ticket courant ou les cartes de tickets visibles selon le périmètre choisi. La présence d’un ticket dans le bandeau principal reste passive si aucun périmètre ticket n’est demandé. Les alertes Elite sont des recommandations exportées pour Trip Card Elite ; elles ne créent pas automatiquement de ticket ou de rappel dans OnSpot.

## Limites à tester

L’interface OnSpot est dynamique : certains vouchers, sections repliées ou documents chargés dans une visionneuse peuvent ne pas apparaître dans le DOM initial. Sur un dossier réel, vérifiez la ligne de statut de l’extension, notamment le nombre de PDF, DOCX, XLSX et images détectés. Le JSON reste exploitable même si un fichier indique une erreur d’extraction : son URL et son statut sont conservés.
