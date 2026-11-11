# Plan de correction — Vidéothèque MLM V1

Ces règles ne changent pas : import à partir de Pro, quotas 2/5/15 Go et 200/300/500 Mo, repartage sur un seul niveau, accès permanent après acceptation, version reçue conservée, retrait volontaire seulement pendant 7 jours.

## Étapes d'exécution
1. P0-1 Taille exacte (petit, environ 1 crédit)
2. P0-2 Reprise TUS identifiée par la vidéo (moyen, 2 à 3 crédits)
3. P0-3 Rafraîchissement du jeton de session (petit, 1 crédit)
4. P1-4 Motif d'échec et reprise sûre (moyen, 2 à 3 crédits)
5. P2-5 Limite de lecture mensuelle (moyen, 3 crédits ; seuils à valider par vous)

Chaque étape : tests, build propre, vérification à 360 px et 1280 px. Vous validez avant de passer à la suivante si vous le souhaitez.

---

## P0-1 Taille stockée = taille déclarée
- **Fichiers :** `finalizeVideoUpload` dans `src/lib/videotheque.functions.ts`, nouvelle fonction pure `isUploadComplete` dans `src/lib/videotheque.ts`.
- **Actuel :** une vidéo est acceptée si la taille réelle est entre 1 octet et la taille déclarée. Un fichier tronqué peut donc passer en « Prête ».
- **Cible :**
  - taille réelle exactement égale à la taille déclarée, et type cohérent ;
  - sinon : fichier supprimé, statut « Échec », motif `taille_incomplete` (voir P1-4) ;
  - si le fichier est absent juste après la fin de l'envoi, une seule nouvelle vérification 2 s plus tard, puis motif `fichier_absent`.
- **Risque :** certains navigateurs annoncent une taille différente pour le même fichier. L'envoi et la déclaration utilisent la même valeur (`file.size`), donc le risque est faible.
- **Migration :** aucune.
- **Tests :**
  - unitaires : taille égale (acceptée), plus petite, plus grande, zéro (refusées) ;
  - manuel : un envoi normal sur Android et sur ordinateur doit finir « Prête ».
- **Acceptation :** aucune vidéo « Prête » dont la taille diffère de la taille déclarée.

## P0-2 Reprise TUS liée à une seule vidéo
- **Fichiers :** `startResumableUpload` dans `src/components/videotheque/upload.ts`, `upload-sheet.tsx`.
- **Actuel :** l'empreinte de reprise ne dépend que du fichier. Après un rechargement, la reprise peut écrire dans l'ancien chemin, et la nouvelle vidéo échoue.
- **Cible :**
  - l'empreinte inclut l'identifiant de la vidéo et son chemin (option `fingerprint`) ;
  - avant de reprendre un envoi précédent, on vérifie que le chemin enregistré est bien celui de la vidéo en cours. Sinon on ignore cet envoi et on efface son empreinte ;
  - les empreintes des envois échoués ou annulés sont effacées ;
  - « Réessayer » sur une vidéo échouée crée toujours une nouvelle vidéo avec un nouveau chemin. On n'écrit jamais dans l'ancien.
- **Limite connue :** après un rechargement, il faut toujours choisir à nouveau le fichier, et l'envoi repart de zéro sur la nouvelle vidéo. On n'essaie pas de reprendre au milieu, pour rester sûr.
- **Risque :** la reprise pendant que la page reste ouverte (coupure réseau, Pause) ne doit pas régresser. Elle garde la même empreinte, donc elle n'est pas touchée.
- **Migration :** aucune.
- **Tests :**
  - unitaire : une empreinte différente pour deux vidéos avec le même fichier ;
  - manuel Android : mode avion 20 s à 30 %, l'envoi reprend et finit « Prête » ;
  - manuel ordinateur : recharger la page à 30 %, choisir à nouveau le fichier, la nouvelle vidéo finit « Prête » et l'ancienne passe en « Échec » avec un motif ;
  - en base : aucun fichier dans un chemin qui n'est pas celui de sa vidéo.
- **Acceptation :** une reprise ne peut jamais écrire dans le chemin d'une autre vidéo.

## P0-3 Jeton de session à jour
- **Fichiers :** `upload.ts`.
- **Actuel :** le jeton est lu une seule fois au départ. Un envoi qui dure plus d'une heure échoue.
- **Cible :**
  - via `onBeforeRequest` : avant chaque morceau, on lit la session à jour, que le client rafraîchit tout seul ;
  - si la session a disparu : pause, message « Session expirée, reconnecte-toi puis Reprendre », sans marquer la vidéo en échec ;
  - une erreur 401 ou 403 déclenche un rafraîchissement, puis un seul nouvel essai.
- **Risque :** un léger délai par morceau, négligeable avec des morceaux de 6 Mo.
- **Migration :** aucune.
- **Tests :**
  - manuel : pendant un envoi, se déconnecter dans un autre onglet. Le message s'affiche, et après reconnexion « Reprendre » termine l'envoi ;
  - automatisé : choix de l'action selon le code d'erreur (401 → rafraîchir, 413 → refuser, réseau → réessayer).
- **Acceptation :** un envoi long ne casse pas à cause de l'expiration de la session.

## P1-4 Motif d'échec et reprise sûre
- **Migration additive :** colonne `failure_reason text NOT NULL DEFAULT ''` sur `user_videos`.
  - Le guard l'ajoute aux champs protégés : seul le serveur peut l'écrire.
  - Les lignes existantes restent avec un motif vide, affiché « Motif inconnu ».
- **Fichiers :** `finalizeVideoUpload`, `markUploadFailed`, `listMyVideos`, nouvelle fonction `retryFailedVideo`, `videotheque.ts` (libellés des motifs), cartes vidéo et `ui-bits.tsx`.
- **Actuel :**
  - les échecs n'ont pas de motif ;
  - `markUploadFailed` cache la vidéo, car il remplit `deleted_at` ;
  - le nettoyage automatique au-delà de 24 h ne dit rien à l'utilisateur.
- **Cible :**
  - motifs : `taille_incomplete`, `fichier_absent`, `type_invalide`, `annule`, `abandon_24h`, `session_expiree`, `reseau` ;
  - les vidéos en échec restent visibles dans un filtre « Échecs », avec le motif en clair et deux boutons :
    - « Réessayer » : nouvelle vidéo, mêmes infos, choisir à nouveau le fichier ;
    - « Retirer » : masque la vidéo ;
  - `markUploadFailed` ne remplit plus `deleted_at` ;
  - le nettoyage au-delà de 24 h garde la ligne avec le motif `abandon_24h` et supprime seulement le fichier partiel ;
  - une bannière l'explique au prochain passage dans la vidéothèque.
- **Ce qui ne change pas :** les échecs ne comptent pas dans l'espace utilisé.
- **Risque :** la liste s'allonge, d'où le filtre et la limite d'affichage aux 30 derniers jours.
- **Tests :**
  - unitaires : libellés des motifs ;
  - en base, avec tout annulé ensuite : le navigateur ne peut pas modifier `failure_reason` (`CHAMP_PROTEGE`) ;
  - manuel : annuler un envoi, voir « Annulé », Réessayer, puis « Prête ».
- **Acceptation :** aucun échec silencieux ; chaque échec a un motif visible et une action possible.

## P2-5 Maîtrise du trafic de lecture
- **Constat facturation (documentation Lovable) :**
  - le stockage et le trafic réseau sont facturés en crédits Cloud ;
  - chaque espace de travail reçoit 20 crédits Cloud par mois, puis l'usage passe sur le solde général ;
  - aucun prix par Go n'est publié ;
  - **à confirmer par vous :** Paramètres de l'espace de travail → Forfaits et utilisation des crédits → Détails d'usage → Run credits, filtré sur ce projet, une fois quelques Go servis.
- **Estimation de volume :** une formation de 10 vidéos de 50 Mo, vue entièrement par 200 membres, fait environ 100 Go par mois. C'est le scénario à risque.
- **Proposition (seuils à valider) :**
  - compteur mensuel des octets servis par propriétaire, estimé à partir de `video_views` et de la taille de la vidéo à chaque lien signé ;
  - limites mensuelles : Pro 50 Go, Expert 150 Go, Business 500 Go ;
  - alerte au propriétaire à 80 %, avec une jauge dans « Ma vidéothèque » ;
  - au-delà, **les destinataires gardent leur accès**. Les nouvelles lectures sont seulement ralenties : au plus 10 liens par heure et par destinataire au lieu de 60, jusqu'au 1er du mois suivant. Aucun accès n'est jamais retiré ;
  - les lectures du propriétaire sur ses propres vidéos restent illimitées en accès, mais comptent dans le total.
- **Fichiers :**
  - `getLessonPlayUrl` et `getOwnVideoUrl` ;
  - migration additive : colonne `bytes_estimated bigint DEFAULT 0` sur `video_views` et index (owner, mois) ;
  - fonction pure `trafficState` dans `videotheque.ts`.
- **Risque :** l'estimation est haute, car on compte une vidéo entière même si elle n'est vue qu'à moitié. Ça reste prudent.
- **Tests :**
  - unitaires : `trafficState` à 79 %, 80 % et 101 % pour chaque plan ;
  - en base : au-delà de la limite, le destinataire reçoit encore un lien jusqu'à 10 par heure ;
  - manuel : la jauge s'affiche sur ordinateur et sur téléphone.
- **Acceptation :** les coûts restent plafonnés en pratique sans jamais couper l'accès permanent.

## Décisions à valider
1. Démarrer P0-1 à P0-3 maintenant, en un seul lot ?
2. P1-4 : garder les échecs visibles 30 jours ?
3. P2-5 : seuils 50, 150 et 500 Go par mois, et ralentissement à 10 lectures par heure au-delà ? Ou seulement une alerte, sans ralentissement ?
