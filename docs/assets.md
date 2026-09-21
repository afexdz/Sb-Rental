# Visuels SB Rental

## Catalogue actuel : 24 photos réelles

Les 24 fiches du catalogue public utilisent des photographies réelles de leurs modèles, téléchargées depuis Wikimedia Commons dans `public/images/vehicles/`. Les trois fiches initiales sont conservées ; leurs anciennes illustrations générées ont été remplacées à l’affichage par des photographies. Les anciens fichiers sont conservés, mais ne sont plus référencés par le catalogue.

Chaque image possède une licence libre CC BY, CC BY-SA ou CC0. L’auteur, la page source et le lien vers la licence sont accessibles dans la fiche du véhicule. Les versions de 960 pixels fournies par Wikimedia sont stockées localement ; aucun CDN d’images n’est utilisé à l’exécution. L’affichage peut cadrer les photos. Une photo illustre un modèle et peut représenter une autre finition que la fiche de démonstration.

Le détail des crédits se trouve dans [le registre des photographies](../public/images/vehicles/CREDITS.md), dans `public/images/vehicles/credits.json` et dans `src/data/vehiclePhotos.ts`. Les licences des images restent applicables à leur réutilisation ; elles ne changent pas la licence du code du projet.

Le catalogue reste une collection de démonstration locale, avec des prix indicatifs et une disponibilité à confirmer. Aucun véhicule n’est injecté dans Supabase : l’accueil utilise `src/data/vehicles.ts`, indépendamment des tables du back-office. Aucune réservation ni aucun paiement n’est créé.

## Historique des illustrations générées

Seul le visuel de couverture `coastal-drive.jpg` reste utilisé sur l’accueil. Les trois illustrations de véhicules ci-dessous sont des anciens assets, conservés pour ne supprimer aucune ressource existante.

Historique : quatre visuels générés avec l’outil **Imagegen intégré**, en un lot parallèle sans variantes. Ce sont des illustrations, pas des photos de véhicules réellement proposés par des agences. Les marques/modèles servent uniquement à rendre le catalogue de démonstration concret.

Les fichiers JPEG locaux ont été encodés en qualité 82. Le hero conserve 1536 × 1024 pixels ; les trois photos de catalogue sont réduites à 1000 pixels de large. Aucun asset n’est chargé depuis le répertoire personnel de génération ou un CDN.

## public/images/coastal-drive.jpg

```text
Use case: photorealistic-natural
Asset type: editorial hero photograph for a premium French-language SB Rental car-rental homepage
Create one final landscape photo, 1536x1024. An elegant metallic silver Porsche 911 style grand touring coupe, with no required logos, is parked in front three-quarter view facing LEFT on a curving Mediterranean coastal road reminiscent of Algeria. Chalk limestone cliffs and muted Mediterranean blue sea in the background. Sunwashed warm morning light, timeless premium automotive editorial photography, lightly grainy. The car occupies the lower middle half of the composition. Muted ivory, silver and graphite palette. Realistic materials, proportions and reflections. This is an illustrative demo vehicle. No text, no UI, no watermark.
```

## public/images/peugeot-208.jpg

```text
Use case: product-mockup
Asset type: vehicle catalogue photograph for a premium French-language SB Rental car-rental homepage
Create one final landscape photo, 1536x1024. A white Peugeot 208 style compact hatchback, shown in front three-quarter view facing LEFT, centered on a seamless very pale warm gray studio background. Realistic premium automotive photography with soft studio lighting and a soft ground shadow. Entire car visible, comfortably framed, a consistent eye-level catalogue view. This is an illustrative demo vehicle. No text or watermarks.
```

## public/images/volkswagen-golf.jpg

```text
Use case: product-mockup
Asset type: vehicle catalogue photograph for a premium French-language SB Rental car-rental homepage
Create one final landscape photo, 1536x1024. A dark graphite Volkswagen Golf 8 style hatchback, shown in front three-quarter view facing LEFT, centered on a seamless very pale warm gray studio background. Realistic premium automotive photography with soft studio lighting and a soft ground shadow. Entire car visible, comfortably framed, a consistent eye-level catalogue view. This is an illustrative demo vehicle. No text or watermarks.
```

## public/images/hyundai-tucson.jpg

```text
Use case: product-mockup
Asset type: vehicle catalogue photograph for a premium French-language SB Rental car-rental homepage
Create one final landscape photo, 1536x1024. A pearl-white Hyundai Tucson style SUV, shown in front three-quarter view facing LEFT, centered on a seamless very pale warm gray studio background. Realistic premium automotive photography with soft studio lighting and a soft ground shadow. Entire car visible, comfortably framed, a consistent eye-level catalogue view. This is an illustrative demo vehicle. No text or watermarks.
```
