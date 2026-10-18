# Audit — préparation du « Coach commercial quotidien » (aucune modification appliquée)

Ce document est un rapport d'audit. Si tu l'approuves, rien ne sera construit automatiquement : il sert de base pour une étape suivante.

## 1. Ce qui existe déjà (confirmé dans le code)

| Besoin coach | Existant | Où |
|---|---|---|
| Relances du jour | `FollowupQueue` : prospects avec `next_followup_date <= aujourd'hui`, triés par retard | `src/components/prospect-tools.tsx` |
| CRM | `useCrm()` charge tous les prospects, change statut, `markContacted`, import, compteurs, `clients`, `conversion` | `src/components/crm.tsx` |
| Suggestion IA par prospect | `suggestNextAction` (ACTION / MOMENT / MESSAGE), quota via `reserve_ai_generation`, remboursement en cas d'échec | `src/lib/ai.functions.ts`, appelé depuis `ProspectSheet` |
| Génération IA générale | `generateProspectingContent` (5 modes, scripts, contexte prospect) | `src/lib/ai.functions.ts`, `AiAssistantPanel` |
| Objectifs | `WeeklyGoalsCard` : objectifs contacts / relances / recrues, progression calculée depuis `prospect_events` de la semaine (lundi) | `src/components/weekly-goals.tsx`, table `user_goals_weekly` |
| Historique d'actions | `logProspectEvent` / `onProspectEvent` (types `changement_statut`, `message_envoyé`…) | `src/lib/prospect-events.ts`, table `prospect_events` |
| Statistiques | page Statistiques, graphiques avancés réservés Expert (`hasFeature(..., "advancedStats")`) | `src/routes/_authenticated/statistiques.tsx`, `src/lib/plans.ts` |
| Démarrage guidé | `OnboardingProvider`, `GettingStartedCard` (drapeaux dans `profiles`) | `src/components/onboarding.tsx`, `src/lib/onboarding.ts` |
| Mémoire utilisateur | `profiles.preferences` (jsonb), déjà utilisé pour `team_goal` | `src/components/team.tsx`, `parametres.tsx` |
| Contenus réutilisables | objections (15), trames vocales (6), scripts (table) | `src/lib/objections.ts`, `src/lib/voice-scripts.ts`, `public.scripts` |
| Accès externe | outil MCP `list_followups_today` | `src/lib/mcp/tools/followups.ts` |

Aucune notion de « mission », « bilan » ou « coach » n'existe dans le code (recherche texte : seulement des mentions dans l'Académie et le prompt système IA).

## 2. Tables et fonctions serveur pertinentes

- Tables : `prospects`, `prospect_events`, `user_goals_weekly`, `ai_generations`, `ai_usage_log`, `profiles`, `subscriptions`, `scripts`. Toutes ont des règles d'accès « propriétaire uniquement » (scripts : lecture pour tous les connectés, écriture admin).
- Fonctions base : `reserve_ai_generation`, `effective_plan`, `feature_plan`, `_ai_bonus_left`, `enforce_prospect_limit`.
- Edge Functions : aucune (dossier `supabase/functions` absent). La logique serveur passe par des fonctions TanStack (`createServerFn`), ce qui est la bonne voie.

## 3. Réutilisable tel quel

- Liste « à relancer » : même filtre que `FollowupQueue` (et `list_followups_today`).
- Progression du jour : même calcul que `WeeklyGoalsCard`, ramené à la journée.
- Suggestions : `suggestNextAction` pour 1 prospect ; réservation de quota et remboursement déjà en place.
- Messages prêts : objections, trames vocales, scripts, et le lien `/assistant?context=`.
- Préférences : `profiles.preferences` pour des réglages légers (ex. heure, nombre d'actions/jour).

## 4. Ce qui manque vraiment pour une V1

1. Un **plan du jour** calculé (sans IA) : relances en retard, prospects « chauds » sans contact récent, nouveaux jamais contactés, limité à 3–5 actions.
2. Un **suivi « fait / passé »** des actions du jour. Possible sans nouvelle table en ajoutant un type d'événement dans `prospect_events` ; une table dédiée (`coach_daily_plans`) seulement si on veut garder l'historique des plans.
3. Un **message d'encouragement / bilan du soir** court (optionnel, 1 appel IA maximum par jour, ou version sans IA à partir des chiffres).
4. Une **carte « Coach du jour »** sur le Dashboard (et éventuellement une page dédiée).
5. Non couvert aujourd'hui : notifications/rappels envoyés automatiquement (email ou push) — hors V1 conseillé.

## 5. Risques

- **Doublons** : `FollowupQueue`, `WeeklyGoalsCard` et le futur coach afficheraient les mêmes prospects ; il faut extraire une fonction commune de sélection plutôt que recopier les filtres. `useCrm` est déjà appelé sur chaque page et charge tous les prospects : à réutiliser, pas à dupliquer.
- **Sécurité** : les lectures navigateur respectent déjà les règles propriétaire. Toute nouvelle table doit avoir les mêmes règles ; un plan généré côté serveur doit filtrer par `user_id` (comme `generateProspectingContent`). À noter : `suggestNextAction` lit le prospect sans filtre `user_id` explicite (protégé par les règles d'accès, mais moins strict que l'autre fonction).
- **Coût IA** : si le coach appelle `suggestNextAction` pour chaque prospect du plan, un utilisateur Gratuit (5 générations/mois) épuise son quota en un jour. Recommandation : plan du jour calculé sans IA, IA uniquement au clic, et au plus 1 génération automatique par jour, mise en cache.
- **Fuseau horaire** : les objectifs utilisent l'heure locale, les quotas IA l'heure UTC, et `FollowupQueue` une date du jour locale. Le coach doit choisir une règle unique.

## 6. Fichiers minimaux à toucher dans une future étape

- Nouveau : `src/lib/coach.ts` (sélection des actions du jour, fonction pure + tests)
- Nouveau : `src/components/coach-card.tsx`
- Modifier : `src/routes/_authenticated/dashboard.tsx` (afficher la carte)
- Modifier : `src/components/prospect-tools.tsx` (`FollowupQueue` réutilise la sélection commune)
- Optionnel : `src/lib/ai.functions.ts` (fonction « bilan du jour » sous quota), `src/lib/prospect-events.ts` (type d'événement « action coach »), une migration seulement si historique des plans souhaité, `src/components/app-shell.tsx` si page dédiée.

## Non vérifié

- Contenu exact du reste de `WeeklyGoalsCard` et des graphiques de Statistiques (lus partiellement).
- Usage réel actuel des fonctions IA par les utilisateurs (pas de lecture des données).
- Comportement sur mobile des cartes existantes.
