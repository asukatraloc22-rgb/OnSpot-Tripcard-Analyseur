# Renforcement TripCard ELITE — dossier Japon

- [ ] Cartographier séparément les blocs `activites`, `hotels`, `tous`, `trains`, `vouchersTab`, `vouchersSummary` et les compteurs de l’interface.
- [ ] Ne plus traiter un bloc texte répété comme une collection unique : conserver la date de section et dédupliquer par prestation réelle.
- [ ] Vérifier les métadonnées : référence, agence, créateur, dates, ID, forfait, statut des services, reminders et tickets.
- [ ] Vérifier la présence et le statut des passeports/CNI dans les vouchers et les messages du dossier.
- [ ] Parser hôtels, activités, transferts, trains, vols et documents avec date, heure, adresse, fournisseur et lieu de rendez-vous.
- [ ] Ajouter les contrôles de cohérence chronologique, géographique et horaire, avec prudence lorsque les distances nécessitent une API cartographique.
- [ ] Produire les dates de check-in vol à H-24, welcome call à H+5 après atterrissage et reconfirmations H-24.
- [ ] Exploiter notes profil, exigences client et anniversaires lorsque présents.
- [ ] Déterminer précisément les boutons/onglets que l’extension doit encore extraire.
- [ ] Tester sur le dossier Japon, puis relancer TypeScript et la build.
- [ ] Comparer le commit local, le commit distant et l’état Git.
- [ ] Vérifier l’existence d’un déploiement Vercel distinct du dépôt GitHub.
- [ ] Identifier pourquoi le lien consulté n’affiche pas la dernière version.
- [ ] Déterminer si la V1 peut fonctionner sans API externe.
- [ ] Évaluer l’usage futur éventuel de Gemini, DeepSeek ou d’une autre API gratuite.
