# Protection des inscriptions

La migration `20260923000100_registration_uniqueness.sql` ajoute un index unique sur `normalize_rc_number(agency_requests.rc_number)` : normalisation Unicode NFKC, majuscules et suppression des caractères autres que lettres/chiffres. Le RC saisi reste conservé pour affichage. L’index protège aussi les requêtes directes et les inscriptions concurrentes. L’unicité existante de `profile_id` est conservée.

La migration ne modifie aucune ligne existante. Si plusieurs dossiers ont déjà le même RC normalisé, elle échoue entièrement, sans choisir de dossier à supprimer ou à réécrire. Ces dossiers nécessitent une décision métier avant une nouvelle tentative. La contrainte de longueur normalisée s’applique aux nouvelles écritures sans revalider les anciennes lignes.

`submit_agency_request` accepte uniquement le nom, le RC et le chemin d’un document privé appartenant à l’agence authentifiée et active. Elle crée ou corrige le dossier de ce profil, sans accepter de statut ni d’identifiant de profil du navigateur. Une correction conserve l’identifiant de la demande et remet le dossier en attente de vérification. Une répétition strictement identique préserve la décision de l’admin et ne crée pas d’événement d’audit supplémentaire. L’historique d’audit existant conserve les anciennes décisions. Aucune modification des fonctions ou écrans administrateur ni de la confidentialité du bucket `agency-documents`.

Les agences dont le dossier est refusé ou à corriger accèdent au formulaire prérempli après connexion. Le fichier précédent peut être conservé. Les dossiers en attente sont également modifiables depuis un compte déjà connecté. Le formulaire affiche le message demandé en cas de conflit RC. Si Auth a déjà créé un compte avant un conflit RC, ce compte reste utilisable pour corriger le numéro et terminer l’inscription ; aucun compte n’est supprimé automatiquement.

L’unicité des e-mails reste exclusivement assurée par Supabase Auth. Les erreurs `user_already_exists` / `email_exists` et les réponses masquées avec une liste d’identités vide affichent le même message générique. Le traitement s’arrête avant tout envoi de fichier ou de dossier. La création des profils reste liée aux triggers Auth existants, sans création depuis le navigateur.

## Application et tests

Appliquer uniquement les migrations manquantes en local :

```sh
npm run supabase:migrate
npm run check
npm run test:e2e
```

Après validation, pour le projet Cloud déjà lié (ces commandes ne sont pas exécutées dans cette livraison) :

```sh
npx supabase db push --dry-run
npx supabase db push
```

Appliquer la migration avant de publier le frontend qui utilise la nouvelle fonction. Ne jamais utiliser `db reset`. En cas de doublons historiques, arrêter l’application de la migration et examiner les dossiers avec le responsable métier ; aucune correction automatique n’est fournie.

Les tests utilisent exclusivement Supabase local. Ils vérifient deux formats d’un même RC, les insertions directes, les inscriptions simultanées, les corrections du propriétaire, les reprises identiques, les autorisations et les erreurs affichées. Les tests e-mail contrôlent l’absence d’écriture applicative et de nouveau profil/dossier, sur une erreur réelle et une réponse masquée simulée. Seules les données synthétiques créées par les tests sont nettoyées.
