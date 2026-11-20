# Audit en lecture seule — Performance & Team Intelligence Center

Pendant cet audit, aucun fichier applicatif, aucune table, aucune règle d'accès ni aucun paramètre n'a été modifié. Seules des lectures du code et de la base ont été faites. Ce document est un rapport ; il n'autorise aucun développement.

Deux points de la tâche précédente (lien public du Duplication Hub) restent ouverts. Ils sont repris en phase 0 :
- **Données de test restées en base de production :** 1 formation de test, 1 vidéo, 1 lien public et 2 fichiers du compte de test supprimé (formation 11111111-…0001). Le nettoyage est une écriture : je ne l'ai pas fait en mode plan.
- **Défaut constaté sur le panneau « Lien public » :** il affiche toujours « demande le plan Business ». La cause : la fonction de contrôle du plan Business (`_can_lead`) n'est pas exécutable par un compte connecté. L'appel échoue et la vérification renvoie toujours « non ». Côté visiteur, tout a été vérifié à 360 et 1280 px : leçon offerte lue, sommaire verrouillé, bouton d'inscription avec retour au lien. Le formateur voit aussi « Ouvrir dans l'éditeur ».

---

## A. Résumé exécutif

- L'application est **centrée sur l'utilisateur individuel**. Toutes les données commerciales (prospects, événements, campagnes, statuts, plans d'action, objectifs) sont **réservées à leur propriétaire** par les règles d'accès.
- La notion d'équipe se limite à **un seul niveau leader → membre** (`team_links`) :
  - un membre ne peut avoir qu'une équipe active ;
  - aucune sous-équipe, aucun responsable délégué, aucun rôle intermédiaire (rôles existants : `user`, `admin`).
- Ce qu'un leader voit de son équipe tient dans une fonction agrégée (`team_member_progress`) : nom, date d'arrivée, niveaux d'Académie validés et date du dernier niveau validé. Rien d'autre.
- **Absents :** module de ventes validées, notifications dans l'application, tâches planifiées, rapports, alertes, objectifs d'équipe, missions attribuées par un leader.
- **Données réelles :** 7 comptes, 12 prospects, 10 événements prospects, 0 équipe active (1 invitation en attente). On ne peut donc tester aucun indicateur d'équipe sur des données réelles.
- **Conclusion :** le module est faisable sans casser l'existant. Il demande toutefois une nouvelle couche « périmètre/hiérarchie » et quelques corrections en amont. Pour l'essentiel, c'est à développer (D), pas à réutiliser.

## B. Inventaire des fonctionnalités

Légende : **V** = vérifié dans le code (et par tests automatisés quand indiqué) · **P** = partiel · **NV** = présent, non vérifié en fonctionnement dans cet audit · **A** = absent ou seulement planifié.

| Module | État | Observé |
|---|---|---|
| Dashboard | NV | `routes/_authenticated/dashboard.tsx` : statistiques personnelles (`useCrm`), objectifs hebdo, Coach du jour, Centre de commande. Uniquement les données de l'utilisateur. |
| Prospects / CRM | V | `prospects` + `prospect_events` réservés au propriétaire. Limite de 10 prospects en Gratuit imposée par la base (`enforce_prospect_limit`). |
| Statistiques | P | `statistiques.tsx` : statistiques personnelles ; « avancées » à partir d'Expert (`advancedStats`). « Rapports hebdomadaires » affichés « Bientôt ». |
| Académie (niveaux, quiz) | V | `academy_progress`, notes calculées côté serveur (`record_academy_result`), tests présents. |
| Leçons vidéo, progression | V | `academy_lesson_progress`, écrite uniquement par le serveur (`record_lesson_progress`). |
| Vidéothèque / partage | V | `user_videos`, `course_versions`, `course_grants` ; le formateur voit la progression des destinataires dans l'éditeur. |
| Duplication (7 jours, kits) | V | `duplication_progress`, à partir de Pro. |
| Lien public Duplication Hub | P | Côté visiteur vérifié ; panneau formateur défectueux (voir plus haut). |
| Certificats | P | `lib/certificate.ts` : PDF généré dans le navigateur à partir d'un nom saisi (`/formation`). Ni enregistré ni vérifiable. Ce n'est pas un certificat fiable. |
| Équipes / invitations | P | `team_links`, `team_create_invite` (Business ou admin), `team_respond_invite`, `team_end_link`. Un seul niveau. |
| Sous-équipes, hiérarchie, délégation | A | Aucune table ni fonction. |
| Authentification / rôles | V | `user_roles` (`user` / `admin`), fonction `has_role`. |
| Abonnements / plans | V | `subscriptions` modifiable par l'admin seul ; `effective_plan`, `feature_plan`, `plans.ts` (`FEATURE_MIN_PLAN`). |
| Administration | NV | `admin.tsx` + `admin.functions.ts` : liste des comptes et abonnements (accès privilégié côté serveur), paiements, signalements vidéo, modération. |
| Notifications | A | Seulement des e-mails (paiement, authentification) : `payment-notify.server.ts`, `email-templates/`. Pas de notification dans l'application ni push. |
| Missions | P | Missions quotidiennes **personnelles** calculées dans l'appareil (`lib/coach.ts`, `buildDailyMissions`) ; événements `mission_faite` / `mission_passée`. Aucune mission attribuée par un leader. |
| Plan d'action 30 jours | V | `action_plans`, `action_plan_weeks`, personnels ; résultats recalculés. |
| Ventes validées | A | Aucune table ni écran. Seul signal : statut prospect « client » + `joined_team_at`, déclaré par l'utilisateur. |
| Fonctions serverless séparées | A | Aucune. Tout passe par des fonctions serveur de l'application et une seule adresse externe (`api/public/saspay-webhook`). |

## C. Matrice de compatibilité

| Fonction visée | Classe | Justification |
|---|---|---|
| Tableau de bord des équipes | B | Le modèle `team_member_progress` (agrégats, `SECURITY DEFINER`, appartenance + plan) est réutilisable. Il faut ajouter les indicateurs d'activité. |
| Équipes et sous-équipes multi-niveaux | D | `team_links` est à plat ; la règle « une seule équipe active » est codée dans `team_respond_invite`. |
| Responsables et délégation | D | Aucun rôle intermédiaire ; `app_role` limité à `user` / `admin`. |
| Objectifs individuels | C | `user_goals_weekly` existe, mais seul l'utilisateur le modifie. Un objectif fixé par un leader demande une table séparée pour ne pas écraser l'objectif personnel. |
| Objectifs collectifs | D | Absent. |
| Suivi des activités commerciales | C | `prospect_events` est la bonne source, mais il est écrit depuis le navigateur et **supprimable par l'utilisateur** (règle DELETE) : non fiable comme preuve d'activité (voir E). |
| Analyse IA et recommandations | B | Le quota IA partagé (`reserve_ai_generation`) est réutilisable. Il faut lui fournir uniquement des agrégats, jamais les prospects. |
| Alertes intelligentes | D | Ni notification ni tâche planifiée. Démarrer par des alertes calculées à l'ouverture. |
| Analyse de croissance des équipes | B | `team_links.accepted_at` / `ended_at` et `referrals` donnent arrivées et départs. |
| Centre de missions et accompagnement | B/D | Moteur de missions personnelles réutilisable ; attribution par un leader à développer. |
| Rapports individuels et collectifs | B | Fonctions pures réutilisables (`weeklyRecap`, `action-plan.ts`, `campaigns.ts`, `conversion.ts`) ; agrégation d'équipe à créer. |
| Classements privés par défaut | D | Absent ; consentement explicite à créer. |
| Membre actif (7 jours, seuil réglable) | D | Aucun calcul existant ; dépend de la correction de `prospect_events`. |

## D. Tables, sources de vérité, risques de doublons

- **Activité commerciale :**
  - `prospect_events` (types : `message_envoyé`, `message_copié`, `changement_statut`, `relance_reportée`, `note_modifiée`, `mission_faite`, `mission_passée`, `campagne_attribuée`) ;
  - `prospects` (`status`, `last_contact_date`, `next_followup_date`, `first_contact_at`, `joined_team_at`, `campaign_id`, `source_post_id`) ;
  - `content_posts` (`status = publie`, `published_at` fixé par le serveur) ;
  - `campaigns`.
- **Pédagogie :** `academy_progress`, `academy_lesson_progress`, `duplication_progress`, `course_grants` + `course_versions`.
- **Équipe :** `team_links` (leader_id, member_id, status, accepted_at, ended_at) ; `referrals` (parrainage, distinct de l'équipe).
- **Plans :** `subscriptions`, `effective_plan` / `feature_plan`.
- **Risques de doublons :**
  - recréer un journal d'activité parallèle à `prospect_events` ;
  - recopier les objectifs dans une table concurrente de `user_goals_weekly` ;
  - mélanger parrainage (`referrals`) et équipe (`team_links`) ;
  - recalculer en SQL ce que `coach.ts` calcule déjà dans l'appareil (risque de chiffres différents entre le Dashboard et le Centre). Il faut une seule définition par indicateur.
- **Données non validées :**
  - événements prospects déclarés depuis le navigateur ;
  - statut « client » déclaré ;
  - `message_envoyé` signifie « WhatsApp ouvert », pas « message réellement envoyé ».

## E. Sécurité

- **Bon socle :** tout est réservé au propriétaire, et la vue leader ne passe que par une fonction agrégée qui vérifie à la fois l'appartenance et le plan. La règle « Business seul ne suffit pas » est déjà respectée.
- **Lacunes et risques :**
  1. `prospect_events` peut être supprimé et horodaté côté client : un indicateur « membre actif » serait falsifiable ou effaçable.
  2. Aucune notion de périmètre hiérarchique. Toute vue d'équipe future doit passer par une seule fonction de périmètre, jamais par l'ouverture des règles d'accès des tables.
  3. **Données sensibles à ne jamais montrer aux leaders ni envoyer à l'IA sans autorisation :** noms et téléphones des prospects, `notes`, `main_objection`, contenus générés par l'IA (`ai_generations`), contenu des événements, paiements.
  4. `capture_page_view` peut être appelée directement, y compris sans compte, ce qui peut gonfler le nombre de visites (faible gravité).
  5. `_can_lead` n'est pas exécutable par un compte connecté (défaut du panneau Lien public).
  6. L'admin lit toutes les lignes de `profiles` et `subscriptions`. Un Centre visible par l'admin devra rester sur des agrégats.

## F. Architecture recommandée

- **Hiérarchie :**
  - nouvelles tables `teams` (parent_id, owner) et `team_members` (team_id, user_id, rôle `membre` ou `responsable`, statut) ;
  - reprise des `team_links` actifs comme équipe racine ;
  - fonction unique `team_scope(viewer)` qui renvoie les membres autorisés (responsable = sa sous-équipe et ses descendants).
- **Lecture :** uniquement des fonctions agrégées à exécution privilégiée, filtrées par `team_scope`. Aucune règle de lecture ouverte sur `prospects` ou `prospect_events`.
- **Activité qualifiante :** une seule définition côté base. Événements réglables (liste + seuil de jours, 7 par défaut) issus de `prospect_events`, `content_posts` publiés et leçons terminées. Une simple connexion ne compte jamais.
- **Objectifs et missions :** tables `team_goals` et `team_missions` (créées par un responsable dans son périmètre, validées par le membre). Aucun envoi automatique.
- **Alertes :** calculées à l'ouverture en V1, sans tâche planifiée.
- **IA :** sur agrégats anonymisés, avec le quota existant.
- **Classements :** consentement explicite par membre, désactivé par défaut.
- **Accès :** nouvelle fonctionnalité `teamCenter` dans `FEATURE_MIN_PLAN`, en plus de la vérification de périmètre.
- **Visuel :** réutiliser `AppShell`, les cartes et les jetons existants, en mobile-first. Pas de refonte.

## G. Plan par phases

0. **Prérequis :**
   - nettoyer les données de test ;
   - corriger le contrôle Business du panneau Lien public ;
   - rendre `prospect_events` non supprimable et horodaté par le serveur ;
   - trancher la source « ventes validées ».
1. **V1 lecture seule, un niveau :** tableau d'équipe à partir des `team_links` actuels (membres actifs sur 7 jours, activité agrégée, progression Académie). Tests en base dans une transaction annulée, avec 3 comptes.
2. **Hiérarchie et délégation :** sous-équipes, responsables, `team_scope`. Tests anti-fuite entre équipes.
3. **Objectifs et missions** attribués par un leader.
4. **Alertes et rapports** individuels et collectifs.
5. **Analyse IA et recommandations,** puis classements avec consentement.

Chaque phase : tests des règles, vérification 360 / 1280 px, aucune publication sans accord.

## H. Avant de démarrer

- **Réutilisable tout de suite :** `team_links`, le modèle `team_member_progress`, `effective_plan` / `FEATURE_MIN_PLAN`, `reserve_ai_generation`, les fonctions pures de `coach.ts` / `action-plan.ts` / `campaigns.ts`, les composants d'interface.
- **À corriger en amont :** `prospect_events` (suppression, horodatage), `_can_lead`, nettoyage des données de test, certificats non vérifiables (à ne pas utiliser comme indicateur).
- **À développer :** hiérarchie, délégation, périmètres, objectifs et missions d'équipe, alertes, rapports, classements, consentement.
- **Décisions humaines nécessaires :**
  1. Source des « ventes validées » : il n'existe pas de module de ventes. Faut-il le créer, ou s'appuyer sur le statut « client » ?
  2. Un membre peut-il appartenir à plusieurs équipes ? (Aujourd'hui : non.)
  3. Liste exacte des activités qualifiantes et seuil par défaut.
  4. Ce qu'un leader voit : uniquement des chiffres agrégés (recommandé), ou aussi des noms de prospects ?
  5. Plan requis pour un responsable délégué (son propre plan ou celui du leader).
  6. Profondeur maximale de la hiérarchie.
  7. Qui peut voir un classement, et comment le membre donne son accord.

## I. Conclusion

- **Phase recommandée :** phase 0, puis phase 1 (tableau d'équipe en lecture seule sur un niveau).
- **Critères de validation de la phase 1 :**
  - un leader Business ne voit que ses membres actifs, et uniquement en chiffres agrégés ;
  - un compte Business sans équipe ne voit rien ;
  - un membre ne voit aucune donnée d'un autre membre ;
  - un membre « actif » l'est seulement grâce à une activité qualifiante sur la période ;
  - les chiffres affichés concordent avec le Dashboard du membre ;
  - affichage correct à 360 et 1280 px ;
  - tests des règles réussis.
- **Recommandation :** GO pour la phase 0, puis la phase 1 après les décisions 1, 3 et 4. NO-GO pour la hiérarchie et l'IA avant ces décisions.
