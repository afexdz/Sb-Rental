# Espace professionnel — Lot 1

`/agence` propose « Ma boutique » et « Mes véhicules ». Une agence approuvée arrive dans cet espace après connexion (via la redirection de `/mon-compte`). Les clients conservent leur espace client. Un accès direct sans session renvoie vers la connexion ; un dossier non approuvé ou un compte suspendu n’obtient pas le dashboard.

## Migration

`20260922000100_agency_workspace.sql` ajoute `agency_profiles`, le champ `vehicles.color`, la limite de trois photos et le bucket public `agency-assets`. Elle ne modifie pas les données Auth, ne supprime aucune donnée et ne change pas le bucket privé `agency-documents`.

`agency_profiles.id` référence `profiles.id`. Le slug unique est généré à la création depuis l’identifiant de l’agence et n’est pas modifiable par le navigateur. `updated_at` est entretenu par un trigger. Le profil boutique est créé lors de sa première sauvegarde ; aucune boutique fictive n’est insérée pour les comptes existants.

L’accès est déterminé par `profiles.role = 'agency'`, `profiles.account_status = 'active'` et `agency_requests.status = 'approved'`. La fonction SQL `is_approved_agency()` lit ces données à chaque requête, sans dépendre des métadonnées Auth modifiables par l’utilisateur. Une révocation de l’approbation ou une suspension bloque immédiatement les nouvelles opérations, même avec une session déjà ouverte.

| Ressource | Agence approuvée et active | Autres comptes |
| --- | --- | --- |
| Boutique | Lecture, création et modification de son profil | Aucun accès navigateur |
| Véhicules | Lecture, création et modification de sa flotte ; désactivation | Lecture admin conservée ; aucune nouvelle écriture autorisée |
| Identifiants / propriétaire / dates | Non modifiables par l’agence | Gestion privilégiée existante inchangée |
| Images `agency-assets` | Écriture et suppression uniquement dans `UUID-agence/` | Lecture des URL publiques uniquement |
| Registres `agency-documents` | Règles privées existantes | Règles privées existantes |

Les politiques RLS et les privilèges de colonnes empêchent une agence de modifier `agency_id`, `id`, `currency` ou `created_at`, et de supprimer un véhicule. La désactivation met `active` à `false`. Les huit sections et les RPC du back-office admin sont conservées.

La contrainte `vehicles_max_three_photos` utilise `cardinality(photos)`, y compris pour les tableaux multidimensionnels. Elle est validée immédiatement si les données existantes sont conformes. Si un ancien véhicule contient déjà plus de trois photos, la migration conserve ses données et laisse la contrainte `NOT VALID` : elle s’applique tout de même à chaque nouvelle insertion/modification. Il faut corriger explicitement les anciennes lignes avant une validation globale, sans troncature automatique des tableaux.

## Images et sauvegardes

Le navigateur accepte JPEG, PNG et WebP (source de 20 Mo maximum), décode réellement l’image, conserve son ratio et sa rotation, limite le grand côté à 1 600 px et réduit qualité/dimensions jusqu’à obtenir moins de 400 Ko. Le fichier envoyé est WebP, ou JPEG si l’encodage WebP n’est pas disponible. Le bucket limite également les types à JPEG/WebP et la taille à 400 Ko.

La sélection affiche les aperçus avant tout envoi. Trois photos maximum sont acceptées, en comptant celles déjà enregistrées. Les nouveaux fichiers ont des chemins uniques dans le dossier du propriétaire. Après un upload réussi, son chemin reste dans le formulaire pour éviter de doubler l’upload si la sauvegarde SQL échoue. Les erreurs conservent la saisie.

Retirer une photo du formulaire retire sa référence au prochain enregistrement. Aucun fichier déjà envoyé n’est effacé automatiquement du stockage : cela préserve les références existantes en cas d’échec ou d’opération concurrente. Les politiques permettent au propriétaire approuvé une suppression explicite via Storage. Un nettoyage des fichiers non référencés pourra être ajouté séparément.

Les prix sont saisis en DZD et convertis exactement en centimes, conformément à la table existante. Un nouveau véhicule est enregistré désactivé. « Publier » active le véhicule dans la flotte ; le catalogue public utilise toujours ses 24 fiches locales et n’est pas alimenté par ces écritures.

## Appliquer et vérifier

En local, sans reset :

```sh
npm run supabase:migrate
npm run check
npm run test:e2e
```

Pour le projet Cloud, après revue de la migration :

```sh
npx supabase link --project-ref cusyvndgjnpibfnzjhoa
npx supabase db push --dry-run
npx supabase db push
```

Les tests navigateur de ce lot refusent une URL Supabase non locale et nettoient uniquement leurs propres comptes et fichiers synthétiques. Ils couvrent les accès directs, les écritures croisées, les champs immuables, les limites de photos, les droits Storage, la révocation d’approbation, les formulaires, la compression, les erreurs réseau et le cycle publier/désactiver, sur ordinateur et mobile.

Ce lot n’ajoute ni chat, ni réservation, ni paiement Chargily, ni e-mail d’approbation.
