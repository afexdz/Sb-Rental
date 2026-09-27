# SB Rental

## Objectif

SB Rental est une plateforme algérienne de location de véhicules. Elle met en relation des clients et des agences vérifiées, avec un catalogue de véhicules, des espaces séparés par rôle et un back-office d’administration.

Fonctionnalités prévues : recherche de véhicules, comptes client et agence, approbation des agences, profil client vérifié avec passeport privé, chat, réservations et acompte de 10 %, ainsi qu’un back-office pour les véhicules, utilisateurs, demandes, réservations, paiements, statistiques, messages et audit.

## Stack et hébergement

- React 19, TypeScript, Vite 8, React Router et Lucide React ;
- Supabase Auth, PostgreSQL, Storage privé et RLS ;
- Cloudflare Worker/Vite pour le runtime Worker ;
- Vercel pour la production web et les routes SPA ;
- Playwright, Node Test et Oxlint pour les contrôles ;
- Node.js 22.16 ou supérieur.

Le projet Supabase Cloud est lié à `cusyvndgjnpibfnzjhoa`. Les clés privées et secrets ne doivent jamais être ajoutés au dépôt ni exposés au navigateur.

## Structure

```text
src/admin/              Back-office, API et sections d’administration
src/agency/             Espace agence
src/client/             Marketplace, profil, chat et vérification client
src/auth/               Session et contexte d’authentification
src/components/         Composants partagés et layouts
src/pages/              Pages publiques et protégées
src/lib/                Supabase, auth, validation et erreurs
src/data/               Catalogue de démonstration
public/brand/           Logo, favicon et ressources de marque
supabase/migrations/    Migrations additives et politiques RLS
supabase/functions/     Edge Functions, dont le paiement différé
tests/                  Tests unitaires et E2E Playwright
docs/                   Audits, architecture et décisions
worker/                 Runtime Worker et health check
vercel.json             Réécriture des routes SPA
```

## Déjà réalisé

- routes `/`, `/inscription`, `/connexion`, `/admin`, `/agence` et `/mon-compte` ;
- layouts responsive et identité ivoire, graphite et vert profond ;
- logo SB Rental dans les zones de marque et favicon ;
- authentification e-mail/mot de passe, sessions persistantes et contrôle d’accès ;
- workflow agence avec registre de commerce obligatoire, statut pending et approbation admin ;
- workflow client pending avec profil complémentaire et passeport privé ;
- back-office, contrôles d’accès, gestion d’erreurs et journal d’audit ;
- migrations d’unicité, vérification client et acompte créées sans reset ;
- RLS Supabase et Storage privé ;
- réécritures SPA Vercel ;
- `npm run check` et suites E2E validés pendant l’audit ;
- migrations Cloud appliquées et vérifiées à jour ;
- dernier déploiement Vercel : commit `d00cd80`, statut Ready.

## Reste à faire

- configurer réellement Google OAuth dans Supabase et Google Cloud ;
- finaliser l’intégration Chargily et ses secrets de production ;
- vérifier visuellement le logo hors de l’image hero et la version mobile ;
- remplacer les données de démonstration par le catalogue métier ;
- faire une recette complète en production avec les comptes autorisés.

## Décisions et règles

1. Ne jamais utiliser `supabase db reset`, supprimer des données ou réinitialiser Storage.
2. Les migrations sont additives et versionnées. Faire un dry-run avant toute application Cloud.
3. Une agence ne téléverse pas de passeport : seul son registre de commerce est obligatoire.
4. Le passeport concerne uniquement le client, dans un bucket privé avec accès RLS autorisé.
5. Un client pending peut discuter avec une agence vérifiée ; réservation et acompte nécessitent la vérification.
6. Prix, dates et disponibilités doivent être validés côté serveur avant tout paiement.
7. Préserver la palette et le design. Ne jamais placer le logo dans l’image hero.
8. Toute modification doit passer par `npm run check`; les parcours sensibles par `npm run test:e2e`.
9. Ne jamais exposer de service-role key, secret OAuth ou secret Chargily dans le client, les logs ou Git.

## Commandes courantes

```sh
npm ci
npm run check
npm run test:e2e
npx supabase db push --dry-run
npx supabase db push
npm run build
```
