# Administration et validation des agences

Le compte administrateur local utilise l’adresse `admin@sbrental.local`. Ses droits sont liés à son identifiant Supabase dans `public.app_admins.user_id` ; son mot de passe est créé dans Supabase Auth et n’est jamais enregistré dans le code. L’inscription publique avec un e-mail présent dans cette table ne suffit pas à devenir administrateur.

## Créer l’administrateur en local

1. Démarrer Supabase avec `npm run supabase:start`.
2. Ouvrir Studio sur http://127.0.0.1:54323.
3. Ouvrir **Authentication → Users → Add user**.
4. Créer `admin@sbrental.local` avec un mot de passe long et activer la confirmation si Studio le propose.
5. Pour une nouvelle installation, attribuer explicitement les droits dans l’éditeur SQL de Studio, après avoir vérifié l’identité du compte créé :

```sql
insert into public.app_admins (email, user_id)
select lower(email), id from auth.users where lower(email) = 'admin@sbrental.local'
on conflict (email) do update set user_id = excluded.user_id;
```

6. Ouvrir http://127.0.0.1:5173/admin et se connecter avec ces identifiants.

Le rôle admin ne peut pas être choisi depuis le formulaire public. La migration corrective conserve les administrateurs déjà présents en associant leurs identifiants ; elle n’attribue aucun droit automatiquement aux inscriptions futures. `is_admin()` vérifie cet identifiant avant d’exposer les données. Le frontend utilise uniquement la clé publique Supabase.

Les agences s’inscrivent avec leur identité, leur nom commercial, leur numéro RC et un PDF ou une image du registre. Leur fichier est stocké dans le bucket privé `agency-documents`. Depuis le dashboard, l’admin peut ouvrir un lien signé temporaire, puis approuver, refuser ou demander une correction motivée. La décision est journalisée dans la même transaction PostgreSQL.

Les fichiers acceptés sont PDF, JPEG et PNG, non vides, jusqu’à 10 Mo. En cas d’échec, le formulaire permet de reprendre l’envoi sans recréer le compte. Après une actualisation ou une reconnexion, une agence sans dossier peut le compléter depuis « Mon compte ». Les agences en attente ou refusées ne peuvent pas contourner cet état en modifiant leurs métadonnées Auth ou en ouvrant directement `/mon-compte`.

La base refuse l’auto-approbation, les champs réservés à la décision admin et les documents inexistants ou appartenant à une autre agence. Le dashboard conserve ses statistiques, son annuaire et ses boutons d’approbation/refus ; ses listes sont lues par lots pour ne pas être tronquées à la limite de 1 000 lignes de l’API. Les modifications de nom dans « Mon compte » sont répercutées dans l’annuaire admin.

## Appliquer une nouvelle migration locale

Les migrations d’origine sont conservées. `20260914000400_admin_backoffice.sql` ajoute les tables métier, index, RLS et opérations admin contrôlées ; `20260915000100_complete_admin_audit.sql` complète les informations du journal. Appliquer les migrations avec `npm run supabase:migrate`, sans réinitialiser la base ni supprimer les comptes existants.

Le [guide du back-office](backoffice.md) décrit les huit sections, les calculs financiers, les fichiers concernés et les tests locaux.

`npm run test:e2e` vérifie les parcours clients, l’envoi réel du registre, sa reprise après échec, le dashboard, l’approbation/refus, les documents privés et les refus d’accès. Les comptes admin de test et fichiers temporaires sont créés uniquement sur Supabase local puis nettoyés ; les comptes existants ne sont pas modifiés. `npm run check` exécute les tests unitaires, l’analyse et la compilation.
