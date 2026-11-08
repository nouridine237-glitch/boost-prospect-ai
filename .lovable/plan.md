# Audit et prochaine étape : Planificateur de statuts V1

Audit seulement. Aucun fichier, table, migration, réglage ni déploiement n'a été modifié ou publié.

## 1. Où en est chaque fonctionnalité

| Fonctionnalité de la vision | État | Ce qui existe déjà |
|---|---|---|
| Coach quotidien (missions, séries, bilan de la semaine) | Fait | Coach V1 à V3 : `coach.ts`, `coach-card.tsx`, `coach-week.tsx` |
| Orientation quotidienne | Fait | Centre de commande : brief du jour et routeur de demandes, sans IA |
| Prospection, réponses, scripts d'appel | Fait | Assistant IA avec 4 modes, scripts, objections, trames vocales |
| Entraînement | Fait | Simulateur de conversations |
| CRM et relances | Fait | Prospects, pipeline, relances, historique `prospect_events`, import/export |
| Formation | Fait | Académie (quiz et vidéos), coach par leçon, suivi de progression |
| Leadership et duplication | Fait | Parcours 7 jours, kits, équipe avec agrégats |
| Analyse de performance | Partiel | Statistiques et carte Conversion (Expert/Business), objectifs hebdomadaires. Aucune analyse des contenus |
| Génération de contenus | Partiel | Mode « Post réseau social » de l'Assistant, à la demande. Pas de bibliothèque ni de calendrier |
| Planification de statuts WhatsApp/Facebook | Prévu, pas commencé | Rien dans le code : ni calendrier, ni brouillon, ni rappel. Il existe un composant `ui/calendar.tsx` inutilisé |
| Rappels / notifications | Absent | Aucun push ni e-mail de rappel. Les rappels n'apparaissent que dans l'application (Coach et Centre de commande) |
| Campagnes et suivi de leur performance | Absent | Aucune donnée de publication ni de résultat. `prospects.source` peut servir à une attribution simple plus tard |
| Publication automatique WhatsApp/Facebook | Absent | Aucune intégration officielle. Seulement des liens `wa.me` dans `whatsapp-actions.tsx`, que l'utilisateur ouvre lui-même |
| Stratégie | Partiel | Objectifs proposés par le Coach V3. Pas de plan stratégique |

## 2. Recommandation : le Planificateur de statuts V1

C'est toujours le meilleur prochain chantier, pour trois raisons :
- c'est le seul grand pan de la vision qui n'est pas couvert du tout ;
- il donne enfin un usage régulier au mode « Post » de l'Assistant ;
- il crée les données (contenus prévus et publiés) dont une future analyse de campagnes aura besoin.

Les campagnes et leur performance viendront après : aujourd'hui, aucune donnée ne permettrait de les mesurer.

## 3. Ce que contient la V1

- **Calendrier de la semaine,** lisible sur mobile, avec une liste par jour (lundi à dimanche) et la navigation entre semaines.
- **Brouillons,** chacun avec :
  - un texte de 2 000 caractères maximum ;
  - le réseau : statut WhatsApp, Facebook ou autre ;
  - un objectif : notoriété, produit, témoignage éthique, invitation, éducation ;
  - une date et un moment de la journée (matin, midi ou soir).
- **Fréquence cible :** par exemple 1 statut par jour, enregistrée dans les préférences du profil comme l'objectif d'équipe. Le calendrier signale les jours vides.
- **Génération à la demande :** un bouton « Générer avec l'Assistant » réutilise le mode Post existant et son quota (1 génération par clic). Le texte reste modifiable avant d'être enregistré, et rien n'est généré automatiquement.
- **Bibliothèque :** on peut réutiliser un ancien statut ou un script de la bibliothèque existante pour créer un nouveau brouillon.
- **Publication manuelle :** les boutons « Copier » et « Ouvrir WhatsApp » (lien `wa.me` existant) laissent l'utilisateur publier lui-même. Il marque ensuite le statut « publié », avec la date. Aucune publication automatique.
- **Rappels dans l'application seulement :** le Centre de commande affiche « Statut prévu aujourd'hui » ou « Aucun statut prévu ». Pas de push ni d'e-mail en V1.
- **Hors V1 :** publication automatique, campagnes, mesure des vues ou des clics, rappels push ou e-mail.

## 4. Ce qu'on réutilise et ce qu'il faut créer

**Réutilisé**
- `generateProspectingContent`, mode « Post réseau social », dans `ai.functions.ts` : quota et remboursement déjà gérés.
- `whatsapp-actions.tsx` pour les liens WhatsApp, `scripts.functions.ts` pour la bibliothèque.
- `command-center.ts` : une nouvelle ligne de brief, plus le mot-clé « statut », qui mène aujourd'hui à l'Assistant et mènera au Planificateur.
- `app-shell.tsx` pour le menu, `plan-gate.tsx` pour les restrictions de plan, `ui/calendar.tsx` et `ui/tabs.tsx` pour l'affichage.
- `profiles.preferences` pour la fréquence cible.

**À créer**
- Une table `content_posts`, nécessaire pour retrouver les brouillons sur un autre appareil. Colonnes :
  - `id`, `user_id` ;
  - `channel` (`whatsapp` | `facebook` | `autre`) ;
  - `objective`, `body` (2 000 caractères maximum) ;
  - `planned_on` (date), `slot` (`matin` | `midi` | `soir`) ;
  - `status` (`brouillon` | `prevu` | `publie`), `published_at` ;
  - `created_at`, `updated_at`.
  - Droits d'accès :
    - chaque utilisateur ne lit et ne modifie que ses propres lignes ;
    - le visiteur non connecté n'a aucun accès ;
    - un index sur (`user_id`, `planned_on`) ;
    - une limite de création côté serveur, au maximum 60 statuts par semaine.
- Un module de règles pures `src/lib/content-planner.ts` : semaine, jours vides, fréquence, transitions de statut, limite du plan.
- Ses tests `content-planner.test.ts`, une page `src/routes/_authenticated/planificateur.tsx` et un composant de saisie.

## 5. Plans, quotas et sécurité

- **Gratuit :** planification sur 7 jours, au maximum 7 statuts prévus.
- **Pro et plus :** illimité, avec l'historique et la bibliothèque. La règle passe par `hasFeature` avec une nouvelle fonctionnalité `contentPlanner` à partir de Pro, sans changer aucun tarif.
- **Quota IA :** la génération passe uniquement par la fonction IA existante. Aucun nouveau type de génération.
- **Données privées :** chaque utilisateur ne voit que ses statuts. Le contenu n'est jamais partagé avec le leader.
- **Risques :**
  - textes collés très longs : limite de 2 000 caractères, vérifiée à la saisie et en base ;
  - confusion entre jour et date à cause du fuseau horaire : on stocke une date seule et on calcule le jour sur l'appareil, comme pour les relances ;
  - double clic sur « Générer » : bouton désactivé pendant la génération ;
  - aucune promesse de revenu : on réutilise les consignes déjà présentes dans l'Assistant.

## 6. Critères d'acceptation

1. Un utilisateur crée, modifie, déplace et supprime un brouillon. Il le retrouve après rechargement ou sur un autre appareil.
2. « Générer » consomme exactement 1 génération et ne lance rien sans clic. Le texte reste modifiable avant d'être enregistré.
3. « Copier » et « Ouvrir WhatsApp » n'envoient rien automatiquement. « Marquer publié » enregistre la date.
4. Le Centre de commande affiche le statut prévu aujourd'hui.
5. Un compte Gratuit est bloqué au-delà de 7 statuts prévus et voit l'explication avec le bouton « Voir les plans ».
6. Un autre utilisateur ne peut ni lire ni modifier ces statuts, ce qui est vérifié directement en base.
7. Les tests des règles pures, le typage et la compilation passent.

## 7. Estimation

Environ 3 à 4 crédits Lovable : 1 changement en base, 1 page, 1 module de règles avec ses tests, et l'intégration au Centre de commande. C'est une estimation : le coût réel n'est pas mesuré ici.

Rien n'a été modifié ni publié dans cette étape.
