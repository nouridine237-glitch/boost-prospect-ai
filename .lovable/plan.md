# Plan — Académie vidéo MLM Boost AI (plan seulement, rien modifié ni publié)

## 1. Audit de l'existant

| Élément | Où | Constat |
|---|---|---|
| Contenu Académie | `src/lib/academy-content.ts` + `src/content/academie/niveau-1..6.md` | 6 leçons texte, livrées dans le code, pas en base. |
| Quiz | `src/lib/academy-quiz.ts` | 5 questions par niveau, avec les bonnes réponses dans le même fichier. Seuil 80 % (`PASS_RATIO`). |
| Notation | `academy-score.ts`, `academy.functions.ts` | Score recalculé côté serveur, écrit via `record_academy_result` (garde le meilleur score). Fiable. |
| Progression | table `academy_progress` (clé user + `level` 1–20) | Liée aux 6 niveaux fixes ; ne peut pas suivre des cours/leçons multiples. |
| Verrouillage | `plans.ts` : `canAccessAcademyLevel`, `FEATURE_MIN_PLAN.academyFull = pro` | À réutiliser tel quel. |
| Admin | `user_roles` + `has_role()`, contrôle dans `admin.functions.ts` | Même modèle que `public.scripts` (lecture connectés, écriture admin). |
| Quotas IA | `reserve_ai_generation(_type)` + enum `ai_generation_type` (4 valeurs) | Le coach devra réserver une génération comme le reste. |
| Certificats | `src/lib/certificate.ts` (PDF navigateur) | Réutilisable par cours. |
| Équipe | `team_member_progress()` agrège `academy_progress` | Ne doit pas casser. |

## 2. Risques identifiés
1. **Réponses des quiz visibles dans le navigateur** : `academy-quiz.ts` contient les réponses ; si importé côté page, elles sont lisibles. Les nouveaux quiz doivent rester en base, sans réponse envoyée au navigateur.
2. **YouTube ne protège pas le contenu payant** : une vidéo « non répertoriée » reste partageable. Le verrouillage par plan limite seulement l'accès dans l'app. Acceptable au lancement ; la vraie protection viendra avec l'hébergement direct (liens signés).
3. **Droits sur les formations externes** : il faut garder une trace (auteur, source, date/preuve d'autorisation) obligatoire avant publication.
4. **Transcriptions = contenu payant** : ne jamais les envoyer à un plan non autorisé ; le coach les lit côté serveur seulement.
5. **Compatibilité** : les 6 niveaux, `academy_progress`, les certificats et la vue équipe restent intacts ; la nouvelle Académie s'ajoute à côté.
6. **Coût IA** : coach seulement au clic, sous quota existant, contexte tronqué (transcription limitée).
7. **Ajout d'une valeur d'enum** (`coach_academie`) : changement additif, sans risque, mais fait seul dans sa migration.

## 3. Découpage en phases

**Phase A — Catalogue vidéo et lecture (≈3–4 crédits)**
- Tables `academy_courses`, `academy_lessons` (vidéo YouTube, durée, notes, transcription, plan minimal, statut brouillon/publié, source interne/externe + autorisation).
- Admin seul crée/publie (RLS `has_role`) ; connectés lisent les cours publiés ; transcription renvoyée par fonction serveur après contrôle du plan.
- Pages : liste des cours, page leçon mobile (lecteur YouTube `youtube-nocookie`, chargé au clic), notes.
- Onglet admin « Académie » : formulaire cours/leçons, refus de publier une formation externe sans autorisation.

**Phase B — Progression, quiz, exercices (≈3–4 crédits)**
- `academy_lesson_progress` (leçon vue/terminée), `academy_lesson_quizzes` (questions, réponses gardées côté serveur), `academy_quiz_attempts`, `academy_exercises` + `academy_exercise_submissions` (réponse texte, privée au membre).
- Notation serveur réutilisant la logique de `scoreQuiz` (80 %), certificat par cours via `certificate.ts`.
- Les 6 niveaux actuels restent ; option ultérieure de les migrer en cours « Fondamentaux ».

**Phase C — Coach IA contextuel (≈2–3 crédits)**
- Bouton « Demander au coach » sur la leçon : fonction serveur qui vérifie le plan, réserve via `reserve_ai_generation('coach_academie')`, envoie titre + notes + extrait de transcription au modèle, ton éthique (aucune promesse de revenus).

**Phase D (plus tard) — Hébergement vidéo direct**
- Stockage privé + liens signés courts ; colonne `video_provider` déjà prévue, donc sans refonte.

## 4. Fichiers et tables à toucher

Tables nouvelles : `academy_courses`, `academy_lessons`, `academy_lesson_progress`, `academy_lesson_quizzes`, `academy_quiz_attempts`, `academy_exercises`, `academy_exercise_submissions`. Enum : `ai_generation_type` + `coach_academie`. Tables existantes non modifiées.

Fichiers nouveaux : `src/lib/academy-video.functions.ts`, `src/lib/academy-video-rules.ts` (+ tests), `src/routes/_authenticated/academie_.cours.$slug.tsx`, `src/routes/_authenticated/academie_.cours.$slug.$lecon.tsx`, `src/components/academy/video-player.tsx`, `lesson-quiz.tsx`, `lesson-coach.tsx`, `admin-academy.tsx`.

Fichiers modifiés (minimum) : `academie.tsx` (section « Cours vidéo »), `admin.tsx` (onglet), `plans.ts` (rien de nouveau si on réutilise `academyFull`), `certificate.ts` (titre de cours), `ai.functions.ts` (coach), `AGENTS.md`.

## 5. Tests prévus
- Plan minimal par leçon (gratuit/pro/expert/business).
- Notation 80 % et refus des réponses invalides.
- Publication externe refusée sans autorisation.
- RLS : non-admin ne peut ni créer ni publier ; un membre ne lit pas les réponses/exercices d'un autre ; transcription non servie à un plan non autorisé.

## Hypothèses à confirmer
- Accès : leçon par leçon avec un plan minimal choisi par l'admin (par défaut Pro), le premier cours restant gratuit.
- Exercices = réponse texte libre, sans correction IA en phase B.
