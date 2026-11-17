# Plan technique P0 — Duplication Hub (lien public + 1 leçon gratuite)

Mode plan : rien n'est modifié. Ce document est la seule écriture.

## 1. État des lieux (vérifié dans le code)

| Élément | État réel | Réutilisation |
|---|---|---|
| `academy_courses` (owner_id, status, archived_at) + `academy_lessons` (user_video_id, sort_order, archived_at) | Formations utilisateur existantes | Source du parcours |
| `course_versions` (snapshot `lessons` jsonb immuable) | Créé par `course_publish_version` | Le lien public pointe une version figée, jamais le brouillon |
| `course_grants` + fonctions `grant_*` | Partage individuel, repartage 1 niveau, retrait 7 j | Inchangé. Le lien public ne crée aucun octroi |
| `user_videos` + bucket privé `user-videos` | Lecture via URL signée 1 h (`getLessonPlayUrl`, 60/h, `video_views`) | Même mécanisme, version anonyme dédiée |
| `_video_available()`, modération par leçon | Existant (0031-0034) | Leçon gratuite modérée = indisponible |
| `academy_lesson_progress` + `record_lesson_progress` | Progression serveur pour connectés | Aucune écriture anonyme |
| Pages publiques `/p/$pseudo`, `/rejoindre/$code` | Modèle public existant : client publishable + RPC SECURITY DEFINER allowlistée, hash IP SHA-256, `capture_rate_limits` | Patron à reproduire |
| `/auth` + `oauthReturnPath` | Retour sécurisé après connexion (chemins internes seulement) | Retour au parcours |
| `team_links` (code d'invitation) | Lien leader–membre | Non modifié ; optionnel en P1 |
| `_can_lead()` = Business ou admin | Exigé pour partage initial | Réutilisé pour créer un lien public |

Points à vérifier humainement (non confirmés) :
- La règle « Pro/Expert/Business créent, Business seul publie » : `course_publish_version` vérifie aujourd'hui le propriétaire mais **pas le forfait**. Le partage, lui, exige Business. P0 n'y touche pas ; le lien public exigera Business via `_can_lead`.
- `duplication_progress` concerne le parcours 7 jours statique (catalogue serveur), pas les formations vidéo : non utilisé ici.
- Aucun « profil public approuvé » n'existe pour les formateurs ; `/p/$pseudo` (page de capture) est le seul profil public.

## 2. Parcours utilisateur

```text
Formateur Business ── Mes formations › Formation publiée › « Lien public »
   choisit la leçon gratuite (dans la dernière version) + texte de présentation
   → lien /d/<token> (copier / WhatsApp), révocable, expiration optionnelle
Visiteur ── ouvre /d/<token>
   ├─ lien inconnu/révoqué/expiré → même écran neutre « Lien indisponible »
   ├─ fiche : nom affiché + présentation approuvée, titre, description, sommaire
   │          (titres seuls ; leçons suivantes verrouillées)
   ├─ lecture leçon gratuite (URL signée courte) — pas de progression enregistrée
   └─ « Continuer » → /auth?next=/d/<token>
Après connexion ── retour /d/<token>, version connectée :
   ├─ propriétaire → bouton « Ouvrir dans l'éditeur »
   ├─ octroi actif → bouton « Continuer le parcours » (lecteur existant)
   ├─ octroi en attente → lien vers « Formations reçues »
   └─ aucun droit → « Demande l'accès à <formateur> » + bouton WhatsApp si fourni
      (aucun octroi automatique ; le formateur partage via le flux existant)
```
Message affiché : « Ta lecture anonyme n'est pas enregistrée. »

## 3. Architecture

- Pas d'Edge Function (règle projet) : `createServerFn` publiques dans `src/lib/duplication-hub.functions.ts`, plus fonctions authentifiées (`requireSupabaseAuth`) pour le formateur.
- Résolution publique : serveur → `supabaseAdmin` chargé dans le handler **uniquement** après validation du token, ou mieux RPC SECURITY DEFINER `public_link_resolve(_token_hash)` appelée avec le client publishable, renvoyant une liste fermée de champs.
- Vidéo : `publicLessonPlayUrl(token)` vérifie lien actif + leçon = leçon gratuite + `_video_available`, puis URL signée **10 min**. Jamais d'autre leçon.
- Route publique top-level `src/routes/d.$token.tsx` (SSR, `noindex`, head unique sans image privée).

## 4. Modèle de données

Existant : inchangé (aucune colonne ajoutée aux tables Academy/Vidéothèque).

Nouveau (1 migration additive) :
- `duplication_public_links` : id, owner_id, course_id, version_id (figée), free_lesson_id (doit exister dans le snapshot), token_hash (SHA-256, unique), intro text ≤ 400, show_whatsapp bool, status `actif|revoque`, expires_at null, created_at, revoked_at. Index unique : 1 lien actif par formation.
- `duplication_public_events` : link_id, day date, kind (`vue|lecture_debut|lecture_fin|inscription_debut|inscription_fin`), count int ; PK (link_id, day, kind). Agrégé, aucune IP ni identifiant.
- Réutilisation `capture_rate_limits` (hash IP, préfixe `dup:`) pour la limitation.

Fonctions SECURITY DEFINER : `public_link_create(course, lesson, intro, whatsapp, expires)` (propriétaire + `_can_lead` + version publiée + vidéo dispo ; renvoie token clair une seule fois), `public_link_revoke(id)`, `public_link_resolve(hash)`, `public_link_event(hash, kind, ip_hash)`.

## 5. Fichiers

Créer :
- `drizzle/migrations/0035_duplication_public_links.sql`
- `src/lib/duplication-hub.ts` (règles pures : génération/hash token, état du lien, vue selon droits) + `duplication-hub.test.ts`
- `src/lib/duplication-hub.functions.ts`
- `src/routes/d.$token.tsx`
- `src/components/videotheque/public-link-panel.tsx`, `public-course-view.tsx`
- `scripts/test-public-links.sql` (bloc DO annulé)

Modifier :
- `src/routes/_authenticated/academie_.mes-formations_.$id.tsx` (ajout du panneau)
- `src/routes/auth.tsx` : rien si `next` couvre déjà `/d/...` (à confirmer en test)
- `AGENTS.md` (1 règle), `roadmap.md`
- `src/integrations/supabase/types.ts` (régénéré)

Non touchés : `grant_*`, `lessonAccess`, `getCourseReader`, modération, plans, landing.

## 6. Sécurité

- Token : 32 octets aléatoires (base64url, 43 car.) ; seul le hash est stocké ; affiché une fois, « Régénérer » = révoquer + nouveau.
- Anti-énumération : réponse identique et même code pour inconnu/révoqué/expiré/formation archivée/vidéo modérée.
- Limites : 30 résolutions et 10 URL vidéo / heure / IP ; événements 1 par type et session navigateur.
- RLS : nouvelles tables sans GRANT anon ; owner SELECT sur ses liens et stats ; écritures uniquement via fonctions. Aucune ouverture des tables existantes.
- Réponse allowlistée : nom affiché, intro, titre/description de version, titres + durées du sommaire, id de la leçon gratuite. Jamais : notes, transcript, owner_id, chemins de stockage, prospects, équipe.
- Révocation instantanée ; archivage de la formation, modération de la vidéo ou republication sans la leçon → lien indisponible.
- Analytics : compteurs seulement, pas de cookie ; pas de bandeau requis (à confirmer juridiquement).

## 7. Tests

Automatisés : token/hash, états du lien, vue selon droits (propriétaire/octroi/sans droit), allowlist de la réponse (clés exactes).
En base (annulé) : création refusée hors Business, sur brouillon, leçon hors version, vidéo indisponible ; résolution après révocation/expiration/archivage/modération = indisponible ; aucune autre leçon jouable ; anon sans accès direct aux tables ; limites horaires ; `course_grants` inchangé.
Manuel Android 360 px + desktop 1280 px : ouverture WhatsApp, lecture, verrou, inscription e-mail et Google, retour au lien, 4 vues selon droits.
Non-régression : partage/repartage, reçues, lecteur, modération, 155 tests existants.

## 8. Risques et ordre

Risques : coût de bande passante vidéo anonyme (alerte existante uniquement, conforme décision) ; partage massif du lien ; retour après e-mail de confirmation (le `next` doit survivre) ; règle de publication non appliquée au forfait.
Ordre : migration + test SQL → fonctions serveur + tests → panneau formateur → page publique → retour connexion → stats → vérifs mobile/desktop.

## 9. Estimation

Environ 6 à 9 crédits (1 migration, ~8 fichiers, tests base et navigateur).

## Recommandation

GO sous réserve des validations :
1. Lien public réservé à Business/admin (cohérent avec `_can_lead`) ?
2. Le visiteur connecté sans droit : simple « Demande l'accès » (pas d'octroi automatique) ?
3. Profil public = nom affiché + intro saisie dans le lien (pas de photo en P0) ?
4. Expiration par défaut : aucune, ou 30 jours ?
5. Faut-il appliquer en P0 « Business seul publie » (changement de règle actuelle) ? Proposition : non, P1.
6. Analytics sans consentement acceptables (compteurs anonymes) ?

## Hors périmètre

Marketplace, commissions, affiliation, coach IA avancé, kits automatiques, gamification, certificats, messagerie, live, traduction, refonte globale, publication.
