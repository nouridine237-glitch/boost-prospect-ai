# Audit en lecture seule : partage vidéo MLM V1

Rien n'a été modifié : aucun fichier, aucune donnée, aucun réglage, rien publié.

**Sources.** Code actuel : `src/lib/videotheque.functions.ts`, `src/lib/videotheque-access.server.ts`, `src/lib/videotheque.ts`, `src/components/videotheque/share-sheet.tsx`, `drizzle/migrations/0028_videotheque.sql`. Base réelle : définitions des fonctions, droits d'exécution (`proacl`), droits sur les tables, `pg_policies`.

**Légende.** [CODE] = lu dans le code. [DB] = vu en base. [TEST] = vérifié par un test présent dans le projet. [MANUEL] = à tester à la main. [RISQUE] = point de risque.

## Tableau des exigences

| # | Exigence | Statut | Preuves |
|---|---|---|---|
| 1 | Import à partir de Pro | Conforme | [DB] `user_videos_guard` : refus `PLAN_PAYANT_REQUIS` si `effective_plan = gratuit`, plus `video_quota` (200/300/500 Mo et 2/5/15 Go). [TEST] `videotheque.test.ts`, bloc « import à partir du plan Pro » (règles côté app seulement, pas le blocage en base). |
| 2a | Partage par le propriétaire réservé à Business ou admin | Conforme | [DB] `grant_share` : `IF NOT _can_lead(u) THEN PLAN_BUSINESS_REQUIS`. `_can_lead` = `feature_plan = business` ou rôle admin. Un essai Pro offert par parrainage ne suffit pas. |
| 2b | Membre autorisé à repartager | Conforme à la règle produit, mais Partiel face au plan technique | [DB] Conditions : le membre a un accès actif avec `can_reshare`, et un lien d'équipe actif avec le propriétaire. **Son plan à lui (`_can_lead(member)`) n'est pas vérifié.** Ça correspond à « les membres autorisés peuvent partager ». Décision à confirmer : un membre Gratuit autorisé peut repartager. |
| 2c | Destinataires d'un repartage | Conforme | [DB] Destinataires possibles : membres directs du membre (`team_links.leader_id = u`) ou membres directs du propriétaire. Le membre et le propriétaire sont exclus. [CODE] `shareTargets` applique la même règle (groupes « Mon équipe » et « Équipe de mon leader »). |
| 3 | Un seul niveau de repartage | Conforme | [DB] Accès créé par un repartage : `can_reshare = _can_reshare AND is_owner`, donc toujours faux. `grant_set_reshare` agit seulement si `grantor_id = owner_id`. Un accès reçu au niveau 2 ne peut donc jamais obtenir le droit de repartager. [CODE] La fenêtre de partage envoie `canReshare: isOwner && reshare`. [TEST] Aucun test automatisé dans le projet. |
| 4 | Accès permanent malgré plan, équipe ou rôle | Conforme | [CODE] `lessonAccess`, `getCourseReader`, `listReceived` et `getLessonPlayUrl` vérifient seulement l'accès actif, la version reçue, et que la vidéo n'est ni modérée ni supprimée. Aucun contrôle du plan, de l'équipe ou du rôle. [DB] Aucune fonction ne modifie les accès quand un plan, un lien d'équipe ou un rôle change. Le lien d'équipe ne compte que pour le droit de repartager à l'avenir. |
| 4b | Accès conservé si la formation ou la vidéo est archivée | Conforme | [CODE] Les vérifications d'accès ignorent `academy_courses.archived_at`. `archiveVideo` garde le fichier tant qu'un accès en attente ou actif renvoie à la vidéo (`videoReferences`). |
| 5 | Retrait limité à 7 jours, invitation en attente retirable | Conforme | [DB] `grant_revoke` : refus `acces_definitif` si l'accès est actif et `created_at < now() - 7 days`. Une invitation en attente reste toujours retirable. Seuls le propriétaire et la personne qui a partagé peuvent retirer. [TEST] `canRevoke` (3 cas, côté app seulement). |
| 5b | Cas limites du retrait | Partiel | [DB] Le délai part de la date du partage (`created_at`), pas de l'acceptation : accepter au 6e jour laisse environ 1 jour pour retirer. Un partage refait après un refus ou un retrait remet `created_at` à zéro, donc le délai repart, ce qui est logique. Au bout de exactement 7 jours, l'app et la base disent toutes deux « définitif » (comparaison stricte des deux côtés). Retirer l'accès d'un membre ne retire pas les repartages qu'il a déjà faits, ce qui va dans le sens de la permanence. Le propriétaire peut aussi retirer un repartage de moins de 7 jours. |
| 6 | Version reçue conservée | Conforme | [DB] `course_grants.version_id` reste fixe ; seul le destinataire le change, via `grant_update_version`. Les versions ne peuvent pas être modifiées ni supprimées (lecture seule pour le propriétaire). |
| 6b | Seule la modération coupe l'accès | Conforme, mais large | [DB] `moderate_video` passe en `retire_moderation` **tous** les accès dont la version contient la vidéo : la formation entière est coupée, pas seulement la leçon. Un accès coupé par la modération ne peut pas être réactivé par un nouveau partage. Seul un admin peut modérer. |

## Sécurité : base, fichiers et liens temporaires

- [DB] `grant_share`, `grant_respond`, `grant_revoke`, `grant_set_reshare`, `grant_update_version`, `course_publish_version`, `moderate_video` et `effective_plan` : exécutables seulement par `authenticated` et `service_role`.
- [DB] Règles d'accès sur `course_grants` : lecture seule, pour le destinataire, la personne qui a partagé et le propriétaire. Aucune écriture directe possible.
- [DB] Règles d'accès sur `course_versions` : lecture par le propriétaire seulement. Les destinataires lisent leur version uniquement via le serveur.
- [DB] `video_views` n'a aucune règle d'accès : la table est fermée, le serveur seul l'utilise.
- [DB] Fichiers (dossier `user-videos`) :
  - lecture seulement dans son propre dossier ;
  - ajout seulement si une vidéo `envoi` correspondante existe ;
  - aucune règle de modification ou de suppression ;
  - les destinataires n'ont aucun accès direct aux fichiers.
- [CODE] Les liens temporaires (1 h) sont créés côté serveur par `getLessonPlayUrl`, seulement si `lessonAccess` accepte, et au plus 60 par heure.
- [CODE] `getOwnVideoUrl` (aperçu par le propriétaire) passe par les règles d'accès de `user_videos`. Une vidéo supprimée ou modérée y est donc invisible.

## Cohérence entre l'écran et le serveur

- `shareTargets` et `grant_share` suivent la même règle pour les destinataires. Écart : `shareTargets` ne vérifie pas `_can_lead` pour le propriétaire. Un propriétaire redescendu sous Business voit encore ses membres, puis reçoit le refus « Business requis » seulement au moment de partager (gêne d'affichage, sans risque).
- `listReceived` affiche seulement les accès en attente et actifs. Un accès coupé par la modération disparaît sans explication.
- `getCourseReader` et `lessonAccess` acceptent la même vidéo (non modérée, non supprimée).

## Risques

**P0 :** aucun trouvé.

**P1**
1. **Version publiée renvoyant à une vidéo supprimée.**
   - Scénario : le propriétaire publie une version, archive la leçon sans republier, puis archive la vidéo. Si aucun accès en attente ou actif ne renvoie à cette version, le fichier est supprimé.
   - Ensuite, `grant_share` partage toujours la dernière version sans revérifier ses vidéos. Le destinataire reçoit une leçon « indisponible ».
   - Fichiers : `grant_share` et `videoReferences` (ce dernier ne compte que les accès, pas les versions partageables plus tard).
   - Recommandation : refuser de partager une version dont une vidéo est supprimée ou modérée, ou bien compter « dernière version publiée » comme une référence dans `videoReferences`.
2. **Décision à confirmer sur le repartage.** Un membre autorisé n'a pas besoin d'être Business (2b). Si le plan technique exigeait Business ou admin, il faut ajouter `_can_lead(u)` dans la partie repartage de `grant_share` et dans `shareTargets`.

**P2**
3. `feature_plan` reste exécutable par `PUBLIC` et `anon`. Comme `auth.uid()` est vide pour un visiteur non connecté, la protection ne joue pas : n'importe qui peut lire le plan d'un utilisateur dont il connaît l'identifiant. Recommandation : retirer le droit d'exécution à `PUBLIC` et `anon`.
4. `_can_lead` et `has_role` sont exécutables par tout utilisateur connecté : on peut savoir si un identifiant donné est admin. Fuite faible, mais à restreindre.
5. Les tables `course_grants`, `course_versions`, `user_videos`, `video_views`, `academy_courses` et `academy_lessons` ont tous les droits pour `anon` et `authenticated` (`arwdDxtm`). Seules les règles d'accès protègent ces tables. Recommandation : réduire ces droits au strict nécessaire, par sécurité supplémentaire.
6. La modération coupe la formation entière (6b). À garder ou à affiner, selon votre choix.
7. Le délai de 7 jours part du partage, pas de l'acceptation (5b) : à confirmer comme voulu.
8. Après une modération, l'accès disparaît de « Reçues » sans message, et l'écran de partage n'indique pas qu'un propriétaire n'est plus Business.
9. `course_publish_version` ne vérifie pas `user_videos.archived_at`. Pas de gros risque : une vidéo archivée garde son fichier et reste lisible.

## Tests

**Présents [TEST] :** règles côté app uniquement (`videotheque.test.ts`) : plans d'import, quotas, `canRevoke`, regroupement par module. **Aucun test présent dans le projet** ne vérifie `grant_*`, les règles d'accès ou les liens temporaires. Les vérifications faites en base pendant la construction ont été annulées après coup et ne sont pas enregistrées.

**À faire à la main [MANUEL] avec 3 comptes (A Business leader, B membre de A, C membre de B ou de A) :**
1. A partage à B avec repartage. B accepte et repartage à C. C accepte, et l'option « Partager » est absente chez C.
2. B tente de partager à quelqu'un hors des deux équipes : refus.
3. A passe en Pro : B et C lisent toujours. A ne peut plus partager. B peut encore repartager tant qu'il est dans l'équipe de A.
4. B quitte l'équipe : B et C lisent toujours, B ne peut plus repartager.
5. A archive la formation : B et C lisent toujours. « Mettre à jour la version » ne propose rien.
6. Retrait par A à moins de 7 jours : OK. Après plus de 7 jours : « accès définitif ». Une invitation en attente reste toujours retirable.
7. A publie la version 2 : C garde la version 1 tant qu'il ne met pas à jour.
8. Un admin modère une vidéo : l'accès à la formation de B et C est coupé.
9. Lecture et reprise de lecture par C sur Android et sur ordinateur.

## Recommandations (rien n'est appliqué)
1. P1-1 : bloquer le partage d'une version incomplète, ou protéger les vidéos de la dernière version publiée.
2. P1-2 : confirmer si un membre autorisé doit être Business pour repartager.
3. P2-3 à 5 : réduire les droits (`feature_plan`, `_can_lead`, `has_role`, tables). Migration additive : uniquement des retraits de droits.
4. P2-6 à 8 : choix produit et petits ajustements d'écran.
5. Ajouter des tests en base enregistrés dans le projet pour `grant_share`, `grant_revoke` et `grant_set_reshare`.
