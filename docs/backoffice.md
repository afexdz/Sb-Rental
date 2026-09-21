# Back-office SB Rental

## Démarrer

```sh
cd ~/Documents/Codex/sb-rental
npm run supabase:start
npm run supabase:migrate
npm run dev
```

- Application : http://127.0.0.1:5173
- Administration : http://127.0.0.1:5173/admin
- Supabase Studio : http://127.0.0.1:54323

Le compte local existant `admin@sbrental.local` et son mot de passe sont conservés. Pour une installation neuve, suivre [la création de l’administrateur](admin.md). Une inscription publique ne confère aucun droit admin. Aucun mot de passe utilisateur n’est envoyé au dashboard.

`supabase:start` prépare `.env.local` avec l’URL locale et la clé publique. Le navigateur n’utilise que `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Les services exposés sont liés à `127.0.0.1` par les scripts existants. Les migrations ajoutent les tables sans réinitialiser les données ; ne pas utiliser `supabase db reset` pour cette mise à jour.

## Tester les huit sections

| Section | Adresse | Vérification manuelle |
| --- | --- | --- |
| Vue d’ensemble | `/admin` | Vérifier les neuf indicateurs, dont les agences à approuver dans le bandeau. Changer Jour/Semaine/Mois/Année et la date de référence ; ouvrir « Voir les valeurs » des deux graphiques. |
| Utilisateurs | `/admin/utilisateurs` | Rechercher un nom/e-mail, filtrer Client/Agence et le statut, ouvrir « Voir le profil » et l’historique des réservations. |
| Agences | `/admin/agences` | Créer une agence sur `/inscription` avec un RC, puis consulter son dossier et le fichier privé. Tester approuver, refuser et demander une correction ; un motif est obligatoire pour ces deux dernières décisions. |
| Véhicules | `/admin/vehicules` | Rechercher une marque, un modèle ou une agence ; combiner catégorie/disponibilité/statut. Ouvrir une fiche pour les photos, le prix et le propriétaire. |
| Réservations | `/admin/reservations` | Rechercher une référence/client/agence/véhicule et filtrer les statuts ou dates. Ouvrir le détail, modifier le statut ou une note. Un acompte enregistré et confirmé est nécessaire pour passer à « Acompte payé ». |
| Finances | `/admin/finances` | Comparer les montants aux transactions, filtrer statut/type/date/référence et exporter le CSV. Ouvrir un paiement et enregistrer une note de suivi. |
| Messages | `/admin/messages` | Rechercher et filtrer les conversations, ouvrir un échange et vérifier que ses messages deviennent lus pour cet administrateur. |
| Journal | `/admin/journal` | Retrouver une décision agence ou modification de réservation/note de paiement. Vérifier l’auteur, la date et les valeurs avant/après dans « Voir les changements ». |

Les tables métier vides affichent zéro ou un état vide. Aucun revenu ni réservation de démonstration n’est importé. Le back-office consulte les transactions enregistrées : la création des paiements Chargily, leur webhook et l’alimentation des réservations/conversations depuis le site public ne sont pas encore intégrées. La consultation administrative des messages n’envoie pas de message au client ou à l’agence.

Sur mobile/tablette, ouvrir la navigation avec le bouton du bandeau ; tester la fermeture, la touche Échap et le clavier. Les tableaux défilent horizontalement dans leur cadre et sont paginés par 20 lignes. Une actualisation du navigateur conserve la session. Après « Quitter », ouvrir directement une URL admin doit ramener à la connexion. Un compte Client/Agence ordinaire doit voir « Accès refusé ».

## Règles financières

- Montants stockés en centimes de dinar, devise DZD ; aucun calcul à partir du catalogue public de démonstration.
- Chiffre d’affaires réservé : somme des réservations confirmées, acompte payé, livrées et terminées ; demandes et annulations exclues. Il s’agit du montant des locations, pas du revenu propre de SB Rental.
- Acompte attendu et commission attendue : chacun 10 % du total, calculés par PostgreSQL et arrondis au centime. Ils ne constituent pas deux encaissements additionnels.
- Total payé : paiements confirmés, avant remboursement ; les paiements en attente ou échoués sont exclus.
- Acomptes encaissés : paiements de type acompte confirmés, nets des remboursements.
- Commission encaissée : allocation explicitement enregistrée sur les paiements, moins sa part remboursée. Le dashboard ne déduit pas une commission acquise d’une simple demande ou estimation.
- Solde agence : montant encaissé moins remboursements, commission nette et versements déjà effectués. Les soldes sont regroupés par agence : les sommes à payer et à récupérer sont affichées séparément, sans compenser la dette d’une agence avec la créance d’une autre.
- Graphiques : réservations selon leur date de création ; revenus nets et commissions selon la date effective de confirmation/remboursement. Les périodes utilisent le fuseau d’Alger et les semaines commencent le lundi. Les filtres temporels de la vue d’ensemble s’appliquent aux graphiques ; les cartes sont cumulatives et identifiées comme telles.
- Le CSV contient uniquement les transactions filtrées, leurs références, allocations, dates et statuts. Les cellules sont échappées, y compris les entrées pouvant être interprétées comme formules.

Les tables de paiements portent une allocation de remboursement cumulée et sa date, adaptées à cette première version. Avant d’intégrer plusieurs remboursements partiels à des dates différentes pour un même paiement, ajouter une table d’événements financiers pour conserver chaque mouvement et une idempotence de webhook.

## Base et sécurité

La migration `20260914000400_admin_backoffice.sql` crée `vehicles`, `reservations`, `payments`, `conversations`, `conversation_messages`, `conversation_admin_reads` et `admin_audit_logs`, ainsi que les index des propriétaires, dates, statuts et relations. Elle ajoute `profiles.account_status` pour l’affichage du statut ; la suspension Auth effective reste une opération serveur.

Les politiques RLS autorisent l’administrateur à consulter les données ; les clients/agences accèdent uniquement à leurs propres lignes métier. Les visiteurs n’ont pas accès aux nouvelles tables. La route admin vérifie `is_admin()` avant de charger ses collections. Les listes sont récupérées par lots de 500 pour éviter la troncature à 1 000 lignes de l’API. La pagination et les filtres d’affichage sont actuellement locaux ; une volumétrie importante nécessitera une pagination et des agrégations serveur.

Les écritures du navigateur passent uniquement par des fonctions PostgreSQL dédiées :

- `admin_review_agency` : décision motivée, auteur et heure côté serveur.
- `admin_update_reservation` : transitions autorisées et vérification d’un acompte effectivement confirmé.
- `admin_note_payment` : note uniquement, aucun montant ou statut de paiement modifiable depuis le navigateur.
- `admin_read_conversation` : état de lecture propre à l’administrateur connecté.

Les fonctions contrôlent les droits, les valeurs et les mises à jour périmées. Les contraintes empêchent de dépasser le total de réservation ou la commission attendue dans les paiements confirmés. Les triggers journalisent les changements réellement effectués dans la transaction ; ni un compte ordinaire ni un admin navigateur ne peut fabriquer ou effacer une entrée. Une modification serveur sans identité Auth est affichée comme « Système / traitement serveur ». La migration `20260915000100_complete_admin_audit.sql` conserve aussi les changements de dates et de références.

## Validation automatisée

```sh
npm run check
npm run test:e2e
```

`check` exécute les tests unitaires, l’analyse et la compilation TypeScript/Vite. Playwright vérifie les parcours réels sur Supabase local en vues ordinateur et mobile, ainsi qu’une capture tablette. Il couvre l’inscription, le RC, la session après actualisation, la déconnexion, les refus d’accès, les décisions agence, les huit sections, les finances, le CSV, la lecture des messages et l’audit. Les assertions RLS utilisent la clé publique des comptes de test.

Les scénarios du back-office créent des données identifiées `TEST` et des comptes temporaires `sb-backoffice-…@example.test`, puis nettoient uniquement leurs identifiants. La clé de service locale est utilisée exclusivement dans le processus Node de test pour préparer/nettoyer ces fixtures, jamais dans le frontend. Les scénarios de zéro et de totaux exacts supposent les tables métier locales vides au départ ; ils ne les vident pas si vous y avez ajouté vos propres données. Les captures sont placées dans `test-results/`.

## Fichiers de cette évolution

Modifiés :

- `src/App.tsx` : routes admin imbriquées.
- `src/pages/AdminPage.tsx` : contrôle d’accès et composition des sections.
- `tests/e2e/agencies-admin.spec.ts` : navigation, correction/approbation/refus et audit.
- `docs/admin.md`, `docs/architecture.md` : documentation actualisée.

Créés :

- `supabase/migrations/20260914000400_admin_backoffice.sql`
- `supabase/migrations/20260915000100_complete_admin_audit.sql`
- `src/admin/types.ts`, `model.ts`, `api.ts`, `context.ts`, `useAdminData.ts`, `useFilters.ts`, `navigation.ts`, `admin.css`
- `src/admin/components/Sidebar.tsx`, `AdminLayout.tsx`, `AdminLogin.tsx`, `StatCards.tsx`, `DataTable.tsx`, `Filters.tsx`, `Charts.tsx`, `UI.tsx`, `ActionForm.tsx`
- `src/admin/sections/Overview.tsx`, `Users.tsx`, `Agencies.tsx`, `Vehicles.tsx`, `Reservations.tsx`, `Finances.tsx`, `Messages.tsx`, `Audit.tsx`
- `tests/admin.test.ts`, `tests/e2e/backoffice.spec.ts`
- `docs/backoffice.md`
