# Plan d'action MLM 30 jours — V1 (plan technique)

## 1. Ce qui existe et sera réutilisé (vérifié dans le code)
- **Objectifs hebdo** : la table `user_goals_weekly` contient une seule ligne par utilisateur (contacts, relances, recrues). Elle est lue par le Coach du jour (`coach-card.tsx`), le bilan de semaine (`coach-week.tsx`) et `weekly-goals.tsx`.
- **Calculs du Coach** (`src/lib/coach.ts`, sans IA) :
  - `weeklyRecap` compte les contacts (« message_envoyé » par prospect distinct) et les relances. Les « recrues » y sont les passages au statut Client.
  - `dailyRecap` donne l'objectif du jour = objectif hebdo ÷ 5.
  - Autres fonctions disponibles : `mondayOf`, `localDay`, `streak`, `suggestNextGoals` (+10 % si l'objectif est atteint) et les jours de repos (`profiles.preferences.coach`).
- **Statuts publiés** : la table `content_posts`, où `published_at` est fixé par le serveur.
- **Campagnes** : la table `campaigns`. Le lien vers les statuts et les prospects existe déjà.
- **Contrôle des plans** :
  - côté écran : `hasFeature` et `FEATURE_MIN_PLAN` dans `src/lib/plans.ts`, avec `UpgradeCard` ;
  - côté base : `effective_plan(user_id)` ; c'est sur lui que s'appuieront les contrôles.
- **Centre de commande** : `buildBrief` (ligne « coach », « statut », etc.).
- **Migrations** : le dossier `drizzle/migrations` va jusqu'à 0026 et `drizzle/schema.ts` est volontairement vide. Les migrations sont écrites en SQL, de façon additive.

Conflits relevés :
- **Une seule ligne d'objectifs** dans `user_goals_weekly` : écrire le plan dedans écraserait les objectifs manuels. Décision proposée : le plan garde ses propres cibles par semaine. À l'activation, et à chaque nouvelle semaine du plan, il **propose** de recopier ses cibles dans les objectifs hebdo, sans le faire automatiquement.
- **Le mot « recrues »** : le Coach compte en réalité des passages au statut Client. Le plan nommera les choses honnêtement : « nouveaux clients » pour le but Clients, « recrues = prospects ayant rejoint l'équipe (`joined_team_at`) » pour le but Recruter.

## 2. Modèle de données (une migration additive)
**Table `action_plans`** (privée par utilisateur) :
- `id`, `user_id` (défaut `auth.uid()`)
- `goal` : `clients | recruter | relancer`
- `target` : entier de 1 à 50, nombre de clients, de recrues ou de relances visées
- `minutes_per_day` : 15, 30 ou 60
- `rest_days` : liste de jours de 0 à 6 ; par défaut, ceux réglés dans le Coach
- `starts_on` (date, toujours un lundi) ; `ends_on` = `starts_on` + 27 jours, calculé par la base
- `campaign_id` : facultatif, lien vers `campaigns`
- `status` : `actif | termine | abandonne`
- `created_at`, `updated_at`

**Table `action_plan_weeks`** (4 lignes par plan) :
- `plan_id`, `user_id`, `week_index` (de 1 à 4)
- cibles : `contacts_target`, `relances_target`, `posts_target`, de 0 à 500
- `adjusted` (booléen) et `adjust_note` (texte court expliquant l'adaptation)
- `reviewed_at` (date du bilan validé)
- l'adaptation se fait par **modification des cibles**, sans aucun champ « résultat ».

**Aucune table de « réalisé »** : les résultats sont toujours recalculés depuis les données existantes, dans l'historique prospects (`prospect_events`), `content_posts` (statuts publiés) et `prospects` (statut Client, `joined_team_at`). Rien n'est saisi ni inventé.

**Sécurité** :
- **Droits** : accès réservé aux utilisateurs connectés, sur leurs seules lignes. Aucun accès anon ni leader.
- **Règles RLS** : 4 règles propriétaire par table.
- **Trigger SECURITY DEFINER `action_plan_guard`** :
  - le propriétaire ne peut pas changer ;
  - refus `PLAN_PAYANT_REQUIS` si `effective_plan(user_id) = 'gratuit'` à la création, à la réactivation et à la modification des cibles. Les données restent lisibles après un passage au plan Gratuit ;
  - un seul plan `actif` à la fois, protégé par un verrou ;
  - `starts_on` doit être un lundi ;
  - la campagne liée doit appartenir au même utilisateur ;
  - pour les semaines : `plan_id` et `user_id` doivent correspondre, `week_index` est unique, et une semaine déjà validée par un bilan ne peut plus être modifiée.
- **Index** : `(user_id, status)` et `(plan_id, week_index)`.

## 3. Règles pures — `src/lib/action-plan.ts` (+ tests)
- **`buildWeeks(goal, target, minutesPerDay, restDays, baseline)`** répartit sur 4 semaines avec une montée progressive (environ 80 %, 100 %, 110 %, 110 %). Bornes :
  - capacité selon le temps disponible : 15 min ≈ 3 actions par jour ouvré, 30 min ≈ 6, 60 min ≈ 10 ;
  - nombre de jours ouvrés = 7 moins les jours de repos.
- **Taux de conversion personnel** : il vient du calcul existant (`conversion.ts`) s'il repose sur au moins 5 prospects. Sinon, une **hypothèse prudente affichée comme telle** sert à estimer combien de contacts il faut pour viser N clients (valeur à valider, section 7). La cible reste une cible d'activité, jamais une promesse.
- **`weekActuals(monday, events, posts, prospects)`** reprend `weeklyRecap` pour les contacts et les relances, et y ajoute les statuts publiés de la semaine, plus les clients ou recrues selon le but.
- **`dayProgress(today, plan, week, actuals)`** donne le jour X/28, les actions faites et restantes cette semaine, et la part du jour (restant ÷ jours ouvrés restants).
- **`adaptNext(week, actuals)`** : si moins de 70 % de l'objectif est atteint, il **propose** pour la semaine suivante le maximum entre 85 % de l'objectif et le réalisé + 20 %, sous la capacité. Si l'objectif est atteint, il reprend la règle +10 % de `suggestNextGoals`. Ce n'est qu'une proposition : l'utilisateur l'accepte ou la modifie, avec une note d'explication.
- **`canUseActionPlan(plan)`** = `hasFeature(plan, "actionPlan")`, nouvelle entrée de `FEATURE_MIN_PLAN` fixée à `pro`, dans le même système que l'existant.

## 4. Interface (mobile-first, design existant)
Nouvelle page **`/plan-action`** (menu, et intention « plan » dans le Centre de commande) :
1. **Si aucun plan** : assistant en 3 étapes.
   - le but et la cible ;
   - le temps disponible et les jours de repos, préremplis depuis le Coach ;
   - le lundi de départ (cette semaine ou la suivante) et une campagne facultative.
   L'utilisateur voit les 4 semaines proposées, modifiables, puis active le plan.
2. **Plan actif** :
   - en tête : jour X/28 et barre de progression de la semaine (contacts, relances, statuts), « restant aujourd'hui » ;
   - boutons vers les outils existants : Prospects (relances), Planificateur, Campagne ;
   - 4 cartes semaine avec prévu / réalisé ;
   - « Modifier mon objectif ou mes disponibilités » recalcule uniquement les semaines non validées ;
   - « Abandonner » passe le plan en statut `abandonne`, sans rien supprimer.
3. **Bilan hebdo** (dès le lundi suivant) : tableau prévu / réalisé et proposition d'adaptation. L'utilisateur choisit « Accepter », « Modifier » ou « Garder », puis valide (`reviewed_at`). Il peut aussi recopier les cibles dans les objectifs hebdo.
4. **Fin (jour 28 passé)** : bilan sur les 4 semaines, plan passé en statut `termine`, et bouton « Nouveau plan ».
- **Plan Gratuit** : `UpgradeCard` avec le plan minimum Pro ; aucune donnée payante n'est chargée.

**Liaison avec le Coach** (lecture seule, sans dupliquer de calcul) :
- `coach-card.tsx` : si un plan est actif, l'objectif du jour vient de `dayProgress` au lieu d'objectif hebdo ÷ 5. Une ligne « Plan 30 jours : X actions restantes aujourd'hui » s'ajoute, avec un lien. Les missions du Coach restent identiques.
- `buildBrief` : nouvelle ligne `plan` (« Jour X/28 · N restantes »). Un bilan à valider passe en priorité.
- `coach-week.tsx` : si la semaine correspond à une semaine du plan, il affiche « prévu par le plan » à côté du réalisé.

## 5. Accès par plan et quotas
- **Gratuit** : pas d'accès. La base refuse aussi la création et la modification, quoi que fasse le navigateur.
- **Pro, Expert, Business** : accès complet, identique pour les trois en V1.
- **Aucun appel IA**, donc 0 quota consommé. Tarifs et quotas inchangés. Aucun envoi ni aucune publication automatique.
- **Si l'abonnement expire** : le plan reste visible en lecture avec une invitation à se réabonner. Le Coach revient à son comportement normal.

## 6. Tests d'acceptation
Tests `bun:test` :
- répartition sur 4 semaines : progression, bornes de capacité selon les minutes et les jours de repos ;
- taux personnel au-dessus de 5 prospects, hypothèse affichée en dessous ;
- calcul du réalisé : la semaine compte exactement les mêmes contacts et relances que `weeklyRecap`, plus les statuts publiés ;
- `dayProgress` : jour X, restant, jours de repos, semaine terminée ;
- `adaptNext` : sous 70 %, entre 70 et 100 %, objectif atteint ; jamais de valeur « réalisée » modifiée ;
- `canUseActionPlan` : Gratuit refusé, Pro, Expert et Business acceptés ;
- Centre de commande : ligne `plan` et intention « plan ».

En base, testé sur des données temporaires annulées ensuite :
- un compte Gratuit est refusé ;
- un second plan actif est refusé ;
- un `starts_on` qui n'est pas un lundi est refusé ;
- une campagne d'un autre compte est refusée ;
- une semaine déjà validée ne peut plus être modifiée ;
- aucun accès anon.

Vérification sur mobile (390 px) avec votre compte payant :
- créer un plan ;
- le voir dans le Coach et le Centre de commande ;
- modifier les disponibilités ;
- ouvrir le plan sur un second navigateur pour vérifier la reprise sur un autre appareil ;
- abandonner le plan, puis supprimer les données de test.

**Non garanti** : un vrai bilan de fin de semaine, qui demande d'attendre 7 jours. Il sera simulé dans les tests avec des dates passées.

## 7. Décisions à valider
1. **Accès** : Pro minimum (proposé) ou Expert minimum.
2. **Hypothèse prudente** quand il y a moins de 5 prospects : 1 client pour 20 contacts et 1 recrue pour 40, affichée comme une hypothèse modifiable.
3. **Objectifs hebdo** : le plan propose de recopier ses cibles (proposé), ou les écrase automatiquement.
4. **Seuil d'adaptation** : 70 %, et durée fixe de 28 jours commençant un lundi.
5. **Expiration de l'abonnement** : lecture seule (proposé) ou masquage complet.

## 8. Étapes d'implémentation (par priorité)
1. Migration additive : 2 tables, droits, RLS, triggers de contrôle, puis tests en base.
2. `action-plan.ts` et ses tests, plus `FEATURE_MIN_PLAN.actionPlan`.
3. Page `/plan-action` : assistant, plan actif, modification et abandon.
4. Bilan hebdo et adaptation proposée, recopie vers les objectifs hebdo.
5. Liaison avec le Coach : `coach-card` et `coach-week`, puis ligne et intention dans le Centre de commande, entrée de menu.
6. Vérification mobile, suite de tests complète, mise à jour de la roadmap et d'AGENTS.md, nettoyage des données de test.

**Estimation** : 5 à 7 crédits Lovable (base et contrôles environ 1, règles et tests environ 1,5, page environ 2, Coach et Centre de commande environ 1, vérifications environ 1).
