# Audit du Coach du jour V1 et prochaine étape (V2)

Ce rapport ne change rien. L'approuver sert uniquement à valider la V2 comme prochaine étape.

## 1. Présent dans la V1 (confirmé dans le code)

| Élément | Où | Détail |
|---|---|---|
| Carte « Coach du jour » | `src/components/coach-card.tsx` → `CoachCard` | Affichée sur le Dashboard (`src/routes/_authenticated/dashboard.tsx`, entre `PendingPaymentBanner` et `WeeklyGoalsCard`) |
| Plan du jour / missions | `src/lib/coach.ts` → `buildDailyMissions` | 5 missions max (`MAX_MISSIONS`) : relances en retard / du jour, puis Nouveaux jamais contactés, puis Chauds (`interest_level = 3`) sans contact depuis 3 jours ou plus. Client et Non intéressé exclus |
| Priorisation | `buildDailyMissions` | Ordre fixe par catégorie (tri par date de relance, puis date de création). **Pas de score** |
| États « fait / passé » | `logProspectEvent(..., "mission_faite" / "mission_passée")` dans `src/lib/prospect-events.ts` | Enregistrés dans la table `prospect_events`, donc conservés d'un appareil à l'autre ; relus pour la journée en cours seulement |
| Bilan du jour | `dailyRecap`, `cheer` dans `src/lib/coach.ts` | Contacts, relances, nouveaux, objectif hebdo ÷ 5 (arrondi au-dessus), phrase fixe. Sans IA |
| Relances partagées | `isFollowupDue` utilisée par `FollowupQueue` (`src/components/prospect-tools.tsx`) | Même règle des deux côtés, pas de doublon |
| Historique prospect | `eventMeta` dans `prospect-tools.tsx` | Libellés « Mission du coach faite / passée » ajoutés |
| CRM réutilisé | `useCrm` (`src/components/crm.tsx`) | Prospects passés en props, aucun nouveau chargement de prospects |
| IA et quotas | `CoachCard` | **Aucun appel IA.** « Préparer » ouvre `/assistant?context=…` ; la génération ne part qu'au clic sur Générer, via `generateProspectingContent` (quota existant) |
| Sécurité | Lectures navigateur sur `prospect_events` et `user_goals_weekly` | Règles « propriétaire uniquement » existantes ; aucune nouvelle table ni migration ; aucun envoi automatique |
| Tests | `src/lib/coach.test.ts` (6 tests, passent) + `src/bun-test.d.ts` | Ordre, exclusions, plafond de 5, limite de la journée, chaud récent exclu, bilan à zéro |

## 2. Non vérifié

- Rendu réel à l'écran et sur mobile (aucun test dans le navigateur avec un compte rempli).
- Comportement autour de minuit et selon le fuseau horaire de l'appareil (testé seulement en calcul).
- Le contexte envoyé à l'Assistant contient le nom du prospect mais pas sa fiche complète : la qualité du message obtenu n'a pas été évaluée.
- `suggestNextAction` (`src/lib/ai.functions.ts`) lit le prospect sans filtre `user_id` explicite (les règles d'accès le protègent quand même) — à aligner en V2.

## 3. Écarts avec le plan V1-V3

- V1 : tout est présent. Deux petites limites : « Préparer » ne passe pas l'identifiant du prospect à l'Assistant, et le bilan ignore les jours de repos (ils arrivent en V2).
- V2 : absente (pas de score, pas de réglages, pas de conseil IA dans la carte, pas de réponse aux objections).
- V3 : absente.

## 4. Prochaine étape recommandée : V2

**Ce que l'utilisateur verra**
1. Une étiquette « Priorité haute / moyenne » par mission. Elle vient d'un score calculé sans IA à partir de plusieurs critères : retard de relance, intérêt, ancienneté du dernier contact, statut, objection notée.
2. Des réglages du coach dans Paramètres : nombre de missions par jour (3, 5 ou 8), jours de repos, ton (amical ou professionnel). Ils sont enregistrés sur le compte.
3. Un bouton « Conseil IA » sur une mission. Il utilise la fonction existante `suggestNextAction` et coûte 1 génération du quota. Le conseil est gardé pour la journée : rouvrir la mission ne relance pas l'IA.
4. Si le prospect a une objection notée, la réponse correspondante du Gestionnaire d'objections est proposée, sans IA.
5. « Préparer » transmet aussi la fiche du prospect à l'Assistant, pour un message mieux adapté.

**Fichiers**
- `src/lib/coach.ts` : `priorityScore`, `matchObjection`, prise en compte des réglages (nombre de missions, jours de repos).
- `src/lib/coach.test.ts` : nouveaux tests.
- `src/components/coach-card.tsx` : étiquette de priorité, bouton Conseil IA, réponse à l'objection.
- `src/routes/_authenticated/parametres.tsx` : réglages enregistrés dans `profiles.preferences.coach`.
- `src/lib/ai.functions.ts` : ajouter `.eq("user_id", context.userId)` dans `suggestNextAction`. Aucun appel automatique.
- `src/routes/_authenticated/assistant.tsx` (si besoin) : accepter un identifiant de prospect dans le lien.

**Base de données** : aucune migration. Le conseil du jour est relu depuis `ai_generations` (déjà enregistré par `suggestNextAction`, réservé au propriétaire).

**Critères d'acceptation**
- À données égales, le score reste le même.
- 1 clic sur « Conseil IA » consomme exactement 1 génération ; une réouverture le même jour n'en consomme aucune.
- Quota atteint : un message renvoie vers Abonnement et rien n'est généré.
- Un jour de repos n'affiche aucune mission.
- Les réglages suivent l'utilisateur sur un autre appareil.
- Le coach n'envoie jamais rien seul et ne promet aucun revenu.

**Tests** : score critère par critère, égalités, choix 3/5/8, jour de repos, correspondance objection.

**Coût estimé** : 1 à 2 crédits de construction.
