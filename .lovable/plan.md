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
  - Ils sont stockés dans `app_settings` (clé `activity_rule` = {min_activities, window_days}). Lecture et écriture réservées à l'admin (règle actuelle d'`app_settings`) ; `member_activity` lit N et D côté serveur, vérifiée via `has_role(auth.uid(),'admin')`.
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
- V1 : durée de conservation de la trace d'activité (voir §11), à valider.
- Phase 2 : le modèle exact `teams`/`team_members` (rattachement d'un membre à plusieurs équipes ou à une seule) sera à trancher au démarrage de la phase 2.

## 11. Décision D1 — Activité conservée après suppression (option A, validée)
**Règle :** supprimer un prospect ou une publication n'efface jamais une activité qualifiante déjà enregistrée. Les indicateurs passés ne changent pas.

**Trace minimale** (nouvelle table `activity_ledger`, prévue en phase 0 bis, non créée) :
- membre (`user_id`) ;
- type : `etape`, `publication` ou `lecon` ;
- `occurred_at`, l'heure du serveur ;
- clé de déduplication unique : une empreinte non réversible, par exemple `etape:` + empreinte(prospect + transition + jour), `publication:` + empreinte(post), `lecon:` + empreinte(leçon) ;
- pour les leçons, le mode : lecture ou manuel ;
- `created_at`.

Interdit dans la trace : nom, téléphone, coordonnées, notes ou contenu du prospect, texte de la publication, et tout identifiant de prospect ou de post en clair.

**Écriture :** uniquement par des déclencheurs serveur, au moment de l'activité réelle (changement d'étape, première publication, première fin de leçon). Insertion seulement, avec `ON CONFLICT` sur la clé, ce qui garantit qu'une activité n'est jamais comptée deux fois.
- Aucun lien vers `prospects`, `content_posts` ni les leçons : leur suppression ne touche donc pas la trace.
- Aucun accès direct depuis le navigateur, ni en lecture ni en écriture : la lecture passe uniquement par `member_activity`.

**Source de vérité :** `member_activity` lit la trace, et non plus les tables d'origine. Chaque activité y est écrite une seule fois, au moment où elle se produit. Ce n'est pas une recopie d'indicateurs : les chiffres restent calculés à la lecture.

**Conservation et suppression :**
- Durée de conservation : **à valider** par le propriétaire, au regard des obligations applicables. Aucune durée n'est codée sans cette validation.
- En attendant, la purge est prévue mais désactivée : une fonction réservée à l'admin supprime les traces plus anciennes que X, une fois X validé.
- Suppression d'un compte : toutes ses traces sont supprimées.
- Demande d'effacement : suppression des traces du membre concerné, à la demande.
- La trace ne contenant aucune donnée de prospect, la suppression d'un prospect ne demande aucune anonymisation de la trace.

**Tests ajoutés :**
- Un changement d'étape crée une trace ; supprimer ensuite le prospect ne change pas le compte d'activité.
- Publier, supprimer le post : la publication reste comptée ; republier un autre post compte en plus ; republier le même post ne compte pas deux fois.
- Terminer une leçon, puis supprimer la formation : l'activité reste comptée.
- La trace ne contient aucune colonne de nom, téléphone, notes ni contenu.
- Un membre ou un leader qui lit ou écrit directement dans la trace est refusé.
- La suppression d'un compte supprime ses traces.
- Non-régression : Conversion, CRM, planificateur et Académie s'affichent comme avant.

## 12. Décision D2 — Organisation des équipes (option A, validée)
**Modèle prévu en phase 2** (non créé) :
- `teams` (id, parent_id nullable, owner_id, nom). C'est un arbre sans limite de profondeur.
- `team_memberships` (user_id, team_id, statut, dates), avec une contrainte d'unicité : **une seule équipe principale active par membre**.
- `team_managers` (user_id, team_id, délégué_par, dates, statut) : la **responsabilité**, distincte de l'appartenance. Un membre peut gérer plusieurs sous-équipes.

**Règles :**
- `team_scope(viewer)` est une fonction SECURITY DEFINER, récursive, qui renvoie les membres des équipes gérées par le viewer et de toutes leurs descendantes.
- Elle exclut les équipes sœurs et les niveaux supérieurs.
- C'est la seule source de périmètre pour `member_activity` et pour le partage de formations.

**Protection contre les cycles :** un déclencheur refuse tout `parent_id` qui ferait d'une équipe sa propre ascendante. Le contrôle se fait par parcours des ascendants, sous verrou.

**Écritures :** uniquement par des fonctions `team_*` SECURITY DEFINER. Le navigateur n'écrit jamais directement.
- Seul le propriétaire de l'arbre, ou un responsable pour ses descendantes, peut créer une sous-équipe ou déléguer.
- Retirer une délégation coupe l'accès immédiatement.

**Migration depuis `team_links` :**
- Chaque leader reçoit une équipe racine ; chaque lien actif devient une appartenance.
- `team_links` reste en place et lisible pendant la transition.
- Les octrois `course_grants` existants ne sont pas modifiés : l'accès accepté reste permanent.
- Tests avant/après : mêmes membres visibles, mêmes formations accessibles.

## 13. Décision D3 — Partage des formations (validée)
- Destinataires autorisés : les membres présents dans `team_scope(partageur)`, c'est-à-dire sa sous-équipe et ses descendantes. Les équipes sœurs et les niveaux supérieurs sont exclus.
- Les règles existantes restent inchangées : partage initial réservé à Business ou admin, un seul niveau de repartage, `can_reshare`, retrait possible dans les 7 jours, version reçue conservée, modération par leçon, abonnement et confidentialité.
- **Retrait d'une délégation (validé) :** un accès obtenu **uniquement** grâce au périmètre de la délégation cesse, même s'il avait été accepté. C'est une exception explicite et limitée à la règle de permanence des `course_grants`.
  - **Traçabilité de la cause :** nouvelle colonne `course_grants.via_manager_id`, nullable, qui désigne la délégation (`team_managers`) ayant permis le partage. Elle est remplie par `grant_share` seulement quand le destinataire n'était éligible que via cette délégation. Les octrois existants restent à NULL : ils ne sont pas concernés et restent permanents.
  - **Révocation ciblée :** la fonction `team_revoke_manager` passe au statut `revoque_delegation`, avec `ended_at`, uniquement les octrois dont `via_manager_id` est la délégation retirée. Les invitations en attente sont annulées de la même façon.
  - **Droits indépendants préservés :**
    - avant de couper, le serveur vérifie si le destinataire a une autre autorisation valide sur la même formation : il est propriétaire ou a un autre octroi actif ;
    - s'il est toujours dans un périmètre autorisé du même partageur, l'octroi est rattaché à cette autre délégation au lieu d'être coupé ;
    - la règle « une formation, un destinataire » (`course_id`, `recipient_id`) reste unique.
  - **Contrôle côté serveur :** `lessonAccess` et `course_grants` en lecture ignorent tout statut `revoque_delegation`. Aucun contrôle ne se fait dans le navigateur.
  - **Repartages en aval :** un octroi repartagé à partir d'un octroi coupé suit la même règle. Il cesse s'il dépendait uniquement de cette délégation, et il est conservé s'il repose sur une autre autorisation valide.
  - **Délai de 7 jours :** il continue à s'appliquer au retrait volontaire par le partageur. Le retrait de délégation est une cause distincte, sans délai.
  - **Tests :**
    - un octroi via délégation, accepté, est coupé au retrait de la délégation et la lecture est refusée ;
    - un octroi direct du propriétaire au même membre est conservé ;
    - un membre encore couvert par une autre délégation conserve son accès, rattaché à celle-ci ;
    - les octrois existants (NULL) ne sont pas touchés ;
    - une équipe sœur reste hors périmètre ;
    - un repartage en aval est coupé ou conservé selon la même règle ;
    - une invitation en attente est annulée ;
    - non-régression : retrait dans les 7 jours, versions reçues, modération et lien public inchangés.
- `grant_share` sera adapté pour utiliser `team_scope` au lieu de `team_links`, en phase 2 uniquement.

## 14. Conservation du registre `activity_ledger`
- Aucune durée fixée à ce stade.
- La durée sera déterminée après vérification des obligations légales et réglementaires applicables, des besoins opérationnels et du principe de minimisation des données.
- Jusqu'à cette décision, la purge reste désactivée.
- Le registre ne contient jamais de donnée personnelle de prospect.

## 15. Décisions restantes
- Durée de conservation du registre (§14).

## 16. Analyse juridique à compléter — conservation activity_ledger
**Statut : non tranché.** Aucune durée n'est fixée ni validée.

La durée sera déterminée après :
- l'analyse du droit camerounais applicable à la protection des données personnelles (textes en vigueur à identifier et à vérifier) ;
- l'analyse des éventuelles règles sectorielles applicables (vente directe, commerce électronique, consommation) ;
- la définition précise des finalités du registre : calcul des indicateurs d'activité et audit de ces indicateurs ;
- une **validation juridique locale** (juriste ou conseil au Cameroun).

Principes à examiner :
- **Finalité :** usage limité au calcul et à l'audit des indicateurs, sans autre réutilisation, publicitaire ou de profilage.
- **Minimisation :** trace limitée au membre, au type d'activité, à l'horodatage, à la clé de déduplication non réversible et au mode de fin de leçon. Aucune donnée de prospect.
- **Limitation de la conservation :** durée proportionnée aux finalités, à justifier, puis suppression ou anonymisation.
- **Sécurité :** aucun accès direct depuis le navigateur, lecture uniquement par fonction serveur, écriture par déclencheur, accès administrateur tracé.
- **Droits des personnes :** accès, rectification et effacement pour le membre concerné. Les modalités (procédure, délai de réponse) sont à définir.
- **Obligations de conservation ou de preuve :** vérifier s'il existe une obligation de garder ces traces (preuve, litige, contrôle) qui imposerait une durée minimale ou limiterait l'effacement.
- **Information des membres :** mention dans la politique de confidentialité, à rédiger après validation.

Règle d'ici là : **aucune purge automatique n'est activée** avant la validation juridique. La fonction de purge reste désactivée, et la suppression d'un compte ou une demande d'effacement est traitée à la demande.

### 16.1 Références — Loi camerounaise n°2024/017 du 23 décembre 2024
Source : texte officiel publié par la Présidence de la République. Les références ci-dessous sont celles fournies par le propriétaire. Leur rédaction exacte n'a pas été relue dans le texte officiel au cours de cette mise à jour.
- **Section 13 :** les données ne sont pas conservées plus longtemps que nécessaire au traitement. La durée dépend du régime d'autorisation prévu par la loi et ses textes d'application.
- **Section 21 :** la personne concernée est informée, notamment, de la durée de conservation.
- **Section 28 :** la durée maximale est fixée par l'Autorité dans son référentiel, selon la finalité et la nature des données.
- **Sections 27 et 29 :** obligations de sécurité et de traçabilité, et tenue du registre des traitements, à examiner.
- **Sections 37 à 42 :** droits d'accès, de rectification, d'opposition et d'effacement, sous réserve des obligations légales de conservation, à examiner.

### 16.2 Nature des données du registre
- `activity_ledger` contient des **données personnelles du membre** : `user_id` est un identifiant pseudonyme qui permet de le rattacher à une personne.
- Le registre n'est **pas anonyme**, même s'il ne contient aucune donnée de prospect.
- Obligations qui en découlent :
  - **minimiser** les champs ;
  - **sécuriser** l'accès ;
  - **informer** les membres, y compris sur la durée une fois fixée ;
  - inscrire le traitement au **registre des traitements** ;
  - **traiter les demandes de droits** (accès, rectification, opposition, effacement), en respectant les éventuelles obligations de conservation.

### 16.3 À confirmer par une validation juridique locale
- Les textes d'application de la loi n°2024/017.
- Le référentiel de l'Autorité et la durée maximale applicable à ce type de données.
- Les formalités applicables à MLM Boost AI : déclaration ou autorisation, registre, information.
- L'articulation entre le droit à l'effacement et l'audit des indicateurs.

**Aucune durée chiffrée n'est fixée. Aucune purge automatique avant validation.**
