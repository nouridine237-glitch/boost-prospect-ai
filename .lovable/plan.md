# Audit Vidéothèque MLM V1 — lecture seule (11 nov. 2026)

Aucune modification faite. Sources lues : `src/lib/videotheque*.ts`, `src/components/videotheque/upload.ts`, `upload-sheet.tsx`, `file-player.tsx`, migrations 0028/0029, politiques RLS en base, buckets, lignes `user_videos` du compte admin.

Légende : [CODE] confirmé par le code · [AUTO] confirmé par un test automatisé · [MANUEL] à tester manuellement · [PROBLÈME] problème identifié

## 1. Import / téléversement
- [CODE] Formats : mp4/m4v, mov, webm (`ACCEPTED_TYPES`, `checkVideoFile`). Deux sélecteurs : « Galerie » (`accept=video/*…`) et « Fichiers » (extensions).
- [AUTO] Limites par plan 200/300/500 Mo et 2/5/15 Go, Gratuit refusé, durée 1–3600 s (`videotheque.test.ts`).
- [CODE] Bucket `user-videos` : privé, limite 500 Mo par fichier, aucun filtre de type au niveau du bucket.
- [CODE] Progression, débit, temps restant (`upload-sheet.tsx`, testés en unitaire pour les calculs).
- [CODE] `finalizeVideoUpload` vérifie existence, taille <= déclarée, type ; sinon `echec` + suppression du fichier.
- [PROBLÈME mineur] La taille réelle doit seulement être inférieure ou égale à la taille déclarée, pas égale : un fichier tronqué serait accepté comme « prêt ».
- [MANUEL] Android Chrome (Galerie + Fichiers), iPhone Safari, ordinateur (glisser-déposer).

## 2. Vidéo « 119807 »
Il existe deux lignes avec ce titre (compte admin) :
- `a4f0bcbe…` (9 nov. 16:53) : archivée le 10 nov. 06:11, puis passée en `echec` le 11 nov. 04:45 par le nettoyage automatique (`listMyVideos` bascule en `echec` les envois restés en `envoi` plus de 24 h et supprime les fichiers). Fichier et miniature absents. Elle ne compte plus dans l'espace utilisé.
- `c98d5b1e…` (10 nov. 06:09) : `pret`, 2 Mo, 18 s, fichier et miniature présents.
- Constat : la vidéo signalée comme bloquée n'est plus bloquée ; c'était un envoi interrompu, nettoyé comme prévu. Aucune erreur enregistrée (l'app ne garde pas le motif d'échec).
- [PROBLÈME mineur] Le nettoyage ne s'exécute qu'à l'ouverture de « Ma vidéothèque » ; aucun motif d'échec n'est conservé.

## 3. Reprise après coupure (TUS)
- [CODE] tus-js-client, morceaux de 6 Mo, réessais 0/3/5/10/20 s, Pause/Reprendre, `findPreviousUploads` + empreinte en stockage local.
- [MANUEL] Coupure réseau réelle pendant l'envoi : jamais testée.
- [PROBLÈME probable] Après rechargement : une nouvelle ligne est créée avec un nouveau chemin, mais l'empreinte TUS ne dépend que du fichier ; la reprise peut repartir vers l'ancien chemin. Le fichier tombe alors au mauvais endroit et la nouvelle ligne finit en `echec`. À confirmer à la main.
- [PROBLÈME probable] Le jeton de session est lu une seule fois au début ; un envoi lent de plus d'1 h (jeton expiré) échouerait aux réessais.

## 4. Formations, modules, leçons
- [CODE] Création, modules, ordre, retrait, publication en version figée (`course_publish_version`), leçon refusée si vidéo non prête/autre propriétaire (`owner_lesson_guard`).
- [MANUEL déjà fait le 10 nov.] 2 modules, 3 leçons, publication, lecture (360 et 1280 px).
- [CODE] Publier sans leçon valide renvoie `AUCUNE_LECON`.

## 5. Partage équipe
- [CODE] `grant_share` : propriétaire Business/admin vers ses membres actifs ; repartage 1 niveau, seulement si `can_reshare` et encore membre du propriétaire ; 50/jour, 200/formation.
- [CODE + test SQL annulé du 9 nov.] Accès conservé après passage du leader en Gratuit et après départ du membre ; perte du droit de repartager ; retrait refusé après 7 jours ; version reçue conservée ; modération coupe l'accès.
- [MANUEL] Fenêtre de partage et invitation vues par un vrai membre : impossible sans second compte dans l'équipe.
- Note : le changement de rôle admin n'est pas un critère d'accès (aucune dépendance) — [CODE].

## 6. Formations reçues, lecture, progression
- [CODE] `listReceived`, `respondGrant`, `updateGrantVersion`, lecture via `lessonAccess` (octroi actif + version figée + vidéo non modérée).
- [CODE] Progression par `record_lesson_progress` (crédit par horloge serveur, terminée à 80 %).
- [MANUEL] Reprise à la dernière position côté destinataire ; non vérifié à l'écran.

## 7. Sécurité
- [CODE vérifié en base] Bucket privé ; stockage : ajout seulement dans son dossier et pour une ligne `envoi` déclarée ; lecture seulement de son dossier ; aucune lecture partagée.
- [CODE] Lecture des autres uniquement par lien signé 1 h émis côté serveur, 60/heure.
- [CODE vérifié en base] `user_videos` propriétaire seul ; `course_grants` visible des 3 parties ; `course_versions` propriétaire seul ; `video_views` sans accès navigateur.
- [CODE] Faille « statut prêt » corrigée (migration 0029).
- [PROBLÈME mineur] Le propriétaire peut lire directement ses fichiers sans passer par le compteur de lectures (accepté, car ses propres fichiers).
- [MANUEL] Lancer le scan de sécurité et le linter avant publication.

## 8. Quotas et coûts
- [CODE + AUTO] Quotas dans `user_videos_guard` / `video_quota`. Les envois en cours comptent dans l'espace.
- [PROBLÈME / risque coût] Pas de limite de trafic par destinataire autre que 60 liens/heure ; une formation partagée à 200 membres peut générer beaucoup de trafic. Tarifs stockage/trafic Lovable Cloud non vérifiés.
- [Risque] Fichiers archivés encore référencés restent stockés et comptés au propriétaire (choix assumé).

## Étapes de test manuel
1. Android Chrome, compte Pro : Académie → Ma vidéothèque → Ajouter → Galerie → vidéo 50–150 Mo ; à 30 %, mode avion 20 s ; rétablir ; attendre « Prête ».
2. Même chose, puis recharger la page à 30 % ; choisir le même fichier ; noter si l'envoi reprend et si la vidéo finit « Prête » ou « Échec » (vérifie le point 3).
3. Ordinateur : glisser-déposer un .mov et un .webm ; un fichier de 210 Mo en Pro doit être refusé.
4. Second compte rejoint l'équipe (lien d'invitation) ; leader partage avec « Peut repartager » ; le membre accepte, regarde 1 min, ferme, rouvre : reprise et progression.
5. Leader passe en Gratuit (admin) : le membre garde l'accès.
6. Vidéo iPhone HEVC lue sur Android.

## Corrections recommandées (à valider, rien n'est fait)
1. Exiger taille réelle = taille déclarée à la finalisation.
2. Inclure l'id de la vidéo dans l'empreinte TUS (ou effacer les anciennes empreintes) pour éviter une reprise vers un mauvais chemin.
3. Rafraîchir le jeton de session avant chaque réessai TUS.
4. Garder un court motif d'échec ; afficher les envois en échec dans la vidéothèque.
5. Évaluer une limite de trafic mensuelle par propriétaire et vérifier les tarifs Cloud.
