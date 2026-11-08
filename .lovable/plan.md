# Audit comparatif — vision « assistant IA central » (aucune modification)

## 1. Matrice des capacités (constaté dans le code)

| Capacité cible | État | Preuves dans le dépôt |
|---|---|---|
| Coach quotidien | Implémenté et testé | `src/lib/coach.ts` (missions, priorités, séries, bilan semaine, objectifs proposés), `coach-card.tsx`, `coach-week.tsx`, tests `coach.test.ts` ; réglages dans `profiles.preferences.coach` |
| Prospection (rédaction) | Implémenté | `/assistant`, `AiAssistantPanel` (crm.tsx), `generateProspectingContent` avec 5 modes, quota atomique `reserve_ai_generation` + remboursement ; scripts (`/scripts`), trames vocales, page de capture `/p/$pseudo` |
| Vente / closing | Partiel | Gestionnaire d'objections (`objections.ts`, `/objections`), mode « Réponse à un prospect », `suggestNextAction` ; pas de parcours de closing guidé par étape du pipeline |
| Marketing | Partiel | Mode « Post réseau social » seulement ; pas de calendrier ni planificateur de statuts |
| CRM | Implémenté | `/prospects`, pipeline, relances, import/export CSV, `prospect_events`, outils MCP (create/update/followups) |
| Leadership / duplication | Partiel | `team_links`, `team_member_progress()` agrégé, `/duplication` (7 jours + kits Pro) ; pas de coach leader (phase 4 du plan Académie) |
| Formation | Implémenté | Académie 6 niveaux + quiz serveur + certificat, Académie vidéo, coach IA par leçon, suivi de progression des leçons |
| Analyse de performance | Partiel | `/statistiques`, `conversion.ts` + carte Expert/Business ; pas d'interprétation proactive reliée aux actions |
| Organisation | Partiel | Objectifs hebdo, relances, jours de repos du Coach ; « Planificateur de statuts » absent |
| Stratégie | Absent | Aucun module de plan stratégique mensuel |
| Assistant central qui coordonne | Absent | Chaque capacité est une page/carte séparée ; le dashboard empile les cartes sans point d'entrée unique ni orientation vers la bonne capacité |

Roadmap : « Planificateur de statuts » ouvert (non implémenté) ; « Phase 2 duplication » encore non cochée alors que le code (migration 0018, `/duplication`) existe — à cocher, incohérence documentaire seulement.

## 2. Recommandation unique : « Demandez à votre assistant » + brief du jour

Une seule zone en haut du dashboard, qui devient la porte d'entrée de l'app :

- **Brief du jour (sans IA)** : 3 lignes maximum composées à partir des calculs existants — mission prioritaire du Coach, prospect inactif ≥7 jours (`conversion.ts`), leçon à reprendre (`resumeLesson`) ou jour de duplication en cours. Chaque ligne a un bouton qui ouvre l'outil existant.
- **Champ « Que voulez-vous faire ? »** : l'utilisateur écrit sa demande (ex. « mon prospect dit que c'est une pyramide »). Un orienteur local, sans IA et sans quota, détecte l'intention et propose 1 à 3 actions vers les outils existants, pré-remplies : objection correspondante (réutilise `matchObjectionId`), Assistant IA avec `?context=` et mode suggéré, script, leçon, statistiques, duplication, fiche prospect.
- **Rien ne s'envoie et aucune génération n'est consommée** : la génération IA ne part que si l'utilisateur clique « Générer » dans l'Assistant existant (même quota). Aucun message WhatsApp n'est envoyé automatiquement.
- Respect des plans : les actions vers des fonctions verrouillées (stats avancées, kits) affichent le cadenas et le lien Abonnement, comme aujourd'hui.

Pourquoi ce choix : transforme l'usage quotidien en « un seul endroit où demander », sans nouvelle table, sans nouvelle IA, et sans dupliquer Coach, CRM, Assistant, objections ni Académie.

## 3. Détails techniques

Fichiers :
- Nouveau `src/lib/assistant-router.ts` : fonctions pures `detectIntent(text)` (mots-clés FR normalisés sans accents → `objection|redaction|relance|post|formation|equipe|stats|prospect`) et `buildDailyBrief(inputs)`.
- Nouveau `src/lib/assistant-router.test.ts` (bun:test) : une intention par règle, priorité objection > rédaction, brief limité à 3, actions verrouillées selon le plan.
- Nouveau `src/components/central-assistant.tsx` : carte brief + champ + suggestions (liens TanStack `Link` avec `search`).
- Modifié `src/routes/_authenticated/dashboard.tsx` : monter la carte au-dessus de `CoachCard`.
- Éventuel : `src/routes/_authenticated/assistant.tsx` accepte `mode` en recherche (validé Zod) pour présélectionner le mode.
- `roadmap.md` (ajout + cocher Phase 2), `AGENTS.md` (règle : l'orienteur est local et ne déclenche ni IA ni envoi).

Dépendances : données déjà chargées par `useCrm`, `readCoachSettings`, `buildDailyMissions`, `conversion.ts`, requêtes de progression Académie/duplication déjà propriétaire-scopées ; `hasFeature`. Aucune migration, aucune policy RLS, aucune fonction serveur nouvelle.

Risques :
- Détection par mots-clés imparfaite → toujours afficher une action de repli « Ouvrir l'Assistant IA avec ce texte ».
- Surcharge du dashboard → la carte remplace visuellement l'en-tête, brief plafonné à 3 lignes.
- Requêtes supplémentaires (progression Académie) → réutiliser les query options existantes, chargement non bloquant.
- Texte saisi transmis en URL → limité à 2 000 caractères (règle déjà en place sur `/assistant`).

Critères d'acceptation :
- Le dashboard affiche un brief de 1 à 3 actions issues des données de l'utilisateur seulement.
- « c'est une pyramide » propose la fiche objection correspondante ; « écris un post » ouvre l'Assistant en mode Post avec le texte pré-rempli.
- Aucune génération IA n'est comptée tant que l'utilisateur n'a pas cliqué « Générer ».
- Un utilisateur Gratuit voit les actions réservées verrouillées, sans contenu payant.
- Tests du module pur verts, typecheck et build OK.

Estimation : 2 à 3 crédits Lovable (module pur + tests, une carte, une modification du dashboard).
