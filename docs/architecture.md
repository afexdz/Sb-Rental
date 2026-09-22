# Frontières prévues

Le catalogue et le parcours de location restent en démonstration ; les comptes clients sont fonctionnels avec Supabase local. L’interface importe un catalogue local ; le Worker ne propose actuellement que `/api/health` et une réponse JSON 404 pour les autres routes d’API.

## Services à intégrer ensuite

- **Supabase** : comptes clients/agences, sessions, dossiers RC et back-office disponibles en local. Les tables véhicules, réservations, paiements et conversations sont créées et consultables par l’administration. Leur alimentation depuis le parcours public reste à intégrer. L’interface utilise uniquement la clé publique et des politiques RLS. Une future clé de service devra rester côté serveur.
- **Images agence (Lot 1)** : logos et photos de flotte dans le bucket public Supabase `agency-assets`, avec écritures réservées à l’agence approuvée propriétaire. Le catalogue local reste indépendant. L’intégration Cloudflare R2 éventuelle est différée.
- **Chargily Pay** : création du paiement et réception du webhook côté Worker. Le secret ne doit jamais porter le préfixe `VITE_`. L’état du paiement devra provenir d’un webhook vérifié, avec traitement idempotent.

## Parcours métier cible

Recherche → échange client/agence → disponibilité confirmée par l’agence → paiement de l’acompte de 10 % via Chargily Pay → remise du véhicule et règlement des 90 % restants.

Le prix final, les dates et la disponibilité devront être recalculés et validés côté serveur avant création d’un paiement. L’estimation locale du prototype ne constitue pas une réservation et ne doit pas être réutilisée comme autorité de facturation.

Voir [comptes clients](accounts.md), [espace agence](agency-workspace.md) et [back-office](backoffice.md) pour les fonctionnalités disponibles, les règles financières et les tests. Le catalogue public de démonstration reste indépendant des tables métier : aucune estimation du site n’est comptabilisée comme revenu. Les écritures de boutique et de flotte sont disponibles dans `/agence`. Le futur parcours public de réservation, R2 et l’intégration Chargily restent à développer.
