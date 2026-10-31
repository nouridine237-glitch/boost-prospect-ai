# Rapport d'audit — état actuel (commit 2c0e4bf)

Audit seulement : aucun fichier, aucune base, aucune publication modifiés. Ce plan ne propose aucun changement ; l'approuver ne lance rien.

## 1. Coach du jour V2/V3 — implémenté

Code vérifié :
- `src/lib/coach.ts` : `priorityScore` (retard, intérêt, ancienneté, statut, objection), `priorityOf` (haute ≥50, moyenne ≥25, sinon normale), `CoachSettings` (missions 3/5/8, `restDays`, ton amical/professionnel, lus par `readCoachSettings`), `isRestDay`, `matchObjectionId`, `streak`, `weeklyRecap`, `suggestNextGoals`.
- `src/components/coach-card.tsx` : badge « Priorité … », jour de repos, conseil IA au clic via `suggestNextAction`. Les conseils du jour sont relus depuis `ai_generations` (filtrés par `user_id`), sans nouvelle génération automatique. Il affiche aussi la réponse courte du Gestionnaire d'objections, avec un bouton Copier.
- `src/components/coach-week.tsx` : série, bilan de la semaine passée, objectifs proposés.
- `src/lib/ai.functions.ts` : `suggestNextAction` lit le prospect avec `.eq("user_id", context.userId)`. Le risque relevé lors de l'audit précédent est donc corrigé. Le quota passe par la réservation `ai_usage_log`.

Tests automatisés (lancés pendant cet audit) : `src/lib/coach.test.ts` — 19 tests passent.

Navigateur : aucun test fait. L'écran du coach, les réglages, le bouton « Accepter les objectifs proposés » et le conseil IA n'ont pas été vérifiés à l'écran.

Risques :
- Fuseau horaire : on se base sur le jour local de l'appareil, non vérifié côté serveur.
- Le choix entre une objection et un modèle se fait par mots-clés et peut se tromper.

## 2. Templates Longrich — implémenté (plan Pro et plus)

Code vérifié :
- `src/lib/plans.ts` : `companyTemplates: "pro"`. La carte du plan Pro mentionne la fonctionnalité, celle du plan Business non.
- Migrations `0014_company_templates_longrich.sql` (colonne `company`, 10 scripts, fonction `company_script_teasers` qui ne renvoie que le titre et la catégorie) et `0015_company_templates_plan_pro.sql` (lecture si `company IS NULL`, plan effectif pro/expert/business, ou admin).
- `src/lib/scripts.functions.ts` (`getScripts`) : les scripts verrouillés arrivent sans texte. Le verrou est donc côté serveur.
- `src/routes/_authenticated/scripts.tsx` : filtre Entreprise, cadenas et bouton « Passer au plan Pro ».

Tests automatisés : `src/lib/plans.test.ts` — 4 tests passent.

Navigateur (tour précédent, selon l'historique) : cadenas vu avec un compte Gratuit, pas revérifié aujourd'hui. Lecture complète vérifiée en direct pour un abonné Business. Pas vérifiée avec un compte Pro réel, car le seul abonnement Pro en base a dépassé sa date de renouvellement.

Risques :
- Les 10 textes ont été rédigés par l'IA et sont à relire (santé, revenus).
- Le contenu est en base : la règle de lecture s'applique déjà en ligne, même avant publication.

## 3. Autres changements récents

- `src/router.tsx` : nouvelles tentatives en cas de décalage d'horloge (« JWT issued in the future »). Aucun test automatisé, non reproduit.
- `roadmap.md` et le plan mis à jour (sans effet sur l'app).
- Les commits nommés « Changes » n'ont pas été détaillés un par un.

## 4. Tests

- 23 tests passent, 0 échec (2 fichiers). La première exécution a renvoyé un code de sortie 1 malgré 0 échec, la seconde est sortie normalement : c'est à surveiller, ce n'est pas un échec de test.
- Aucun test pour SasPay, le parrainage ou la page de capture dans `src/lib`.

## 5. Publication — non confirmée

- Base de données (migrations 0014/0015) : déjà active en ligne, car une seule base sert l'aperçu et le site publié.
- Code de l'interface (coach V2/V3, page Scripts, correctif d'horloge) : aucune publication faite par moi depuis le coach V2. Je n'ai pas pu prouver quelle version tourne sur mlmboostai.app. À considérer comme présent seulement dans l'éditeur tant qu'aucune publication n'est faite.
- Conséquence : en ligne, la page Scripts peut encore afficher l'ancien texte (« plan Business ») alors que la base ouvre déjà l'accès au Pro.

## Prochaine étape recommandée

Publier, puis tester à l'écran avec un compte Pro actif et un compte Gratuit : page Scripts, carte du coach et bouton « Accepter ».
