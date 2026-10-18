# Coach commercial quotidien — plan en 3 phases (option C)

Principes valables pour toutes les phases :
- Le coach ne contacte jamais un prospect tout seul. Il prépare un message ; c'est l'utilisateur qui appuie sur « Copier » ou « Ouvrir WhatsApp ».
- Il n'invente aucune donnée : il n'utilise que les fiches prospects, l'historique et les objectifs de l'utilisateur. Il ne promet aucun revenu (même consigne que l'Assistant actuel).
- Le plan du jour, les missions et le bilan sont calculés **sans IA**. L'IA n'est utilisée que lorsque l'utilisateur clique sur un bouton, et elle compte dans le quota mensuel habituel.

## Faits confirmés dans le code (audit du 18 oct.)

- `FollowupQueue` (`src/components/prospect-tools.tsx`) liste les prospects avec `next_followup_date <= aujourd'hui`.
- `useCrm` (`src/components/crm.tsx`) charge tous les prospects de l'utilisateur et fournit `markContacted`, `changeStatus`, `updateProspect`, `clients`, `conversion`, `limits`, `monthlyGenerations`.
- `WeeklyGoalsCard` (`src/components/weekly-goals.tsx`) lit `user_goals_weekly` et `prospect_events` depuis le lundi (heure locale) ; l'événement `message_envoyé` existe.
- `logProspectEvent` / `onProspectEvent` existent dans `src/lib/prospect-events.ts`.
- `suggestNextAction` et `generateProspectingContent` (`src/lib/ai.functions.ts`) réservent le quota via la fonction base `reserve_ai_generation` et remboursent en cas d'échec.
- `profiles.preferences` (jsonb) est déjà utilisé pour des réglages (`team_goal`).
- Toutes les tables concernées sont limitées au propriétaire ; `prospect_events` n'accepte pas de modification et vérifie que le prospect appartient à l'utilisateur.
- Aucune Edge Function ; aucune notion de mission, bilan ou coach dans le code.

## Hypothèses à vérifier avant de coder

- H1 : la liste exacte des types d'événements écrits dans `prospect_events` (au-delà de `changement_statut` et `message_envoyé`) — à relire dans `whatsapp-actions.tsx` et `prospect-tools.tsx`.
- H2 : le calcul complet de progression de `WeeklyGoalsCard` (lu partiellement) pour l'extraire sans changer son résultat.
- H3 : `suggestNextAction` lit le prospect sans filtre `user_id` explicite (protégé par les règles d'accès) — à confirmer puis aligner sur `generateProspectingContent`.
- H4 : choix du fuseau pour « aujourd'hui » : heure locale du téléphone (comme les objectifs et les relances) — à confirmer avec toi.

---

## Phase V1 — économique : plan du jour, missions, bilan

**Ce que voit l'utilisateur**
- Une carte « Coach du jour » en haut du Dashboard : 3 à 5 missions maximum, par ordre de priorité :
  1. relances en retard puis du jour ;
  2. prospects jamais contactés (statut Nouveau) ;
  3. prospects « Chauds » sans contact depuis 3 jours ou plus.
- Chaque mission : nom du prospect, raison (« relance prévue il y a 2 jours »), boutons « Ouvrir la fiche », « Préparer un message » (ouvre l'Assistant prérempli, sans IA tant qu'il ne clique pas sur Générer) et « Fait » / « Passer ».
- Une barre de progression « 2/4 missions faites ».
- Un bilan du jour simple (sans IA) : contacts faits, relances faites, nouveaux prospects, comparés à l'objectif de la semaine ramené à la journée. Phrase d'encouragement tirée d'une liste fixe rédigée à l'avance.

**Réutilisé** : `useCrm`, filtre de `FollowupQueue`, `ProspectSheet`, `logProspectEvent`, `user_goals_weekly`, lien `/assistant?context=`.

**Fichiers**
- Créer `src/lib/coach.ts` : fonctions pures `buildDailyMissions(prospects, events, today)` et `dailyRecap(events, goals, today)`.
- Créer `src/lib/coach.test.ts`.
- Créer `src/components/coach-card.tsx`.
- Modifier `src/routes/_authenticated/dashboard.tsx` (afficher la carte).
- Modifier `src/components/prospect-tools.tsx` : `FollowupQueue` utilise le même filtre que `coach.ts` (évite le doublon).
- Modifier `src/lib/prospect-events.ts` : nouveaux types `mission_faite` et `mission_passée`.

**Base de données** : aucune migration. L'état « fait / passé » est stocké comme événement dans `prospect_events` (règles propriétaire existantes, pas de modification possible).

**Sécurité** : lectures navigateur sous les règles existantes ; aucun accès admin ; aucun envoi automatique.

**Critères d'acceptation**
- Jamais plus de 5 missions ; aucun prospect Client ou Non intéressé proposé.
- Une mission marquée « Fait » reste faite après rechargement et sur un autre appareil.
- Le bilan correspond aux événements réels du jour.
- Aucun appel IA au chargement du Dashboard (vérifiable : le compteur IA ne bouge pas).

**Tests** : ordre de priorité ; exclusion Client/Non intéressé ; plafond de 5 ; prospect déjà traité aujourd'hui exclu ; limite du jour (minuit) ; bilan à zéro sans événements.

---

## Phase V2 — personnalisation et priorisation intelligente

**Ce que voit l'utilisateur**
- Un score de priorité visible par mission (« Priorité haute ») calculé à partir de règles : retard de relance, niveau d'intérêt, ancienneté du dernier contact, statut, objection notée.
- Réglages du coach dans Paramètres : nombre de missions par jour (3, 5 ou 8), jours de repos, ton (amical / professionnel).
- Bouton « Conseil IA » sur une mission : appelle `suggestNextAction` existant (1 génération du quota). Le résultat est gardé pour la journée : rouvrir la mission ne relance pas l'IA.
- Pour une objection notée, proposition de la réponse correspondante tirée du Gestionnaire d'objections (sans IA).

**Réutilisé** : `suggestNextAction`, `src/lib/objections.ts`, `src/lib/voice-scripts.ts`, `profiles.preferences`, `usePlan`.

**Fichiers**
- Modifier `src/lib/coach.ts` (`priorityScore`, correspondance objection).
- Modifier `src/lib/coach.test.ts`.
- Modifier `src/components/coach-card.tsx`.
- Modifier `src/routes/_authenticated/parametres.tsx` (réglages coach dans `profiles.preferences.coach`).
- Modifier `src/lib/ai.functions.ts` : ajouter le filtre `user_id` dans `suggestNextAction` (H3) ; aucun nouvel appel automatique.

**Base de données** : aucune migration. Le conseil IA du jour est conservé dans `ai_generations` (déjà enregistré par `suggestNextAction`) et relu au lieu de régénérer.

**Sécurité** : réglages dans le profil du propriétaire ; le conseil IA reste côté serveur, sous quota, avec remboursement si échec.

**Critères d'acceptation**
- Le même prospect garde le même score à données égales.
- Un clic « Conseil IA » = exactement 1 génération ; rouvrir le même jour = 0.
- Quota atteint : message clair vers Abonnement, aucune génération.
- Les réglages suivent l'utilisateur sur un autre appareil.

**Tests** : score par règle ; égalités ; réglage 3/5/8 respecté ; jours de repos sans missions ; correspondance objection.

---

## Phase V3 — progression, habitudes et objectifs suivants

**Ce que voit l'utilisateur**
- Série de jours actifs (« 4 jours d'affilée »), sans pénaliser les jours de repos choisis.
- Bilan de la semaine le dimanche ou le lundi : missions faites, objectifs atteints, meilleur jour.
- Proposition d'objectifs pour la semaine suivante (règle simple : +10 % si atteint, identique sinon), à accepter d'un clic.
- Option « Résumé IA de ma semaine » au clic seulement, 1 génération maximum par semaine.

**Réutilisé** : `WeeklyGoalsCard`, `user_goals_weekly`, page Statistiques (graphiques avancés toujours réservés Expert), `confetti`.

**Fichiers**
- Modifier `src/lib/coach.ts` (`streak`, `weeklyRecap`, `suggestNextGoals`) et ses tests.
- Créer `src/components/coach-week.tsx`.
- Modifier `src/components/weekly-goals.tsx` (bouton « Accepter les objectifs proposés »).
- Optionnel : créer `src/routes/_authenticated/coach.tsx` (historique) et l'ajouter dans `src/components/app-shell.tsx`.
- Optionnel : mode « résumé de semaine » dans `src/lib/ai.functions.ts`.

**Base de données** : à décider en début de V3. Par défaut aucune ; si l'historique devient lent à recalculer, une table `coach_daily_summaries` (propriétaire uniquement, lecture/écriture par l'utilisateur, suppression interdite) avec droits d'accès accordés dans la même migration.

**Critères d'acceptation**
- La série ne casse pas un jour de repos choisi.
- Les objectifs proposés ne s'appliquent qu'après clic.
- Résumé IA : au maximum 1 par semaine, sous quota.

**Tests** : série avec trous et jours de repos ; changement de semaine ; règle +10 % ; arrondis.

---

## Stratégie IA (toutes phases)

- Zéro appel IA automatique : ni au chargement, ni en tâche planifiée, ni en notification.
- Tout ce qui peut être calculé (missions, priorités, bilans, encouragements) l'est sans IA.
- IA uniquement au clic, via les fonctions existantes (`suggestNextAction`, `generateProspectingContent`) qui réservent le quota, le remboursent en cas d'échec et refusent au-delà de la limite (5 / 100 / 500 par mois).
- Résultat gardé pour la journée (V2) ou la semaine (V3) pour ne jamais payer deux fois la même réponse.
- Consignes IA inchangées : pas de promesse de gains, pas de pression, pas de faits inventés.

## Ordre conseillé et coût

V1 d'abord (1 à 2 crédits de construction estimés), puis tu l'utilises quelques jours avant de valider V2, puis V3. Chaque phase peut être publiée seule.
