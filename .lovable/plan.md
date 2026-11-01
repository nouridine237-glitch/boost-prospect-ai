# Académie intelligente & Duplication 2.0 — audit et plan progressif

Aucun code, aucune migration, aucune publication. Ce document est un plan à valider.

## 1. Audit : faits vérifiés dans le code

| Domaine | Présent | Fichiers |
|---|---|---|
| Contenu Académie | 6 niveaux en Markdown statique (titre, objectifs, corps, durée) | `src/content/academie/niveau-1..6.md`, `src/lib/academy-content.ts` (`lessons`, `getLesson`) |
| Quiz | 5 questions par niveau, seuil 80 % (`PASS_RATIO`) | `src/lib/academy-quiz.ts` |
| Certificat | PDF généré côté navigateur | `src/lib/certificate.ts` |
| Pages Académie (connecté) | Liste + page de niveau, verrou plan (Gratuit = 2 niveaux, `academyLevels`) | `src/routes/_authenticated/academie.tsx`, `academie_.$niveau.tsx` |
| Formation publique des filleuls | Page sans compte, nom du parrain passé en `?parrain=`, progression **dans le navigateur seulement** (`localStorage` clé `mlm-formation-progress`) | `src/routes/formation.tsx` |
| Former mon équipe | Lien de partage WhatsApp/copie, réservé Business (`teamTraining`) | `src/routes/_authenticated/former-equipe.tsx`, `src/lib/plans.ts` |
| Mon équipe | « Recrues » = prospects au statut Client (`joined_team_at`), objectif d'équipe dans `profiles.preferences` | `src/components/team.tsx`, `src/components/crm.tsx` |
| Parrainage app | Table `referrals` (referrer_id → referred_id) entre **comptes MLM Boost AI**, récompenses par triggers | `src/lib/referral.functions.ts`, migrations parrainage |
| Coach quotidien V1–V3 | Missions, priorités, séries, bilan, sans IA automatique | `src/lib/coach.ts`, `coach-card.tsx`, `coach-week.tsx` |
| IA | Génération serveur avec réservation atomique de quota (`reserve_ai_generation`) et remboursement | `src/lib/ai.functions.ts`, `ai_usage_log`, `ai_generations` |
| Modèles | `public.scripts` (génériques + templates entreprise, lecture RLS par plan, écriture admin), objections, trames vocales (statiques) | `src/lib/scripts.functions.ts`, `objections.ts`, `voice-scripts.ts` |
| Plans | `hasFeature` / `FEATURE_MIN_PLAN`, `effective_plan()` SQL avec 3 jours de grâce | `src/lib/plans.ts` |

### Lacunes réelles (vérifiées)
- Aucune progression Académie enregistrée sur le compte : rien n'écrit en base depuis les pages Académie ; la formation publique stocke tout dans le navigateur. Un leader ne peut donc voir **aucune** progression de ses filleuls.
- Aucune notion de « partenaire » rattaché à un leader avec un compte : les recrues sont des fiches prospects, et `referrals` ne sert qu'aux récompenses.
- Pas de parcours 7 jours, pas de kits de duplication, pas de modèles créés par un utilisateur, pas de partage de modèles, pas de formateur IA, pas de coach leader.

### Suppositions à vérifier avant construction
- Que le certificat n'est pas non plus enregistré en base (non lu en détail).
- Que `referrals` contient bien un lien fiable pour tous les filleuls inscrits (dépend de la capture `?ref=`).
- Volume réel de contenu Académie (taille des 6 fichiers) pour dimensionner le formateur IA.

## 2. Principe d'architecture

```text
Leader (compte)  ──team_links──>  Partenaire (compte)
     │                                  │
     ├─ kits (modèles perso) ──partage──┤
     ├─ parcours 7 jours ───────────────┤ progression (academy_progress)
     └─ coach leader (lecture agrégée)  └─ formateur IA (contenu Académie)
```
- Le contenu de formation reste en Markdown versionné (pas de CMS) : zéro coût, déjà en place.
- La relation équipe réutilise `referrals` comme source d'invitation, avec une table dédiée seulement pour le lien leader–partenaire consenti.
- Le leader ne voit que des **indicateurs agrégés** (niveaux validés, jours du parcours, nombre d'actions), jamais les prospects ni les messages de ses partenaires.

## 3. Phases recommandées

### Phase 1 — V1 utile, sans IA (≈ 3–5 crédits)
Comportement : la progression Académie (niveaux validés, scores, date) est sauvegardée sur le compte ; un partenaire inscrit via le lien d'un leader peut accepter de rejoindre son équipe ; le leader voit, dans « Former mon équipe », la liste de ses partenaires et leur progression.
- Nouvelle table `academy_progress` (user_id, level, score, passed_at) — RLS propriétaire ; insertion via fonction serveur qui recalcule le score (pas de score fourni par le navigateur).
- Nouvelle table `team_links` (leader_id, member_id, status invite/actif/quitté, created_at) — un seul leader actif par membre ; création par fonction serveur avec code d'invitation ; le membre peut quitter.
- Fonction SQL SECURITY DEFINER `team_member_progress()` renvoyant au leader uniquement niveau max, nombre de niveaux validés, dernière activité (date) de ses membres actifs.
- Migration douce : à la première visite, reprise unique de la progression `localStorage` existante.
- Fichiers : `academie_.$niveau.tsx`, `formation.tsx` (garde l'accès sans compte), `former-equipe.tsx`, nouveau `src/lib/academy.functions.ts`, `src/lib/team.functions.ts`.
- Accès : progression perso pour tous ; tableau d'équipe Business (`teamTraining`, existant).

### Phase 2 — Parcours 7 jours + kits de duplication (≈ 4–6 crédits)
- Parcours par défaut statique (`src/lib/onboarding-path.ts`) : 1 tâche/jour reliée à l'existant (niveau Académie, script, trame vocale, 5 premiers prospects, première relance du coach).
- Personnalisation leader : table `kits` (owner_id, title, kind parcours/modèles, content jsonb, visibility privé/équipe) et `kit_items` si nécessaire ; un membre lit les kits `visibility = équipe` de son leader actif (RLS via `team_links`).
- Suivi : `onboarding_progress` (user_id, kit_id, day, done_at) ; le leader voit seulement le jour atteint.
- Les tâches réutilisent `prospect_events` pour se valider automatiquement (ex. premier contact enregistré).
- Accès : suivre un parcours = tous les plans ; créer/partager des kits = Business.

### Phase 3 — Formateur IA (≈ 2–3 crédits)
- Bouton « Poser une question au formateur » sur une leçon : envoie la question + **le texte du niveau courant seulement** (pas toute l'Académie) à la fonction IA existante, nouveau type de génération `formateur`.
- Réponses limitées au contenu fourni ; consigne de refus si la question sort du contenu ; aucune promesse de revenu ni allégation santé.
- Quota : réutilise `reserve_ai_generation` (1 génération par question), aucun appel automatique.
- Accès : Pro et plus (Gratuit : ses 5 générations habituelles).

### Phase 4 — Coach IA du leader (≈ 2–4 crédits)
- Carte « Coach d'équipe » sans IA d'abord : règles simples (membre inactif 3 jours, bloqué au jour X, niveau non validé) + message d'encouragement pré-rédigé à envoyer via WhatsApp **par le leader**.
- Option IA au clic : « Rédiger un message pour ce partenaire », avec seulement les indicateurs agrégés en contexte, sous quota.
- Accès : Business.

### Phase 5 — Partage sécurisé et permissions avancées (≈ 2–3 crédits)
- Partage d'un kit par lien à usage limité vers un autre leader (copie, pas accès partagé) ; révocation ; signalement.
- Règles de contenu vérifiées côté serveur (liste de termes interdits : guérit, revenu garanti, montants) avant publication en équipe.

Total estimé : 13–21 crédits, la Phase 1 seule apportant déjà la valeur principale. Estimations approximatives, l'outil ne fournit pas le coût exact.

## 4. Sécurité et séparation des équipes
- Toutes les nouvelles tables : RLS activée, GRANT explicites, `user_id` en UUID sans clé étrangère vers `auth.users`.
- Un leader ne lit jamais `prospects`, `prospect_events`, `ai_generations` d'un membre ; seulement des agrégats via fonctions SECURITY DEFINER qui vérifient `team_links.status = 'actif'` et `leader_id = auth.uid()`.
- Le membre doit accepter l'invitation et peut quitter : le leader perd alors l'accès immédiatement.
- Scores et validations calculés côté serveur ; kits écrits uniquement par leur propriétaire.
- Rôle admin inchangé (`user_roles`, `has_role`).

## 5. Quotas et coûts IA
- Aucune IA automatique ; 1 clic = 1 génération réservée atomiquement, remboursée en cas d'échec.
- Contexte court (un niveau ou des agrégats) pour limiter la taille des requêtes.
- Phases 1, 2 et la partie règles de la Phase 4 : zéro appel IA.

## 6. Tests à prévoir
- Calculs purs : score quiz, déblocage des niveaux, jour courant du parcours, règles du coach leader.
- RLS en transaction annulée : membre A ne lit pas la progression de B ; leader ne lit que ses membres actifs ; ancien leader perd l'accès ; non-Business ne crée pas de kit.
- Quota : question au formateur décompte 1 génération, refusée quand le quota est épuisé.
- Navigateur : parcours invitation → acceptation → niveau validé visible chez le leader.

## 7. Risques
- Confusion entre « recrues » (fiches prospects) et « partenaires » (comptes) : libellés à clarifier dans « Mon équipe ».
- Vie privée des partenaires : limiter strictement aux agrégats, demander le consentement.
- Contenu des kits rédigé par les leaders : risque d'allégations interdites, d'où le filtre Phase 5 (une version simple peut être avancée en Phase 2).
- Perte de progression `localStorage` si la reprise n'est pas faite.
- Crédits limités : construire et valider phase par phase.

## Recommandation
Commencer par la Phase 1 seule (progression sur le compte + lien leader–partenaire + tableau d'équipe), sans IA.
