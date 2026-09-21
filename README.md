# SB Rental

Plateforme algérienne de location de voitures, avec comptes clients connectés à Supabase local.

## Démarrer sur le Mac

Node.js 22.16 ou supérieur (Node 24 recommandé), Docker Desktop démarré.

```sh
npm ci
npm run supabase:start
npm run supabase:env
npm run supabase:migrate
npm run dev
```

Ouvrir **http://127.0.0.1:5173/**. Les pages sont `/inscription`, `/connexion` et `/mon-compte`. Utilisez toujours cette même adresse pour retrouver la session du navigateur. Le port Vite est fixe et le rechargement à chaud est activé.

`supabase:env` écrit uniquement l’URL et la clé publique locale dans `.env.local`, ignoré par Git. Les autres variables existantes sont conservées. Redémarrez Vite après modification de l’environnement. `.env.example` documente les variables attendues. Aucune clé d’administration n’est chargée par le navigateur.

`supabase:start` crée un réseau Docker dédié à la boucle locale et vérifie chaque port publié. Sur la version installée, Docker ignore la liaison par défaut du réseau : un script applique alors explicitement `127.0.0.1` aux conteneurs concernés, conserve leurs volumes et leur configuration, et vérifie leur santé. Attendez le message « Ports Supabase vérifiés : accès limité au Mac ». Voir [les détails réseau et données](docs/accounts.md).

Pour arrêter Supabase en conservant ses données :

```sh
npm run supabase:stop
```

Pour une modification de `supabase/config.toml`, arrêter puis redémarrer Supabase avec ces commandes. Appliquer les migrations avec `npm run supabase:migrate`. Ne pas utiliser `supabase db reset` ou `supabase stop --no-backup` pour ce parcours : ces commandes effacent des données.

## Tester les comptes soi-même

1. Ouvrir http://127.0.0.1:5173/inscription.
2. Saisir un nom, une adresse e-mail et un mot de passe d’au moins 8 caractères, puis sa confirmation.
3. Cliquer sur **Créer mon compte** : « Mon compte » s’affiche. En local, la confirmation par e-mail est désactivée ; aucun e-mail réel n’est envoyé.
4. Modifier le nom et enregistrer. Actualiser la page : la session et le nom persistent.
5. Cliquer sur **Me déconnecter**, puis ouvrir directement `/mon-compte` : la connexion est demandée.
6. Se reconnecter avec le même e-mail et mot de passe. Tester aussi un mauvais mot de passe, un formulaire vide, une adresse invalide et des mots de passe différents.
7. Dans une fenêtre privée, créer un second compte : il possède son propre profil. Il ne voit aucune information du premier.
8. Vérifier l’affichage mobile avec le mode responsive du navigateur. Le site est volontairement inaccessible depuis un téléphone sur le réseau local.

## Fonctionnalités disponibles

- Accueil responsive en français, identité ivoire/graphite avec accents vert profond.
- Recherche par ville/dates, filtres, trois véhicules et fiches de démonstration.
- Inscription et connexion e-mail/mot de passe avec Supabase Auth.
- Session persistante, renouvellement des jetons, synchronisation entre onglets et déconnexion de la session courante.
- Compte protégé, affichage de l’e-mail et de la date d’inscription, modification du nom.
- Profils isolés par RLS PostgreSQL : lecture du sien, modification du nom uniquement ; aucun accès visiteur.
- États de chargement, erreurs en français, réessai du profil, navigation clavier.
- Images et polices servies localement.

Les véhicules, disponibilités et tarifs restent fictifs. Réservation et paiement ne sont pas encore disponibles. Les données des comptes sont réellement enregistrées dans Supabase local.

## Vérifier et construire

```sh
npm test                 # Validation des formulaires, recherches et Worker
npm run lint             # Analyse Oxlint
npm run build            # TypeScript + build client et Worker
npm run check            # Ces trois contrôles
npm run test:e2e          # Chromium ordinateur + mobile, Supabase et Vite locaux
npm run preview          # Aperçu du build Cloudflare sur la boucle locale
```

Au premier lancement des tests navigateur, installer Chromium si nécessaire : `npx playwright install chromium`.

Les tests e2e créent des comptes uniques puis suppriment uniquement ces comptes. Le processus Node utilise la clé d’administration fournie par le CLI pour ce nettoyage ; elle n’est ni écrite dans un fichier ni transmise au navigateur. Les tests couvrent le parcours complet, la persistance, les erreurs, les pannes, le renouvellement des jetons et les accès RLS entre deux clients. Les captures sont dans `test-results/`, ignoré par Git.

## Organisation

```text
src/auth/             Session et contexte d’authentification
src/components/       Composants accueil et cadre visuel des comptes
src/lib/              Client Supabase, validation Auth et recherche
src/pages/            Accueil, inscription/connexion, compte
supabase/config.toml  Configuration locale
supabase/migrations/  Migrations additives et règles RLS
scripts/              Démarrage local, liaison réseau et génération .env.local
worker/               Health check et routage des fichiers statiques
 tests/               Tests unitaires et e2e
 docs/                Architecture, comptes et provenance des visuels
```

Le build produit `dist/client/` et `dist/sb_rental/`. Le Worker exporte un gestionnaire `fetch`. Les navigations directes sont prises en charge par le mode SPA ; les chemins inconnus affichent une page 404. Les routes `/api/*` passent par le Worker.

`npm run deploy` reste réservé à une future publication Cloudflare. Aucun déploiement n’a été effectué. Les paramètres Auth, e-mail et réseau devront être adaptés pour un environnement de production.

Les visuels ont été produits avec Imagegen ; voir [leur provenance](docs/assets.md). L’override `sharp` applique une correction de sécurité aux dépendances Cloudflare transitives.
