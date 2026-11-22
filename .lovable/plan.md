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

## 2. Incompatibilités et corrections préalables (phase 0 bis)
1. **Changement d'étape fiable :** ajouter un déclencheur côté serveur sur `prospects`, qui écrit lui-même `changement_statut` quand le statut change vraiment. Ensuite, refuser ce type d'événement quand il vient du navigateur, et retirer l'écriture faite dans `crm.tsx`. Les événements anciens restent lisibles, mais le calcul « actif » utilisera seulement ceux du déclencheur, à partir de sa date de mise en service.
2. **Publication :** garder la première date de publication. Pour cela, ajouter une colonne `first_published_at` qui ne change plus une fois remplie (ajout seulement, aucune donnée existante modifiée). Le caractère déclaratif reste : à valider (A2).
3. **Relance :** non traçable aujourd'hui. Choix à faire (A1).
4. **Vue de calcul unique :** une fonction serveur `member_activity_7d(...)` qui ne renvoie que des comptes. Elle sert à la fois au membre, pour lui-même, et au leader, en agrégats seulement. Aucune table de recopie.

## 3. Décision 3 — Leader : agrégats seulement
- Le leader ne lit jamais `prospects`, `prospect_events`, `content_posts` ni la progression détaillée d'un membre. Les règles d'accès actuelles réservées au propriétaire restent inchangées.
- L'accès passe uniquement par des fonctions serveur, sur le modèle de `team_member_progress`. Elles vérifient le lien d'équipe actif dans `team_links` et renvoient des chiffres.
- **Incompatibilité à arbitrer (A3) :** aujourd'hui, `team_member_progress` renvoie déjà le **nom du membre** au leader. Votre décision interdit les identifiants des *prospects*. Elle ne précise pas les *membres*.
  - Option a : garder le nom du membre, avec ses chiffres seulement.
  - Option b : vue d'équipe totalement anonyme (totaux et répartition uniquement).
- Seuil de petite équipe : si l'équipe compte moins de 3 membres, afficher seulement les totaux, pour éviter de deviner qui a fait quoi (A4).
- Le forfait Business ne suffit jamais à lui seul : il faut un lien d'équipe actif ET le bon forfait. Le réglage `teamCenter` est ajouté dans `FEATURE_MIN_PLAN`.

## 4. Plan technique actualisé (V1)
- **Phase 0 bis (prérequis) :** déclencheur de changement d'étape côté serveur, `first_published_at`, fonction `member_activity_7d`, puis tests en base dans une transaction annulée.
- **Phase 1 :** carte « Mon activité 7 jours » pour le membre, et tableau d'équipe d'un seul niveau en lecture seule : membres actifs / total, activités par type, leçons terminées, évolution sur 4 semaines.
- **Phase 2 et suivantes** (inchangées) : hiérarchie et délégation, objectifs et missions, alertes et rapports, puis IA et classements. Toutes reposent sur la même fonction de calcul.
- Module Ventes : hors V1.

## 5. Tests prévus
- Un faux `changement_statut` envoyé depuis le navigateur est refusé ; un vrai changement d'étape crée un seul événement.
- Copie, WhatsApp et connexion ne rendent pas un membre actif.
- Publier, dépublier puis republier un post compte une seule publication.
- Une même leçon terminée deux fois compte une seule fois.
- Un leader sans lien actif obtient 0 ligne ; un Business sans équipe obtient 0 ligne ; aucun nom ni numéro de prospect dans les réponses.
- Le seuil configurable (7 jours par défaut) est respecté.

## 6. Points à arbitrer
- **A1 Relance :** (a) l'exclure en V1, ou (b) ajouter un bouton explicite « Relance faite », déclaratif, compté comme événement distinct.
- **A2 Publication déclarative :** l'accepter comme activité, sachant que rien ne prouve la publication réelle ?
- **A3 Nom des membres** visible par le leader : option a ou b.
- **A4 Seuil d'anonymat** pour les petites équipes : 3 membres ?
- **A5 Leçon terminée en manuel** (au moins 60 % de la durée) : la compter, ou seulement la lecture réelle ?
- **A6 Historique :** les changements d'étape enregistrés avant le déclencheur ne comptent pas. Accepté ?
