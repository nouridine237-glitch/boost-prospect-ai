# Vidéothèque MLM et duplication vidéo V1 — plan technique révisé

Décisions intégrées :
- **D1** : l'import de vidéos est ouvert à partir du plan Pro.
- **D2** : le leader et les membres qu'il autorise peuvent partager.
- **D3** : un accès reçu est durable.

## A. Constats vérifiés dans le code et la base

- **`team_links`**
  - Colonnes : `leader_id`, `member_id`, `invite_code` (unique), `status` parmi `invite|actif|refuse|quitte|revoque`, `expires_at` (invitation valable 14 jours), `accepted_at`, `ended_at`.
  - Un index unique impose **un seul leader actif par membre**.
  - Aucune contrainte n'empêche un membre d'être lui-même leader : une chaîne A → B → C est donc déjà possible. Le partage ne doit pas la suivre automatiquement.
  - Les deux parties peuvent lire le lien. Toute écriture passe par les fonctions SECURITY DEFINER `team_*`.
- **Diriger une équipe** : `_can_lead` exige le plan Business (`feature_plan`, essai Pro de parrainage inclus) ou un compte admin. Inviter suppose ce plan, ce qui limite à 50 invitations ouvertes.
- **Rôles** : la table `user_roles` ne connaît que `user` et `admin`. Il n'existe aucun rôle d'équipe délégué.
- **Plans** : l'ordre est `gratuit < pro < expert < business`. La vérification se fait par `effective_plan` (3 jours de grâce) et `hasFeature`/`FEATURE_MIN_PLAN`.
- **Académie** :
  - les cours et leçons sont gérés par l'admin seul ;
  - une leçon n'accepte que YouTube (`video_provider IN ('youtube')`) ;
  - la progression est écrite dans `academy_lesson_progress` par `record_lesson_progress`, sous le `user_id` de la personne qui regarde.
- **Stockage** : un seul bucket privé, `payment-proofs`, limité à 10 Mo par fichier, sans filtre de type. Je n'ai pas pu lire la limite globale du projet par fichier : **à vérifier**.

## B. Modèle de partage durable

Unité partagée : **une formation (cours)**, jamais un fichier isolé. L'accès est **individuel** : une ligne par destinataire.

Le « partage au groupe » ne crée pas de droit collectif. Il crée en une fois une autorisation par membre actif à cet instant. Un membre qui rejoint l'équipe plus tard ne reçoit rien automatiquement : il faut partager de nouveau, en un clic. C'est ce qui permet un accès durable même si l'équipe change.

Table `course_grants` :
- `id` et `course_id`, avec une clé étrangère vers `academy_courses` sans suppression en cascade (le cours est archivé, jamais supprimé physiquement) ;
- `owner_id` : la personne qui a créé la formation, recopiée au moment du partage ;
- `grantor_id` : la personne qui a partagé ;
- `recipient_id` ;
- `origin` : `direct` (à une personne) ou `equipe` (à tout le groupe) ;
- `status` :
  - `en_attente` : le destinataire doit accepter ;
  - `actif` ;
  - `refuse` ;
  - `revoque_proprietaire` ;
  - `retire_moderation` ;
- `can_reshare` (faux par défaut) ;
- `updates_mode` : `suivre` (le destinataire voit la version actuelle) ou `figee` (il garde la version reçue) ;
- `version_id` : la version reçue, utilisée en mode `figee` ;
- `created_at`, `accepted_at`, `ended_at` ;
- une seule autorisation par couple (cours, destinataire).

Les trois notions sont séparées :
- **accès durable** : `status = actif`. Il ne dépend ni du plan du propriétaire, ni de `team_links`.
- **droit de repartager** : `can_reshare`. Seul le propriétaire peut l'accorder.
- **mises à jour** : `updates_mode`. Proposé : `suivre` par défaut, et passage automatique en `figee` si le propriétaire perd ses droits ou supprime son compte (voir D).

Versions : table `course_versions` (`course_id`, numéro, date, liste des leçons et des vidéos). Une version est créée à chaque publication. Les fichiers ne sont pas dupliqués : la version ne fait que les référencer.

Changement d'équipe d'un membre : ses autorisations restent actives. Seul son droit de repartager (`can_reshare`) est conservé ou non, selon la décision 3 plus bas.

## C. Partage par un membre : borné à un seul niveau

- Le propriétaire (leader Business ou admin) partage à ses membres actifs. Partager **à quelqu'un** suppose que cette personne soit son membre direct actif au moment du partage.
- Le propriétaire peut cocher « autoriser à repartager » pour un membre précis. Ce membre peut alors partager **cette formation uniquement**, et seulement à **ses propres membres directs actifs**. Il doit donc lui-même diriger une équipe, donc être en plan Business. À valider en décision 2.
- Les autorisations créées par un membre qui repartage ont toujours `can_reshare = false` : la propagation s'arrête au niveau 2. Un trigger refuse tout repartage dont l'auteur n'est pas le propriétaire ou n'a pas `can_reshare`.
- Limites : 200 destinataires actifs par formation et par auteur du partage, et 50 partages par jour.
- Le propriétaire voit la liste complète des destinataires, niveau 2 compris, et peut retirer le droit de repartager. Ce retrait ne révoque pas les accès déjà donnés.
- Toutes les écritures passent par des fonctions SECURITY DEFINER `grant_*` (partager, accepter, refuser, révoquer). Aucune écriture directe n'est faite par le navigateur.

## D. Propriété, conservation et retrait

- Le fichier appartient au propriétaire, et le stockage est compté dans son quota.
- **Retirer une vidéo** : elle est archivée (`archived_at`), pas supprimée. Elle disparaît de sa médiathèque et ne peut plus servir dans une nouvelle leçon. Les destinataires d'une version qui la contient la gardent. Le fichier n'est supprimé physiquement que si aucune autorisation active n'y fait référence. Tant qu'il reste référencé, il continue de compter dans le quota du propriétaire (« conservé pour X personnes »).
- **Modifier une formation** : une publication crée une nouvelle version. Les destinataires en mode `suivre` voient la nouvelle, ceux en mode `figee` gardent l'ancienne.
- **Révocation volontaire par le propriétaire** : statut `revoque_proprietaire`. Avec la décision D3, elle n'est permise que dans certains cas, à trancher en décision 4.
- **Compte supprimé** : les cours et les vidéos encore référencés sont transférés à un statut « conservé par la plateforme » (`owner_deleted_at`). Les destinataires gardent leur accès en version figée. Il faut **mentionner dans les conditions d'utilisation** que la plateforme conserve ces copies pour les personnes qui les ont reçues. Proposé : suppression définitive après 12 mois, à valider.
- **Retrait pour modération (illégal ou violation de droits)** : l'admin passe la vidéo en `retire_moderation`. Toutes les autorisations liées sont coupées, le fichier est supprimé physiquement, et une trace est conservée (date, motif, admin). C'est la seule exception à l'accès permanent. Un bouton « Signaler » est disponible pour les destinataires, et une case « je détiens les droits » est obligatoire à l'import.

## E. Quotas et coûts

Les quotas sont vérifiés par un trigger en base, comme `LIMITE_PROSPECTS` :

| | Pro | Expert | Business |
|---|---|---|---|
| Stockage total | 2 Go | 5 Go | 15 Go |
| Taille par vidéo | 200 Mo | 300 Mo | 500 Mo |
| Imports par jour | 10 | 20 | 40 |

Ce sont des propositions. Les tarifs ne changent pas.

- **Après une baisse de plan** : on ne peut plus rien importer, ce qui existe est conservé, et les accès reçus par d'autres restent valables (D3).
- **Bande passante** : chaque visionnage télécharge le fichier, et le coût est payé par le projet, pas par l'utilisateur. Mesures prévues :
  - URL signées valables 1 h, générées à la demande ;
  - rien n'est chargé avant le clic sur Lecture ;
  - limite de 60 URL de lecture par heure et par personne ;
  - journal léger `video_views` (qui, quelle vidéo, quand) pour repérer les abus.
- **Tarifs** du stockage et du trafic Lovable Cloud : **à vérifier** dans la facturation Cloud. Je ne les invente pas.

## F. Possibilités techniques de Lovable Cloud

| Élément | État |
|---|---|
| Bucket privé et URL signées | Disponible, déjà utilisé pour `payment-proofs` |
| Envoi reprenable (TUS) | Prévu par le stockage Cloud (morceaux de 6 Mo) ; à tester dans ce projet avant de s'y engager |
| Limite par fichier d'un bucket | Réglable par bucket ; plafonnée par la limite globale du projet (réglable jusqu'à 5 Go). La valeur actuelle est **à vérifier** |
| Filtre par type de fichier | Disponible au niveau du bucket |
| Transcodage ou streaming adaptatif | Non disponible ; rien d'externe en V1 |
| Durée | Lue par le navigateur ; une limite de 60 min est proposée, contrôlée sur la valeur déclarée et plafonnée par la taille |

Formats acceptés : MP4 (H.264/AAC) recommandé, MOV et WebM. Un avertissement s'affiche pour HEVC, qui ne se lit pas sur certains Android.

## G. Parcours mobile

1. **Académie → Ma vidéothèque** : liste des vidéos, quota utilisé et bouton « Ajouter ». Ce bouton ouvre la galerie (`accept="video/*"`), puis :
   - aperçu ;
   - titre, description et catégorie ;
   - barre de progression avec Pause et Reprendre ;
   - en cas d'échec, « Réessayer » ;
   - à tout moment : modifier les infos ou archiver.
2. **Mes formations** : créer une formation, ajouter des modules (titre de regroupement), puis des leçons, chacune liée à une vidéo de la vidéothèque. On publie, ce qui crée une version.
3. **Partager** :
   - « Avec mon équipe » envoie une invitation à chaque membre actif ;
   - « À un membre » se fait par choix dans la liste ;
   - une case « peut repartager » est proposée par personne ;
   - on peut voir les destinataires et leur statut.
4. **Le destinataire** voit une notification dans l'Académie : « Formation reçue de X ». Il choisit Accepter ou Refuser.
5. **Formations reçues** : liste durable avec le nom de l'auteur et un badge « version figée » si besoin. La lecture se fait dans le lecteur intégré, avec la progression propre à chaque personne qui regarde.
6. **Le leader** voit, dans « Former mon équipe », les leçons terminées par chaque destinataire (agrégat seulement).

## H. Tests d'acceptation

- Un compte Gratuit ne peut pas importer (`PLAN_PAYANT_REQUIS`) ; un compte Pro peut.
- Le quota ou la taille dépassés donnent `LIMITE_STOCKAGE`.
- Un autre utilisateur ne peut ni lister, ni signer, ni télécharger une vidéo, même avec le chemin exact.
- Une invitation non acceptée ne donne aucune URL de lecture.
- **D3, changement de plan** : le leader repasse en Gratuit et le membre lit toujours la formation.
- **D3, départ** : le leader dissout son équipe, ou le membre quitte l'équipe ou est révoqué. Le membre garde quand même l'accès à ses formations reçues.
- **D3, nouvelle équipe** : le membre rejoint une autre équipe et garde ses anciennes formations. Son nouveau leader ne les voit pas.
- **D2** :
  - un membre sans `can_reshare` ne peut pas partager ;
  - un membre avec ce droit peut partager à ses membres directs ;
  - le destinataire de niveau 2 ne peut pas repartager ;
  - un partage à un non-membre est refusé.
- Les limites de 200 destinataires et 50 partages par jour sont appliquées.
- **Archivage** : une vidéo archivée reste lisible pour ceux qui ont une version la contenant, et le fichier n'est pas supprimé.
- **Mode figé** : le propriétaire publie une v2 ; le destinataire en `figee` voit la v1, celui en `suivre` voit la v2.
- **Modération** : après un retrait, l'accès est coupé pour tous et le fichier est supprimé.
- **Compte supprimé** : l'accès est conservé en version figée.
- La progression est enregistrée sous le `user_id` de la personne qui regarde ; le propriétaire ne voit que l'agrégat.
- Un membre ne peut ni modifier ni supprimer un cours, une leçon ou une vidéo reçus.
- Le catalogue admin YouTube fonctionne comme avant.
- **Mobile 360 px** : import depuis la galerie, coupure réseau puis reprise, lecture, pas de défilement horizontal.

## I. Étapes et estimation (indicative, en crédits Lovable)

1. Vérifier la limite globale de stockage et faire un test d'envoi TUS : 2 à 3.
2. Migrations : `user_videos`, ajouts aux cours et leçons, `course_versions`, `course_grants`, `video_views`, triggers de quotas et de partage, fonctions `grant_*`, bucket et politiques, puis tests SQL des refus : 10 à 14.
3. Fonctions serveur : URL d'envoi, URL de lecture signée après contrôle de l'autorisation, archivage, modération, adaptation de `record_lesson_progress` : 6 à 8.
4. Vidéothèque et envoi reprenable : 6 à 9.
5. Éditeur de formations, modules, leçons et versions : 6 à 9.
6. Partage, invitations, formations reçues et lecteur de fichier : 7 à 10.
7. Agrégat leader, modération admin, tests unitaires et vérification mobile : 5 à 7.

Total : environ **42 à 60 crédits**. La fourchette dépend des allers-retours, et je n'ai pas de grille officielle.

## Points qui nécessitent encore votre accord

1. **Quotas** : les valeurs du tableau E.
2. **Repartage** : faut-il qu'un membre ayant `can_reshare` dirige lui-même une équipe Business, ou peut-il partager à n'importe quel membre de l'équipe de son leader ?
3. **Changement d'équipe** : le droit de repartager est-il conservé ou retiré quand le membre change d'équipe ? Proposé : retiré, l'accès en lecture étant conservé.
4. **Révocation volontaire par le propriétaire** : interdite après acceptation (accès permanent strict), ou permise seulement dans les 7 jours suivant le partage ?
5. **Mises à jour** : le mode par défaut est-il `suivre` ? Et faut-il passer en `figee` automatiquement quand le propriétaire perd le plan Business ?
6. **Suppression de compte** : conserver les copies 12 mois pour les destinataires, avec mise à jour des conditions d'utilisation.
7. **Coût du stockage conservé** : imputer au propriétaire les vidéos archivées mais encore référencées ?
8. **Acceptation** : une invitation explicite (proposée), ou un accès immédiat ?
