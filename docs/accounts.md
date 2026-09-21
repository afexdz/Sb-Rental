# Comptes clients locaux

## Données et autorisations

La migration `20260914000100_customer_profiles.sql` ajoute `public.customer_profiles`, indexée par l’identifiant de `auth.users`. Un trigger crée le profil dans la même transaction que l’inscription. Les comptes préexistants reçoivent un profil sans modification de leurs données Auth. Aucune réinitialisation de la base n’est nécessaire.

Le profil contient `id`, `full_name` et `created_at`. L’e-mail et le mot de passe restent gérés par Supabase Auth ; aucun mot de passe n’est copié dans une table applicative. Le nom est limité à 100 caractères. Aucun rôle ni droit d’agence n’est dérivé des métadonnées modifiables du compte.

| Acteur | Lecture | Modification | Création / suppression via Data API |
| --- | --- | --- | --- |
| Visiteur | Refusée | Refusée | Refusée |
| Client | Son profil uniquement | Son `full_name` uniquement | Refusée |
| Autre client | Aucune ligne retournée | Aucune ligne modifiée | Refusée |

RLS compare `auth.uid()` avec `id`. Les privilèges SQL limitent les colonnes modifiables : impossible de déplacer un profil vers un autre compte ou de changer sa date. La fonction de création n’est pas exécutable par `anon` ou `authenticated`. Les filtres côté React complètent ces règles ; l’autorisation est appliquée par PostgreSQL, même lors de requêtes directes.

Le client Supabase conserve la session dans le stockage local du navigateur et renouvelle les jetons. Le routeur attend son initialisation avant d’afficher `/mon-compte`. La déconnexion utilise `scope: 'local'`, ce qui termine la session courante et les onglets qui la partagent. Comme dans le fonctionnement standard Supabase, un jeton d’accès déjà délivré expire à son échéance (1 h ici), tandis que le jeton de renouvellement est révoqué. La déconnexion efface la session du navigateur.

## Réseau local

Ports vérifiés :

| Service | Adresse |
| --- | --- |
| Site | `127.0.0.1:5173` |
| Supabase API | `127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322` |
| Studio | `127.0.0.1:54323` |
| Boîte e-mail de test | `127.0.0.1:54324` |
| Analytics | `127.0.0.1:54327` |
| Débogueur local Vite/Cloudflare | `127.0.0.1:9229` |

Le réseau `sb-rental-local` utilise l’option Docker `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`, selon la [documentation Supabase](https://supabase.com/docs/guides/local-development). Avec le CLI 2.117.0 et Docker Desktop présents sur ce Mac, cette option seule laissait les liaisons effectives sur `0.0.0.0` et `::`.

Le script `supabase-bind-local.mjs` complète cette option : il inspecte uniquement les conteneurs `supabase_*_sb-rental`, puis remplace ceux dont les ports sont exposés avec `HostIp: 127.0.0.1`. Les conteneurs originaux sont conservés jusqu’au contrôle de santé du remplacement, avec restauration en cas d’échec. Les volumes sont réutilisés et jamais supprimés. Les fichiers injectés par Supabase dans les conteneurs (notamment Kong) sont conservés via des images Docker locales `sb-rental-local/*:binding`. Ces images restent sur le Mac et ne doivent pas être publiées : elles contiennent la configuration locale.

Utiliser `npm run supabase:start` plutôt que `npx supabase start` directement. Sur cette version, la correction explicite intervient après le démarrage du CLI : les ports peuvent donc être ouverts pendant ce court intervalle, avant le message de vérification finale. Le script échoue si un port reste exposé. Il ne modifie ni les autres projets Docker ni le pare-feu du Mac. Les restrictions réseau de base de données destinées aux projets hébergés ne remplacent pas la vérification des ports Docker locaux.

## Validation reproductible

`npm run check` exécute les tests unitaires, Oxlint et TypeScript/Vite. `npm run test:e2e` exécute les mêmes parcours Chromium en 1440 px et en émulation mobile 390 px :

- Inscription réelle, lecture du profil, modification et actualisation.
- Déconnexion synchronisée entre onglets, accès direct refusé, reconnexion et doublon.
- Validation des formulaires sans appels Auth pour les saisies invalides.
- Chargement désactivant le bouton, erreur réseau, erreur de profil et réessai.
- Accès direct à la Data API avec deux comptes, un visiteur et un jeton invalide.
- Refus d’insertion, suppression, modification d’identifiant/date et modification du profil d’autrui.
- Renouvellement réel du jeton et refus de réutiliser le renouvellement après déconnexion.
- Absence d’erreur JavaScript dans le parcours nominal et absence de débordement horizontal ; captures pour contrôle visuel.

Références : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [événements de session](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
