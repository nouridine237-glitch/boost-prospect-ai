# Performance & Team Intelligence Center — périmètre V1 actualisé

Plan uniquement. Aucun fichier applicatif, aucune table, aucune règle d'accès ni migration n'est modifié à cette étape.

## 1. Intégration des trois décisions

### Décision 1 — Pas de module Ventes
- La V1 ne contient aucun indicateur « ventes », « chiffre d'affaires » ou « clients gagnés ».
- Le passage d'un prospect au statut « Client » reste une étape du pipeline. Il est compté comme une activité (changement d'étape), jamais comme une vente.
- Prévision future : un emplacement réservé `sales` dans la liste des sources d'indicateurs (code seulement, rien en base). Un futur module Ventes aura sa propre table et sa propre validation, puis il sera simplement branché comme une source supplémentaire.
- Compatible avec l'existant : aucune règle actuelle ne traite « Client » comme une vente.

### Décision 2 — Membre actif sur 7 jours (seuil configurable)
Sources vérifiées dans le code :

| Activité retenue | Source actuelle | Traçable ? | Fiabilité actuelle |
|---|---|---|---|
| Changement d'étape | `prospect_events` type `changement_statut`, écrit par `crm.tsx` | Oui | **Partielle** : l'événement est écrit par le navigateur. Un membre peut en insérer un sans vrai changement d'étape. La date est bien forcée par le serveur et la suppression est bloquée (phase 0). |
| Relance effectuée | Aucun | **Non** | `relance_reportée` = report de date, pas une relance faite. `message_envoyé` = ouverture de WhatsApp, exclu par votre décision. Il n'existe aucun événement distinct « relance effectuée ». |
| Publication publiée | `content_posts.status = 'publie'`, `published_at` fixé par le serveur | Oui | **Déclarative** : c'est le membre qui coche « publié ». Le passage publié → brouillon → publié remet la date à zéro, et un post supprimé disparaît. |
| Leçon terminée | `academy_lesson_progress.completed_at` (écrit par le serveur seulement) | Oui | **Bonne** : lecture réelle (`lecture`) ou clic manuel après au moins 60 % de la durée (`manuel`). |

Exclus : copie (`message_copié`), ouverture de WhatsApp (`message_envoyé`), connexion, notes, report de relance, missions du coach, attribution de campagne, jours de duplication, quiz.

Anti-doublon : on compte des activités distinctes par jour et par type.
- Une étape = une paire (prospect, transition, jour).
- Une publication = un post, compté une seule fois à sa première publication.
- Une leçon = une leçon, comptée une seule fois à sa première fin.

## 2. Décisions A1 à A6 (validées)
- **A1 Relances :** exclues du calcul « membre actif » en V1. Aucun nouvel événement « relance faite ».
- **A2 Publications :** comptées comme activité **déclarative**, avec le libellé « déclaré publié — pas une preuve de publication externe ». Nouvelle colonne `content_posts.first_published_at`, remplie une seule fois par le serveur et jamais remise à zéro. Une republication ne compte pas deux fois. Un post supprimé n'est plus compté (pas de recopie des données).
- **A3 Noms des membres :** le leader voit le nom de chaque membre de son périmètre et ses chiffres d'activité. Il ne voit jamais un nom, un numéro, une coordonnée, une note ni un contenu de prospect.
- **A4 Petites équipes :** pas de seuil minimal. Seuls les chiffres nécessaires sont renvoyés, et uniquement pour le périmètre autorisé.
- **A5 Leçons :** une leçon terminée en manuel (au moins 60 % de la durée) compte pour « actif ». Les indicateurs affichent séparément « lecture complète » (`completion_method = lecture`) et « fin déclarée » (`manuel`), jamais additionnées sous un même libellé.
- **A6 Historique :** seuls les changements d'étape créés par le déclencheur serveur comptent. Sa date de mise en service est enregistrée dans `app_settings` (clé `activity_measure_start`) et affichée sous la forme « Mesure depuis le JJ/MM/AAAA ». Pour les publications et les leçons, la même date de début s'applique, pour que tous les chiffres partent du même jour.

## 3. Spécification consolidée — membre actif (V1)
Un membre est **actif** s'il a au moins N activités qualifiantes (N = 1 par défaut, configurable) sur les D derniers jours (D = 7 par défaut, configurable), à partir de `activity_measure_start`.

Activités qualifiantes (sans doublon) :
1. Un changement d'étape réel, écrit par le serveur. Une seule fois par prospect, par transition et par jour.
2. La première publication d'un post (`first_published_at`, déclarative).
3. La première fin d'une leçon (`completed_at`), avec le détail lecture ou manuel.

Ne comptent jamais : copie, ouverture de WhatsApp, connexion, notes, report de relance, missions du coach, campagnes, quiz, jours de duplication, statut « Client » en tant que vente.

## 4. Travaux préalables (phase 0 bis)
1. Un déclencheur serveur sur `prospects` écrit `changement_statut` lors d'un vrai changement d'étape. Ce type d'événement est refusé s'il est envoyé par le navigateur, et l'écriture faite dans `crm.tsx` est retirée. L'historique « Conversion » existant reste lisible.
2. Ajout de `first_published_at` (ajout seulement). Le déclencheur `content_posts_guard` est étendu pour la remplir une seule fois.
3. Ajout de la clé `activity_measure_start` dans `app_settings`.
4. Une fonction unique `member_activity(_viewer, _days)` en SECURITY DEFINER. Elle renvoie des comptes par membre : étapes, publications déclarées, leçons en lecture complète, leçons en fin déclarée, actif oui/non. Elle ne renvoie aucun identifiant de prospect. Le périmètre se vérifie par l'utilisateur lui-même ou par un lien actif dans `team_links`.

## 5. Visibilité et sécurité
- Les règles d'accès existantes réservées au propriétaire ne changent pas. Le leader ne lit aucune table de ses membres, seulement `member_activity`.
- Le forfait Business ne suffit pas à lui seul : il faut aussi le périmètre et `FEATURE_MIN_PLAN.teamCenter`.
- Les classements restent privés par défaut : rien n'est classé en V1.

## 6. Conflits ou tensions avec les décisions déjà validées
- **Structure libre d'équipes et sous-équipes, sur plusieurs niveaux :** l'existant (`team_links`) n'a qu'un niveau. La V1 reste à un niveau. Le multi-niveau demande les tables `teams` et `team_members` en phase 2. `member_activity` est conçue pour recevoir alors une fonction `team_scope(viewer)` sans changer son calcul. Ce n'est pas un conflit, c'est un report.
- **Délégation aux responsables :** absente en V1 et dépendante de la phase 2. Une fois en place, un responsable délégué verra lui aussi les noms des membres (A3) de sa sous-équipe uniquement. C'est à confirmer à ce moment-là.
- **Classement privé par défaut :** compatible. A3 donne au leader une liste nominative de chiffres, mais ce n'est pas un classement partagé. L'affichage sera trié par nom, pas par score, pour ne pas créer un classement implicite. Le classement opt-in arrive en phase 5.
- **Source unique de vérité :** respectée. Le calcul se fait toujours à la volée depuis `prospect_events`, `content_posts` et `academy_lesson_progress`, sans table de recopie. Seule réserve : A2 dépend de la ligne du post. Supprimer un post retire l'activité, ce qui est cohérent avec la source unique.
- **Ventes :** aucune. Un emplacement est réservé pour un futur module Ventes.

## 7. Dépendances et ordre
Phase 0 bis (déclencheur, colonne, date de début, fonction), puis tests en base, puis phase 1 (carte membre et tableau leader à un niveau). Ensuite, phase 2 (hiérarchie et délégation), phase 3 (objectifs et missions), phase 4 (alertes et rapports), phase 5 (IA et classements opt-in).

## 8. Tests d'acceptation
- Un `changement_statut` envoyé depuis le navigateur est refusé ; un vrai changement d'étape crée exactement un événement.
- Deux changements identiques le même jour comptent pour 1.
- Copie, ouverture de WhatsApp, connexion, report de relance et quiz : le membre reste inactif.
- Publier, dépublier puis republier : 1 publication, et `first_published_at` ne change pas.
- Une leçon en lecture complète compte en « lecture » ; une fin manuelle compte en « déclarée » ; une leçon terminée deux fois compte pour 1.
- Les événements antérieurs à `activity_measure_start` sont ignorés, et la date s'affiche.
- Un leader avec lien actif voit les noms des membres et leurs chiffres, et aucun champ de prospect. Sans lien, ou Business sans équipe : 0 ligne. Un lien terminé coupe l'accès immédiatement.
- Une équipe d'un seul membre s'affiche (aucun seuil).
- Un membre ne voit que ses propres chiffres.
- Changer les réglages N et D modifie bien le résultat.
- Non-régression : CRM, Conversion, planificateur, Académie, lien public et tous les tests existants passent.

## 9. Décisions finales (validées)
- **Paramètres N et D (V1) :** seul un administrateur peut les modifier.
  - Ils sont stockés dans `app_settings` (clé `activity_rule` = {min_activities, window_days}). Lecture par tous les utilisateurs connectés, écriture réservée à l'admin, vérifiée via `has_role(auth.uid(),'admin')`.
  - Bornes contrôlées côté serveur : N de 1 à 20, D de 1 à 90.
  - Un réglage dans l'écran d'administration existant.
  - `member_activity` lit toujours ces valeurs côté serveur : aucun paramètre n'est envoyé par le navigateur. Les mêmes valeurs servent donc au membre, au leader et aux tests.
  - Chaque changement est horodaté (`updated_at`) et la règle en vigueur est affichée (« Actif : N activité(s) sur D jours »).
- **Responsables délégués (phase 2) :** un responsable voit uniquement les noms et les chiffres d'activité des membres de sa sous-équipe autorisée, c'est-à-dire sa sous-équipe et celles qui en dépendent, selon `team_scope(viewer)`.
  - Il ne voit jamais un nom, un numéro, une coordonnée, une note ni un détail de prospect.
  - Il n'a pas accès aux équipes sœurs ni au niveau supérieur.
  - Il perd l'accès dès que sa délégation est retirée.
  - Il passe par la même fonction `member_activity` : aucun chemin d'accès supplémentaire.

Tests ajoutés :
- Un non-admin qui tente de modifier N ou D est refusé.
- Des valeurs hors bornes sont refusées.
- Un changement de N ou D par l'admin modifie le statut actif partout de façon identique.
- Phase 2 : un responsable ne voit pas une sous-équipe sœur ; après retrait de sa délégation, il obtient 0 ligne ; aucun champ de prospect n'apparaît.

## 10. Points encore ouverts
- Aucun pour la V1.
- Phase 2 : le modèle exact `teams`/`team_members` (rattachement d'un membre à plusieurs équipes ou à une seule) sera à trancher au démarrage de la phase 2.
