# Suivi de progression des leçons vidéo — plan

## 1. Audit (constaté dans le code)

- **Catalogue** : `academy_courses` (statut `brouillon|publie`, `min_plan`) et `academy_lessons` (`course_id` FK ON DELETE CASCADE, `video_id`, `duration_minutes`, statut). Les leçons n'ont **aucune policy de lecture pour les non-admins** : elles sont lues côté serveur avec le client admin dans `getVideoCourse` après filtrage `status = 'publie'` et `canAccessCourse(plan, min_plan)`.
- **Accès** : `effective_plan()` (expiration/grâce) + `canAccessCourse` dans `academy-video-rules.ts`. Toutes les fonctions sont `requireSupabaseAuth` sous `_authenticated` (utilisateur anonyme déjà redirigé vers `/auth`).
- **Progression existante** : `academy_progress` (quiz par niveau, écrit uniquement par `record_academy_result` en service-role) et `duplication_progress` (lecture propriétaire, écriture via fonction SQL). Aucun suivi des leçons vidéo aujourd'hui. On **ne réutilise pas** ces tables (clés et sémantique différentes) mais on reprend leur modèle : lecture propriétaire seule, aucune écriture directe, écriture via fonction contrôlée.
- **Lecteur** : `video-player.tsx` = iframe `youtube-nocookie.com/embed` chargée au clic, **sans `enablejsapi`** : aujourd'hui aucune position n'est lisible. L'API IFrame YouTube (`https://www.youtube.com/iframe_api`) fonctionne avec le domaine nocookie et expose `getCurrentTime()`, `getDuration()`, `onStateChange` (PLAYING/PAUSED/ENDED) et `start`/`seekTo`. La position est donc disponible **à condition** de passer au lecteur API ; fallback prévu si le script est bloqué.
- **Page cours** : `academie_.cours.$slug.tsx` (paramètre `?l=` pour la leçon), liste de leçons, coach. Section catalogue : `video-courses-section.tsx`.

## 2. Comportement utilisateur

- Liste des leçons : pastille « Non commencée / En cours (x %) / Terminée ✓ ».
- Bouton « Reprendre à 4:12 » si une position est connue ; la vidéo démarre à cette seconde.
- En-tête du cours : barre « 3/8 leçons terminées — 38 % ». Carte catalogue : même pourcentage + bouton « Continuer » vers la dernière leçon active.
- Pourcentage global Académie vidéo (cours accessibles uniquement) en haut de la section.
- Ouvrir une leçon **ne la marque jamais terminée** ; elle passe « en cours » seulement après lecture réelle.

## 3. Modèle de données (une migration additive)

Table `public.academy_lesson_progress` :

| colonne | type | règle |
|---|---|---|
| user_id | uuid not null | pas de FK vers auth.users (convention) |
| lesson_id | uuid not null | FK `academy_lessons(id)` ON DELETE CASCADE |
| course_id | uuid not null | FK `academy_courses(id)` ON DELETE CASCADE (agrégats rapides) |
| status | text not null default 'en_cours' | check `en_cours|terminee` (non commencée = absence de ligne) |
| position_seconds | integer not null default 0 | 0..86400 |
| watched_seconds | integer not null default 0 | temps réellement lu cumulé, plafonné |
| duration_seconds | integer | durée remontée par le lecteur, sinon `duration_minutes*60` |
| started_at | timestamptz not null default now() | |
| last_activity_at | timestamptz not null default now() | |
| completed_at | timestamptz | immuable une fois posé |
| completion_method | text | `lecture|fin_video|manuel` |

PK `(user_id, lesson_id)`, index `(user_id, course_id)`, `(user_id, last_activity_at desc)`.

Grants/RLS (ordre imposé) : `GRANT SELECT TO authenticated`, `GRANT ALL TO service_role`, RLS activée, policy unique `SELECT USING (user_id = auth.uid())`. Aucune policy INSERT/UPDATE/DELETE : écritures directes impossibles depuis le navigateur.

Fonction `public.record_lesson_progress(_user_id, _lesson_id, _position, _delta_watched, _duration, _event)` SECURITY DEFINER, `search_path=public`, EXECUTE **révoqué** à PUBLIC/anon/authenticated, accordé à service_role uniquement (même modèle que `record_academy_result`). Elle :
- vérifie leçon et cours `publie` ;
- borne `_delta_watched` à 0..30 s et au temps réel écoulé depuis `last_activity_at` (+5 s de tolérance) : impossible de « cumuler » 1 h en un appel ;
- met à jour position, cumul, `last_activity_at` (upsert) ;
- passe à `terminee` si `watched_seconds >= 85 % de la durée` ou événement `fin_video` avec `watched_seconds >= 50 %` (évite le saut direct à la fin) ;
- ne régresse jamais : une leçon terminée reste terminée, `completed_at` conservé ; la position continue de se mettre à jour pour la reprise.

Fonction `mark_lesson_done_manual` (même grant service-role) pour le fallback : acceptée seulement si `now() - started_at >= 60 % de duration_minutes`.

## 4. Fonctions serveur (`src/lib/academy-progress.functions.ts`)

Toutes `requireSupabaseAuth`, entrées Zod, vérification `effective_plan` + `canAccessCourse` + statut publié **avant** l'appel service-role (le `user_id` vient du contexte, jamais du client) :
- `saveLessonProgress({ lessonId, position, deltaWatched, duration, event: 'heartbeat'|'pause'|'ended' })`
- `markLessonDone({ lessonId })` (fallback)
- `getCourseProgress({ slug })` → par leçon : statut, position, pourcentage ; total du cours. Fusionné dans `getVideoCourse` pour éviter une 2ᵉ requête (lecture via `context.supabase`, RLS propriétaire).
- `listVideoCourses` enrichi : `done`, `percent`, `resumeLessonSlug` par cours + agrégat global.

Pourcentages calculés dans un module pur `src/lib/academy-progress.ts` sur les **leçons publiées actuelles** uniquement.

## 5. Interface

- `video-player.tsx` : bascule vers l'API IFrame (script chargé au clic, une seule fois), `enablejsapi=1`, `origin`, `start=<position>`, `playsinline`. Battement toutes les 15 s **uniquement en lecture**, envoi aussi à pause/fin/`visibilitychange`/changement de leçon. Fallback si l'API n'arrive pas en 8 s : iframe actuelle + bouton « J'ai terminé cette leçon » (désactivé avec message tant que le délai minimal n'est pas atteint côté serveur).
- `academie_.cours.$slug.tsx` : barre de progression, pastilles d'état, bouton « Reprendre », lien automatique vers la leçon suivante à la complétion, invalidation du cache après sauvegarde.
- `video-courses-section.tsx` : pourcentage par carte, « Continuer », progression globale.
- Chargement : squelettes sur pastilles/barre ; la vidéo reste utilisable même si la progression échoue.
- Erreurs : échec d'envoi = réessai silencieux au battement suivant (dernière position gardée en mémoire), toast discret après 3 échecs ; jamais bloquant.
- Mobile : barre fine sous le titre, pastilles icônes compactes, bouton « Reprendre » pleine largeur sous la vidéo, pas d'envoi en arrière-plan lorsque l'onglet est masqué.

## 6. Cas limites

- **Leçon/cours supprimé** : cascade, progression supprimée.
- **Dépublié** : lignes conservées mais exclues des calculs et des listes ; enregistrement refusé ; réapparaît si republié.
- **Abonnement révoqué/expiré** : cours verrouillé comme aujourd'hui, pas d'enregistrement ; progression conservée et affichée « en pause » sur la carte, reprise au réabonnement.
- **Anonyme** : routes déjà protégées ; fonctions refusent sans jeton.
- **Changement d'appareil** : tout est en base, la reprise utilise la position stockée.
- **Deux onglets** : la plus récente position gagne, le cumul reste plafonné au temps réel.
- **Vidéo remplacée par l'admin** (`video_id` changé) : position remise à 0 si elle dépasse la nouvelle durée ; statut terminé conservé.
- **Leader d'équipe** : aucune exposition ; `team_member_progress()` inchangé.

## 7. Tests automatisés

- `academy-progress.test.ts` (logique pure) : non commencé sans ligne ; ouverture ≠ terminé ; seuil 85 % ; fin de vidéo sans visionnage refusée ; non-régression terminé ; plafonnement du delta ; pourcentages ignorant les leçons dépubliées ; leçon de reprise.
- Script de vérification SQL (comme Phase 1) : utilisateur A ne lit pas les lignes de B ; insert/update direct refusé ; `record_lesson_progress` non exécutable par `authenticated` ; refus si leçon dépubliée.
- Playwright : lire une leçon, recharger, voir « Reprendre » et l'état « en cours ».

## 8. Fichiers

- Nouvelle migration `drizzle/migrations/0021_academy_lesson_progress.sql`
- Nouveaux : `src/lib/academy-progress.ts`, `src/lib/academy-progress.test.ts`, `src/lib/academy-progress.functions.ts`, `src/components/academy/lesson-progress-bar.tsx`
- Modifiés : `src/components/academy/video-player.tsx`, `src/routes/_authenticated/academie_.cours.$slug.tsx`, `src/components/academy/video-courses-section.tsx`, `src/lib/academy-video.functions.ts`, `AGENTS.md` (une règle)
- Inchangés : `academy_progress`, `duplication_progress`, quiz, certificats, plans/tarifs, admin.

## 9. Risques

- Script YouTube bloqué (bloqueurs, réseaux lents) → fallback manuel.
- Battements = écritures fréquentes : 15 s et seulement en lecture (≈ 4 écritures/min/élève).
- Navigateur sans fin d'envoi à la fermeture : au pire on perd 15 s de position.
- Lecture accélérée (x2) : le plafond au temps réel peut retarder la complétion ; seuil 85 % sur temps réellement écoulé reste atteignable via l'événement fin + 50 %.

## 10. Critères d'acceptation

1. Ouvrir une leçon sans lire laisse « Non commencée ».
2. Après lecture, la leçon est « En cours » avec reprise à la bonne seconde, y compris sur un autre appareil.
3. Terminer la vidéo (≥ 85 % lu) la marque terminée avec date ; elle le reste.
4. Le cours et la section affichent les pourcentages corrects sur les leçons publiées.
5. Aucune donnée d'un autre utilisateur n'est lisible ni modifiable ; aucun envoi possible pour un cours verrouillé ou dépublié.
6. Tests, typage et compilation verts ; rien publié.

## 11. Estimation

Complexité moyenne : migration + fonctions ≈ 1 crédit, lecteur API + interface ≈ 1,5–2 crédits, tests et vérification écran ≈ 1 crédit. Total ≈ 3–4 crédits.
