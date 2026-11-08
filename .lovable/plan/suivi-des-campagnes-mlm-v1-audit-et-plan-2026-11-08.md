# Suivi des campagnes MLM V1 — audit et plan

## 1. Données disponibles aujourd'hui et limites d'attribution

Constats vérifiés dans le code et la base :
- **content_posts** (Planificateur) : canal (whatsapp/facebook/autre), objectif, `planned_on`, statut brouillon/prévu/publié, et `published_at` fixé par le serveur. Il n'existe aucun lien vers une campagne ni vers un prospect.
- **prospects** : `source` est un texte libre. Le formulaire propose la liste Facebook / WhatsApp / Marché chaud / Recommandation / Autre. La page de capture écrit « Page de capture » et l'import CSV recopie la valeur du fichier. Aujourd'hui en base : 11 prospects sans source et 1 « Facebook ». Les dates disponibles sont `created_at`, `first_contact_at` et `joined_team_at`, avec un statut actuel.
- **prospect_events** : historique, dont `changement_statut` au format « Ancien → Nouveau ». Il est déjà lu par `src/lib/conversion.ts`.
- **conversion.ts** : calculs purs déjà testés (`conversionRate`, `cohortConversion`, `statusTransitions`), qui renvoient « insufficient » quand les données manquent. La carte Statistiques s'appuie dessus.

Limites à afficher clairement dans l'app :
- Il n'y a ni vues, ni clics, ni portée, ni revenus. WhatsApp et Facebook ne renvoient aucune donnée, donc rien de cela ne sera affiché.
- L'attribution sera **uniquement manuelle**, faite par l'utilisateur dans la fiche prospect. Rien ne sera déduit automatiquement de la date ou du canal.
- Une « conversion » = prospect attribué dont le statut **actuel** est Client, comme dans les Statistiques. On affiche aussi les prospects ayant rejoint l'équipe (`joined_team_at`) comme second indicateur, sans les additionner aux clients.
- Les prospects existants restent non attribués. Aucun rattrapage automatique.

## 2. UX et parcours

Nouvelle page **« Campagnes »**, accessible depuis le menu et le Centre de commande avec l'intention « campagne ».
1. **Liste des campagnes** : nom, objectif, période et canal, avec 4 chiffres réels (statuts publiés, prospects attribués, clients, taux). Filtres par période (en cours, terminées, toutes, ou dates personnalisées), par canal et par campagne. Archiver remplace supprimer, pour garder l'historique.
2. **Créer / modifier une campagne** : nom (80 caractères max), objectif (mêmes 5 valeurs que le Planificateur), canal (WhatsApp, Facebook, autre ou multi), date de début et date de fin. Note optionnelle de 500 caractères max.
3. **Détail d'une campagne** :
   - indicateurs avec la mention « Aucune donnée » quand il n'y en a pas ;
   - liste des statuts liés et des prospects attribués ;
   - recommandations simples (section 2b).
4. **Planificateur** : dans le formulaire d'un statut, un choix facultatif « Campagne », filtré sur les campagnes actives. Un badge s'affiche sur la carte du statut.
5. **CRM, fiche prospect** : deux choix facultatifs, « Campagne » et « Contenu source ». Le second liste uniquement les statuts publiés, de la campagne choisie si elle est remplie. On ajoute aussi un filtre « Campagne » dans la liste des prospects. Chaque attribution est notée dans l'historique du prospect.

### 2b. Recommandations (règles locales, sans IA, sans quota)
Uniquement à partir des chiffres affichés, avec un seuil minimal pour éviter les conclusions sur trop peu de données :
- « Aucun statut publié pour cette campagne » → lien vers le Planificateur.
- Des statuts sont publiés mais aucun prospect n'est attribué → « Pensez à indiquer la campagne dans la fiche des prospects qui vous ont contacté. »
- Au moins 5 prospects attribués et 0 client → lien vers les relances ou les objections.
- Au moins 2 campagnes avec au moins 5 prospects chacune → « La campagne X convertit le plus (n/N) », avec le rappel que l'échantillon est petit.
- La campagne se termine dans 3 jours ou moins et a des prospects en discussion ou intéressés → les relancer.

Aucun message n'est envoyé. Chaque recommandation est un lien vers un outil existant.

## 3. Tables, champs et migrations (additives)

Migration 0025 :
- **Nouvelle table `campaigns`** : id, user_id (défaut `auth.uid()`), name, objective, channel, starts_on et ends_on (date seule), note, archived, created_at et updated_at.
  - CHECK sur les longueurs, les valeurs autorisées et `ends_on >= starts_on`.
  - Index sur (user_id, starts_on).
- **Colonne `content_posts.campaign_id`** : uuid nullable qui référence `campaigns`, avec ON DELETE SET NULL.
- **Colonnes `prospects.campaign_id` et `prospects.source_post_id`** : uuid nullables qui référencent `campaigns` et `content_posts`, avec ON DELETE SET NULL. Index partiels sur ces colonnes.
- **Triggers BEFORE** :
  - sur `content_posts`, ajout de la vérification dans le garde existant ;
  - sur `prospects`, un nouveau garde léger.
  - Ils refusent toute campagne ou tout contenu qui n'appartient pas au même utilisateur. Ils refusent aussi un `source_post_id` non publié, ou rattaché à une autre campagne que le `campaign_id` indiqué.
- **Grants** : authenticated et service_role uniquement, avec `REVOKE ... FROM anon`.
- **RLS** : 4 policies propriétaire `user_id = auth.uid()`.

Aucune colonne existante n'est modifiée ni supprimée. Le champ `source` reste tel quel, puisque le canal de la campagne apporte l'information.

## 4. Code réutilisé et nouveaux fichiers

Réutilisé :
- `conversion.ts` : `conversionRate` et `cohortConversion` appliqués au sous-ensemble des prospects attribués ;
- `content-planner.ts` : OBJECTIVES, CHANNELS et `dbError` ;
- `useCrm`, `prospect-tools.tsx` (formulaire de fiche) et `prospect-io.tsx` (Filters) ;
- `logProspectEvent`, avec un nouveau type `campagne_attribuée` ;
- `command-center.ts` (intention) et `plan-gate.tsx` (UpgradeCard) ;
- AppShell et le menu.

Nouveaux fichiers :
- `src/lib/campaigns.ts` : règles pures (validation, période active, `campaignMetrics`, `recommendations`, filtres) ;
- `src/lib/campaigns.test.ts` ;
- `src/routes/_authenticated/campagnes.tsx`, avec un head() propre ;
- `src/components/campaign-picker.tsx`, partagé entre le Planificateur et la fiche prospect.

Toutes les écritures passent par le client navigateur sous RLS, avec les triggers comme source de vérité, comme pour le Planificateur. Il n'y a ni appel IA ni nouvelle fonction serveur.

## 5. Accès, RLS, plans et quotas

- Les données sont strictement privées. Ni le leader, ni les membres, ni les visiteurs non connectés n'y ont accès. `team_member_progress` n'est pas modifié.
- Aucun quota IA n'est consommé. Tarifs et quotas globaux inchangés.
- **Décision à valider (proposition)** : créer des campagnes et attribuer des prospects est ouvert à tous les plans. Le Gratuit est limité à 1 campagne active, contrôlée par un trigger avec `effective_plan`. La comparaison entre campagnes et les filtres avancés (dates personnalisées, multi-canal) suivent la fonctionnalité existante `advancedStats` (Expert et Business). Autre option possible : tout ouvrir sans limite.

## 6. Tests d'acceptation, risques et estimation

Tests `bun:test` :
- validation (longueurs, valeurs autorisées, dates inversées) ;
- campagne active selon les dates ;
- indicateurs : les prospects non attribués sont exclus, 0 prospect → « insufficient », taux arrondi ;
- seuils des recommandations : rien sous 5 prospects ;
- filtres par période, canal et campagne ;
- limite du plan Gratuit.

Vérification en base :
- refus d'une campagne appartenant à un autre utilisateur, même par appel direct ;
- refus d'un contenu non publié ;
- policies et droits vérifiés, anon sans accès.

Vérification à l'écran sur mobile :
- créer une campagne ;
- lier un statut publié ;
- attribuer un prospect, le passer en Client et voir le taux.

Risques :
- La qualité des chiffres dépend de la saisie manuelle. Un message explicatif sera affiché.
- Les petits volumes donnent des taux trompeurs, d'où les seuils et la mention de l'échantillon.
- Le taux est calculé sur le statut actuel, pas sur une date de conversion historique. Ce sera indiqué.
- Le formulaire prospect est déjà dense : les nouveaux champs iront dans une section repliable.

Estimation : 4 à 6 crédits (migration, règles et tests, page, intégrations Planificateur et CRM, vérification).

## 7. Ordre d'implémentation
1. Migration 0025, puis régénération des types et vérification des droits et triggers.
2. `campaigns.ts` et ses tests.
3. Page Campagnes : liste, création, archivage, filtres.
4. Sélecteur de campagne dans le Planificateur.
5. Fiche prospect (campagne et contenu source), filtre CRM et événement d'historique.
6. Détail de campagne : indicateurs et recommandations, plus la gate du plan.
7. Intention dans le Centre de commande et entrée dans le menu.
8. Tests, vérification mobile, mise à jour de la roadmap et d'AGENTS.md, puis compte rendu.
