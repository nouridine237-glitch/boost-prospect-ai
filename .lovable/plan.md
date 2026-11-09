# Vidéos personnelles et formation d'équipe — V1 (audit et plan)

## A. État réel actuel (vérifié dans le code et la base)

- **Académie vidéo** : tables `academy_courses` et `academy_lessons`. Seul un admin peut écrire (RLS `has_role admin`), et les connectés lisent les contenus publiés. Une leçon accepte seulement YouTube : `video_provider IN ('youtube')` et `video_id` sur 11 caractères. Le contenu ne s'organise qu'en cours puis leçons, sans module. L'accès par plan passe par `min_plan` et `canAccessCourse`.
- **Côté serveur** : `academy-video.functions.ts` contient `listVideoCourses`, `getVideoCourse`, `adminSaveCourse` et `adminSaveLesson`. L'écran d'administration est `admin-academy.tsx`.
- **Lecteur** : `video-player.tsx` gère YouTube sans cookies, envoie un battement toutes les 15 s, et propose une validation manuelle si l'API YouTube est bloquée.
- **Progression** : `academy_lesson_progress` (propriétaire en lecture seule) est écrite uniquement par `record_lesson_progress`, qui crédite le temps de visionnage selon l'horloge du serveur. Elle est déjà liée à `user_id`, donc à la personne qui regarde.
- **Équipe** : `team_links` relie un leader à ses membres (invitation, puis membre actif, puis départ ou révocation). Chaque membre n'a qu'un seul leader actif. Tout passe par les fonctions `team_*`, et l'invitation se fait via `/rejoindre/$code`. Pour l'instant, le leader ne voit que des agrégats de quiz (`team_member_progress`). Les pages et écrans concernés sont `former-equipe.tsx` et `team-partners.tsx`.
- **Équipe et plans** : il faut être Business ou admin pour diriger une équipe (`_can_lead`, `FEATURE_MIN_PLAN.teamTraining = business`). Être membre ne demande aucun plan.
- **Stockage** : un seul bucket existe, `payment-proofs`, privé, avec un dossier par utilisateur. L'ancien bucket des photos de capture a été retiré. Aucun bucket vidéo n'existe.

## B. Disponible et absent

| Disponible | Absent |
|---|---|
| Cours, leçons et publication par l'admin | Contenu créé par un utilisateur |
| Lecteur YouTube avec suivi | Lecteur de fichier vidéo hébergé |
| Progression par personne qui regarde | Module entre cours et leçon |
| Lien leader–membre et invitations | Partage de contenu avec l'équipe |
| Contrôle par plan | Envoi de fichier, quotas de stockage |

## C. Architecture V1 recommandée

- **Médiathèque** : nouvelle table `user_videos` (propriétaire, titre, description, catégorie, chemin de stockage, taille, durée, type, statut `envoi|pret|echec`, date). Une vidéo n'est stockée qu'une fois et peut être réutilisée dans plusieurs leçons.
- **Stockage** : bucket privé `user-videos`, avec le chemin `{owner_id}/{video_id}.{ext}`. L'envoi se fait par morceaux et reprend en cas de coupure (protocole TUS de Lovable Cloud), avec une barre de progression. Aucune URL publique : la lecture passe par une URL signée de 1 h, fournie par une fonction serveur après contrôle d'accès.
- **Formations personnelles** : on réutilise `academy_courses` et `academy_lessons` sans créer de tables en double. On ajoute :
  - `owner_id` (null pour le catalogue officiel) et `audience` (`catalogue|prive|equipe`) sur les cours ;
  - `module_title` (texte, optionnel) et `sort_order` sur les leçons, pour regrouper les leçons par module sans nouvelle table ;
  - `video_provider` étendu à `'fichier'`, et `user_video_id` sur la leçon.
  Les politiques admin restent en place ; on ajoute des politiques propriétaire.
- **Partage** : un cours en `audience = 'equipe'` est visible des membres liés au propriétaire dans `team_links` avec `status = 'actif'`. La vérification passe par une fonction SECURITY DEFINER `can_view_course(course_id)`. Il n'y a pas de partage vidéo par vidéo : on partage une formation, ce qui garde un modèle simple.
- **Lecture** : le lecteur HTML5 natif (`<video>`) et le lecteur YouTube existant partagent la même interface `onReport`. On réutilise donc `record_lesson_progress`, en adaptant les contrôles d'accès à `can_view_course`.
- **Côté navigateur** : vérification du format et de la taille, et lecture de la durée depuis les métadonnées avant l'envoi. Il n'y a pas de transcodage.

## D. Permissions et sécurité

- `user_videos` : seul le propriétaire peut lire et écrire. Les membres ne lisent jamais la table directement.
- `storage.objects` (`user-videos`) : le propriétaire peut ajouter, lire et supprimer dans son propre dossier. Aucune lecture n'est ouverte aux membres : l'URL signée est générée côté serveur avec la clé de service, après `can_view_course`.
- Cours et leçons : seul le propriétaire peut les modifier. Les membres les lisent s'ils sont publiés et partagés avec l'équipe. Un membre ne modifie et ne supprime jamais rien.
- La progression reste `user_id = auth.uid()`. Le leader ne voit qu'un agrégat (leçons terminées par membre), via une nouvelle fonction du même type que `team_member_progress`.
- Si un membre quitte l'équipe ou est révoqué, il perd l'accès aux vidéos immédiatement, et l'URL déjà signée expire dans l'heure.
- Suppression d'une vidéo : refusée si une leçon publiée l'utilise. Sinon, le fichier puis la ligne sont supprimés par une fonction serveur.
- Quotas (taille, nombre, total par plan) vérifiés par un trigger en base, comme pour les limites existantes.

## E. Coûts, limites et risques

- **Formats** : MP4 (H.264/AAC) recommandé, MOV et WebM acceptés. Les vidéos HEVC des iPhone peuvent ne pas se lire sur certains Android ; on affichera une alerte, sans conversion.
- **Taille proposée** : 200 Mo par vidéo (environ 10 à 15 min en 720p). Il faudra peut-être relever la limite globale de stockage.
- **Quotas proposés** : Pro 2 Go, Expert 5 Go, Business 10 Go. Les quotas de stockage sont nouveaux, les tarifs ne changent pas.
- **Coût** : le stockage et la bande passante sont facturés par Lovable Cloud selon l'usage. La bande passante est le risque principal, car chaque visionnage télécharge le fichier : 20 membres pour une vidéo de 100 Mo, c'est 2 Go. Je n'ai pas vérifié de tarif précis : à confirmer dans la facturation Cloud.
- **Pas de streaming adaptatif** en V1. La lecture progressive d'un MP4 fonctionne, mais charge beaucoup sur une connexion mobile faible. Un service de streaming (Mux, Cloudflare Stream) n'est ajouté qu'après chiffrage et votre accord.
- **Autres risques** : contenu illicite ou protégé (case « je détiens les droits » et signalement par l'admin) ; envoi interrompu (statut `envoi` nettoyé après 24 h).

## F. Parcours mobile

1. Académie, puis « Mes vidéos », puis « Ajouter une vidéo » : le sélecteur de fichier ouvre la galerie Android (`accept="video/*"`).
2. Aperçu local, durée et taille affichées, et refus immédiat si le format ou la taille ne conviennent pas.
3. Saisie du titre, de la description et de la catégorie, puis « Envoyer » : barre de progression, pause et reprise, et en cas d'échec un bouton « Réessayer ».
4. « Mes formations », puis « Nouvelle formation » : on ajoute des modules et des leçons et on choisit une vidéo de la médiathèque.
5. On règle la visibilité : Privée ou Mon équipe (Business), puis on publie.
6. Le membre ouvre Académie, puis « Formations de mon leader », regarde la vidéo, et sa progression est enregistrée.
7. Le leader voit dans « Former mon équipe » les leçons terminées par membre.

## G. Tests d'acceptation et cas limites

- Un fichier de plus de 200 Mo, ou dans un mauvais format, est refusé dans le navigateur et en base.
- Un quota de plan dépassé renvoie `LIMITE_STOCKAGE`.
- Un utilisateur B ne peut ni lister, ni signer, ni télécharger une vidéo de A, même avec le chemin exact.
- Un membre actif lit une formation partagée avec l'équipe, mais pas une formation privée.
- Un membre ayant quitté l'équipe ou été révoqué se voit refuser une nouvelle URL.
- Un membre ne peut pas modifier ni supprimer un cours, une leçon ou une vidéo.
- La progression d'un membre est enregistrée sous son `user_id`, et le leader ne voit que l'agrégat.
- La suppression d'une vidéo utilisée dans une leçon publiée est refusée.
- Une coupure réseau en cours d'envoi permet de reprendre ; si l'envoi est abandonné, il passe en `echec` et est nettoyé.
- Le catalogue admin YouTube fonctionne toujours, sans régression.
- Un leader Business repassé en Gratuit : ses membres perdent l'accès (si décision 2 = oui), et ses fichiers sont conservés en lecture pour lui.
- Vérification mobile à 360 px : envoi depuis la galerie, lecture, pas de défilement horizontal.

## H. Étapes et estimation

1. Migration : `user_videos`, colonnes sur les cours et les leçons, `can_view_course`, quotas, bucket et politiques. Ensuite, tests SQL des refus.
2. Fonctions serveur : envoi (URL d'envoi signée), URL de lecture signée, suppression, adaptation de `record_lesson_progress`.
3. Médiathèque et envoi avec reprise.
4. Éditeur de formations, modules et leçons.
5. Lecteur de fichier et vue membre.
6. Agrégat leader, tests et vérification mobile.

Estimation indicative : 25 à 45 crédits Lovable, selon les ajustements. Je n'ai pas de grille exacte ; la fourchette dépend du nombre d'allers-retours.

## Décisions à valider

1. **Qui peut partager avec son équipe ?** Proposé : seulement un leader Business (règle d'équipe actuelle), et seulement avec ses membres directs. Pas de transmission en cascade, pas de partage à un utilisateur hors équipe.
2. **L'accès des membres dépend-il du plan du leader ?** Proposé : oui. Si le leader n'est plus Business, ses membres perdent l'accès ; le membre n'a besoin d'aucun plan.
3. **Qui peut envoyer des vidéos ?** Proposé : à partir du plan Pro, pour un usage personnel ; le plan Gratuit en est exclu.
4. **Taille et quotas** : 200 Mo par vidéo ; 2, 5 et 10 Go selon le plan.
5. **Droits de modification délégués aux membres** : non en V1, lecture seule.
6. **Modules** : un simple titre de regroupement sur la leçon, sans écran de gestion dédié. Est-ce suffisant ?
7. **Streaming payant** : pas de service externe en V1.
