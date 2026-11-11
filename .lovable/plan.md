# Plan de correction : partage vidéo MLM V1

Ce plan découle de l'audit en lecture seule du 11 nov. 2026. Rien n'est encore modifié.

**Règles qui ne changent pas :** import à partir de Pro, quotas de stockage, un seul niveau de repartage, accès permanent après acceptation, version reçue conservée, seule la modération rend une leçon indisponible, et seul un admin peut retirer une formation entière.

## Décisions validées
1. **Repartage :** tout membre autorisé par le propriétaire peut repartager, quel que soit son plan. Conditions :
   - il a un accès actif avec le droit de repartager ;
   - il est toujours membre actif de l'équipe du propriétaire ;
   - il partage seulement à son équipe directe ou à l'équipe directe du propriétaire.

   Les destinataires du 2e niveau ne repartagent jamais. Seul le partage initial par le propriétaire exige Business ou admin.
2. **Délai de retrait :** les 7 jours partent de l'**acceptation**. Une invitation en attente reste retirable à tout moment. Au-delà de 7 jours après l'acceptation, l'accès est définitif, sauf modération.

**Constat en base :** aucun accès partagé n'existe aujourd'hui (table `course_grants` vide). Il n'y a donc aucun ancien accès sans date d'acceptation à reprendre.

## Ordre de livraison
1. P1-B : délai de retrait basé sur l'acceptation (petit, environ 1 crédit, une migration)
2. P1-A : partage impossible si une vidéo est indisponible (moyen, 2 crédits, une migration)
3. P1-C : alignement des règles de repartage, avec tests (petit, environ 1 crédit, sans migration)
4. P2 : réduction des droits, états d'écran, modération par leçon, tests en base (moyen, 4 à 5 crédits, deux migrations)

Chaque étape : tests, build propre, vérification à 360 px et 1280 px. Rien n'est publié.

---

## P1-B : délai de 7 jours à partir de l'acceptation

**Fichiers concernés**
- Nouvelle migration `0030_grant_revoke_accepted_at.sql`, qui remplace `grant_revoke` par `CREATE OR REPLACE` en gardant la même signature et les mêmes droits.
- `canRevoke` dans `src/lib/videotheque.ts`.
- Les deux appels à `canRevoke` dans l'écran de partage et la liste des accès.
- `listSharedGrants` (ou la lecture des accès côté propriétaire) : ajouter `accepted_at` aux champs lus.

**Comportement actuel :** délai calculé depuis le partage (`created_at`).

**Comportement cible (base, seule source de vérité)**
- **Invitation en attente :** retirable à tout moment.
- **Accès actif :** retirable si `now() < COALESCE(accepted_at, created_at) + interval '7 days'`.
  - Comparaison stricte : à exactement 7 jours, l'accès est définitif.
  - Les dates sont en `timestamptz`, calculées par l'horloge du serveur. Le fuseau du téléphone ne compte pas.
- **Ancien accès actif sans date d'acceptation :** on se rabat sur la date du partage. Aucun cas n'existe aujourd'hui, mais c'est sûr pour l'avenir.
- `grant_respond` remplit déjà `accepted_at = now()` à l'acceptation : aucun changement.
- **Retrait d'un repartage :** même règle, selon la date d'acceptation par le destinataire de 2e niveau.

**Côté écran :** `canRevoke({ status, accepted_at, created_at })` reprend la même formule, uniquement pour afficher ou masquer le bouton. La base reste juge.

**Compatibilité :** même nom de fonction, mêmes paramètres, mêmes valeurs de retour (`revoque`, `acces_definitif`…).

**Tests**
- Automatiques (`videotheque.test.ts`) :
  - invitation en attente, même ancienne : retirable ;
  - accepté il y a 6 j 23 h : retirable ;
  - accepté il y a exactement 7 jours : non retirable ;
  - partagé il y a 10 jours mais accepté il y a 2 jours : retirable ;
  - accès actif sans date d'acceptation : on utilise la date du partage.
- En base, dans un bloc annulé après coup : les mêmes cas, en réglant `created_at` et `accepted_at` à la main.
- **[MANUEL]** Partager, accepter le lendemain, vérifier que le bouton « Retirer » reste présent jusqu'à acceptation + 7 jours.

**Acceptation :** la base et l'écran donnent le même résultat dans tous les cas ci-dessus.

## P1-A : aucun partage d'une version avec une vidéo indisponible

**Fichiers concernés**
- Migration `0031_share_requires_available_videos.sql` : `grant_share` et `course_publish_version`.
- `videoReferences` et `archiveVideo` dans `videotheque-access.server.ts` et `videotheque.functions.ts`.
- Message d'erreur dans `vtError`.

**Comportement actuel :** `grant_share` partage la dernière version sans revérifier ses vidéos. Une vidéo absente de toute leçon et de tout accès peut être supprimée, alors que la dernière version la contient encore.

**Comportement cible**
1. **Contrôle au partage (`grant_share`) :** avant toute création d'accès, vérifier que chaque vidéo de la version à partager existe, est « Prête », n'est ni supprimée ni modérée. Sinon, refus `VERSION_INCOMPLETE`.
   - Ça vaut pour le propriétaire (dernière version) comme pour le repartage (version reçue).
   - Une vidéo **archivée** reste acceptée : son fichier est conservé.
2. **Protection des vidéos de la dernière version :** `videoReferences` compte aussi les vidéos de la **dernière version publiée** de chaque formation non archivée.
   - Effet : `archiveVideo` archive seulement et ne supprime plus le fichier.
   - La suppression réelle reste possible quand la formation est archivée, ou republiée sans cette vidéo, et qu'aucun accès n'y renvoie.
3. **Publication (`course_publish_version`) :** elle exige déjà « Prête », non modérée et non supprimée. On ajoute la vérification que le fichier existe dans le stockage (`storage.objects`, même chemin). Sinon, la leçon est exclue de la version, comme aujourd'hui pour une vidéo non prête.
4. **Fichier réellement présent au partage :** la base ne voit pas l'état réel du stockage. Le serveur (`shareCourse`) vérifie donc, avant d'appeler `grant_share`, que chaque fichier de la version existe (`list` sur le dossier du propriétaire). Sinon : refus et message clair.

**Écran :** message « Une vidéo de cette formation n'est plus disponible. Republie la formation avant de la partager. »

**Compatibilité :** les accès existants ne sont pas touchés ; le contrôle ne s'applique qu'aux nouveaux partages.

**Tests**
- En base, dans un bloc annulé : partage refusé si une vidéo de la version est supprimée ou modérée, accepté si elle est seulement archivée. Le repartage d'une version incomplète est refusé.
- Automatique : `videoReferences` compte la dernière version publiée (fonction pure extraite si nécessaire).
- **[MANUEL]** Publier, retirer la leçon sans republier, archiver la vidéo : elle est archivée, pas supprimée. Le partage fonctionne encore. Archiver ensuite la formation et vérifier que la vidéo devient supprimable.

**Risque :** le contrôle du stockage ajoute environ 1 appel par partage. C'est négligeable.

## P1-C : repartage sans condition de plan (alignement)

**Constat :** `grant_share` et `shareTargets` suivent déjà la règle décidée : aucune condition de plan pour le membre, Business ou admin seulement pour le propriétaire.

**Travail**
- **Aucun changement de règle.**
- Commentaire explicite dans `grant_share` (dans la migration P1-A) et dans `shareTargets` : « le membre autorisé n'a pas de condition de plan ».
- Ajout à `AGENTS.md`.
- `shareTargets` pour le propriétaire : renvoyer `mode: "upgrade"` si `_can_lead` est faux. L'écran affiche alors « Le partage initial demande le plan Business », au lieu de lister les membres puis de refuser. Cela recoupe le P2-UI.
- La fenêtre de partage n'affiche jamais l'option « Autoriser à repartager » en mode repartage. C'est déjà le cas : à garder et à tester.

**Tests en base**
- Membre Gratuit autorisé et dans l'équipe du propriétaire : peut repartager à son équipe et à celle du propriétaire.
- Le même membre sans droit de repartage : refus.
- Le même membre sorti de l'équipe : refus.
- Destinataire hors des deux équipes : refus.
- Accès de 2e niveau : toujours sans droit de repartager, `grant_set_reshare` sur cet accès renvoie « introuvable », et une tentative de repartage par ce destinataire est refusée.

**[MANUEL]** Avec 3 comptes (A Business, B Gratuit membre de A, C membre de A) : A autorise B, B repartage à C, C ne voit pas l'option « Partager ».

## P2 : sécurité, écrans, modération, tests

**P2-1 Droits d'exécution** (migration `0032_tighten_grants.sql`)
- `feature_plan` : `REVOKE EXECUTE ... FROM PUBLIC, anon`, puis donner l'exécution à `authenticated` et `service_role`.
  - Avant, vérifier qu'aucune page publique (accueil, page de capture) ne l'appelle sans connexion : recherche dans le code.
  - Les fonctions qui l'utilisent sont en `SECURITY DEFINER` et continuent de marcher, car elles s'exécutent avec les droits de leur propriétaire.
- `_can_lead` : retirer l'exécution à `authenticated`. Elle n'est appelée qu'à l'intérieur d'autres fonctions `SECURITY DEFINER`. Aucun appel direct ne doit exister dans le code : à vérifier par recherche avant.
- `has_role` : à garder pour `authenticated`, car les règles d'accès s'en servent et en ont besoin.
  - Option : ajouter `is_admin()` sans paramètre, qui ne parle que de l'utilisateur connecté, pour les appels depuis l'app.
  - Ne pas retirer `has_role` tout de suite : sinon les règles d'accès cassent.

**P2-2 Droits sur les tables** (même migration)
- Retirer à `anon` tous les droits sur : `course_grants`, `course_versions`, `user_videos`, `video_views`, `academy_courses`, `academy_lessons`.
- `authenticated` : garder seulement `SELECT` sur `course_grants`, `course_versions` et `video_views` (pour cette dernière, aucune règle d'accès : elle reste fermée). Garder `SELECT`, `INSERT`, `UPDATE` sur `user_videos`, `academy_courses` et `academy_lessons`. Retirer partout `DELETE`, `TRUNCATE`, `REFERENCES` et `TRIGGER`.
- `service_role` : `ALL`, inchangé.
- Avant la migration : rechercher dans le code tout `.delete()` ou écriture directe sur ces tables.
- Les catalogues publics d'Académie utilisés par la page d'accueil : à vérifier, et garder `SELECT` pour `anon` si une page publique les lit.

**P2-3 Écrans**
- « Reçues » :
  - `listReceived` lit aussi `retire_moderation` ;
  - carte grisée « Retirée par la modération » sans bouton de lecture ;
  - fermeture possible avec « Masquer », mémorisé dans l'appareil seulement ; aucune donnée nouvelle.
- Propriétaire sous Business : voir P1-C (mode « upgrade » dans la fenêtre de partage).

**P2-4 Modération limitée à la leçon (option B, décision finale)**

Règle : une vidéo supprimée, modérée ou indisponible rend seulement **sa leçon** indisponible. Les autres leçons et la formation restent accessibles. Retirer toute une formation est une action admin explicite et distincte.

- **Base de données** (migration `0033_moderation_lesson_scope.sql`)
  - `moderate_video(_video_id, _reason)` : même signature. Elle marque la vidéo (`moderated_at`, `deleted_at`, motif) et clôt les signalements. Elle **ne touche plus** `course_grants`.
  - Nouvelle fonction `moderate_course(_course_id uuid, _reason text)` :
    - réservée aux admins, motif obligatoire (5 caractères minimum) ;
    - passe en `retire_moderation` tous les accès en attente ou actifs de cette formation ;
    - archive la formation ;
    - exécution réservée à `authenticated`, avec un contrôle `has_role` admin à l'intérieur.
  - Aucune modification des versions publiées : elles restent immuables et gardent la référence à la vidéo. Celle-ci n'est simplement plus servie.
- **Contrôles d'accès**
  - `lessonAccess` refuse déjà une vidéo modérée ou supprimée : aucun lien temporaire n'est émis pour cette leçon. À garder et à tester.
  - `getCourseReader` marque déjà `available: false` seulement sur ces leçons. À garder et à tester.
  - Ajout : `getLessonPlayUrl` revérifie que le fichier existe avant d'émettre le lien. Fichier absent = leçon indisponible, sans erreur générale.
- **Versions et partage**
  - La règle P1-A s'applique toujours : un **nouveau** partage d'une version contenant une vidéo indisponible est refusé (`VERSION_INCOMPLETE`).
  - Les accès déjà acceptés restent actifs. Seule la leçon concernée est grisée.
  - Le propriétaire est invité à republier sans cette vidéo. Les destinataires peuvent alors mettre à jour leur version, s'ils le veulent.
- **Progression** : la leçon indisponible est exclue du total affiché (`courseProgress` calculé sur les leçons disponibles). Aucune progression enregistrée n'est effacée.
- **Écran membre (lecteur et « Reçues »)**
  - Leçon grisée : « Cette vidéo n'est plus disponible », sans détail privé.
  - Le reste du sommaire est inchangé.
  - Formation retirée par un admin : carte « Retirée par la modération », sans lecture (voir P2-3).
- **Écran propriétaire** : badge « 1 leçon indisponible » sur la formation, et bouton « Republier sans cette vidéo » vers l'éditeur.
- **Écran admin (`admin-video-reports`)**
  - Deux actions distinctes, avec confirmation :
    - « Retirer la vidéo » : leçon seulement, action par défaut ;
    - « Retirer toute la formation » : motif obligatoire et avertissement « coupe l'accès de N personnes ».
  - L'action « formation » n'est proposée que si la vidéo appartient à une formation partagée.
- **Tests**
  - En base, dans un bloc annulé :
    - après `moderate_video`, les accès restent `actif` et `lessonAccess` refuse la seule leçon concernée ;
    - après `moderate_course`, tous les accès passent en `retire_moderation` ;
    - un non-admin reçoit `ADMIN_REQUIS` ;
    - un nouveau partage de la version concernée est refusé.
  - Automatique : progression calculée sans la leçon indisponible.
  - **[MANUEL]**
    1. Partager à B une formation de 3 leçons.
    2. Un admin modère la vidéo 2 : B lit les leçons 1 et 3, la 2 est grisée.
    3. Le propriétaire republie, puis B met à jour sa version : la leçon 2 disparaît.
    4. Un admin retire la formation entière : B la voit « Retirée ».
- **Coût** : moyen, environ 2 crédits, dans le lot P2.

**P2-5 Tests en base enregistrés dans le projet**
- Nouveau fichier `src/lib/videotheque.sql-scenarios.md`, ou script `scripts/test-sharing.sql`, exécuté dans un bloc DO entièrement annulé. Scénarios :
  - `grant_share` : propriétaire non Business, destinataire hors équipe, limites 50 par jour et 200 au total, version incomplète ;
  - `grant_revoke` : en attente, accepté depuis moins de 7 jours, à exactement 7 jours, plus de 7 jours ; par la personne qui a partagé ; par un tiers ;
  - `grant_set_reshare` : propriétaire contre accès de 2e niveau ;
  - version immuable : `UPDATE` ou `DELETE` sur `course_versions` refusés pour `authenticated` ;
  - accès durable : propriétaire passé en Gratuit, lien d'équipe terminé, formation archivée, puis `lessonAccess` doit toujours accepter.
- Les tests automatiques de l'app restent dans `bun:test`.

## Tests manuels globaux (Android et ordinateur)
Avec 3 comptes (A Business, B membre Gratuit de A, C membre de A ou de B) :
1. Partage par A, puis repartage par B, sans option de repartage chez C.
2. Retrait selon l'acceptation : B accepte 2 jours après le partage, A peut retirer jusqu'à acceptation + 7 jours.
3. A passe en Pro, B quitte l'équipe, A archive la formation : la lecture continue pour B et C.
4. Vidéo modérée : seule sa leçon est grisée. Le retrait de la formation entière passe seulement par l'action admin dédiée.
5. Lecture et reprise sur Android (360 px) et sur ordinateur (1280 px).

## Risques de régression
- P2-1 et P2-2 : appels directs oubliés. Ils seront recherchés dans le code avant la migration, et la migration ne fera que retirer des droits.
- P1-A : un partage pourrait être refusé alors qu'il fonctionnait avant. C'est voulu, et le message est clair.
- P1-B : aucun accès existant concerné.

## À valider avant de commencer
1. L'ordre P1-B, puis P1-A, puis P1-C, puis P2.
2. Modération : option B retenue (leçon seule ; retrait d'une formation entière = action admin distincte).
3. La suite des tâches sera reportée dans `roadmap.md` une fois le plan validé : en mode plan, seul ce document peut être modifié.
