# Audit — conversion intelligente des prospects

Audit du code seulement : aucun changement. Ce plan propose la suite la moins coûteuse ; rien n'est construit avant ton accord.

## 1. Existant et branché dans l'interface

- **Statuts** : nouveau, contacté, discussion, intéressé, client, non_intéressé (type `prospect_status`). Le changement se fait par `changeStatus` dans `src/components/crm.tsx`, depuis la liste et le pipeline.
- **Historique des contacts** : table `prospect_events` (RLS propriétaire, pas de modification). Elle est écrite par `logProspectEvent` (`src/lib/prospect-events.ts`), avec 7 types : message_envoyé, message_copié, changement_statut, relance_reportée, note_modifiée, mission_faite, mission_passée. L'onglet « Historique » de la fiche (`src/components/prospect-tools.tsx:215`) affiche les 100 derniers événements.
- **Prochaine action par prospect** :
  - Sans IA : le Coach (`src/lib/coach.ts`, `buildDailyMissions` et `priorityScore`) se base sur le retard de relance, l'intérêt, l'ancienneté du dernier contact, le statut et l'objection notée. Il exclut Client et Non intéressé. Les relances du jour viennent de `FollowupQueue`.
  - Avec IA, au clic : `suggestNextAction` (`src/lib/ai.functions.ts:111`) depuis la fiche et le Coach, sous quota.
- **Objections** : champ `main_objection`, réponse du Gestionnaire associée dans le Coach (`matchObjectionId`).
- **Métrique de conversion** : `crm.conversion = clients / total des prospects` (`crm.tsx:65`). Elle est affichée sur Statistiques (« Taux de conversion ») avec la répartition par statut (plan Expert pour la vue avancée).

## 2. Présent mais incomplet (preuves)

- **Taux non fiable** : c'est une photo de l'état actuel. Il ne tient compte ni de la période, ni des étapes, ni des prospects qui reviennent en arrière.
- **Événement de statut en texte libre** : il est enregistré sous la forme « Ancien → Nouveau » avec les libellés affichés (`crm.tsx:101`), sans champ structuré. On peut l'analyser, mais c'est fragile.
- **Changements de statut non tracés** : ceux faits par l'outil MCP `update-prospect` (`src/lib/mcp/tools/update-prospect.ts`) et ceux de l'import CSV n'écrivent aucun événement. Les prospects antérieurs à la table `prospect_events` n'ont pas d'historique non plus.
- **`joined_team_at`** (trigger `set_joined_team_at`) donne la date de passage en Client. Elle est fiable pour le passage « → client », pas pour les étapes intermédiaires.

## 3. Absent

- Entonnoir par étape (contacté → discussion → intéressé → client) avec le taux de chaque étape.
- Conversion sur une période (30 jours, ou par mois de création).
- Délai moyen jusqu'à la conversion.
- Conversion par source et par objection.
- Repérage des prospects « bloqués » trop longtemps à une étape.

## Solution proposée (la moins coûteuse, sans IA ni migration)

1. Ajouter au fichier `src/lib/prospect-events.ts` un petit lecteur qui transforme « A → B » en étapes, à partir des libellés existants.
2. Écrire des fonctions pures dans un nouveau `src/lib/conversion.ts` : entonnoir, conversion sur 30 jours (prospects créés dans la période et devenus clients d'après `joined_team_at`), délai moyen, conversion par source et prospects bloqués depuis plus de 7 jours.
3. Ajouter une carte « Conversion » sur `src/routes/_authenticated/statistiques.tsx`, réservée à la même vue avancée Expert.
4. Faire écrire l'événement changement_statut aussi par l'outil MCP de mise à jour.
5. Écrire des tests unitaires dans `src/lib/conversion.test.ts`.

Estimation : environ 1 à 2 crédits. Aucune nouvelle table, la sécurité existante suffit.

Limite à annoncer dans l'interface : les étapes intermédiaires ne sont fiables que pour les changements faits depuis l'apparition de l'historique.
