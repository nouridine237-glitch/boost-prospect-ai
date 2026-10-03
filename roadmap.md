# Roadmap

- [x] Étape 1 : structure de données définitive (enums, relance, niveau d'intérêt, prospect_id, RLS stricte)
- [x] Étape 2 : dashboard branché sur les vraies tables
- [x] Étape 3 : notes éditables + date de relance affichée sur chaque carte prospect
- [x] Abandon de la connexion au projet Supabase externe
- [x] Abonnement & paiement
  - [x] 1. Base de données : table `subscriptions` liée à `auth.users` avec RLS
  - [x] 2. Logique d'accès par plan (limites prospects / générations IA)
  - [x] 3. Page d'abonnement (4 plans, style existant, instructions de paiement manuel)
  - [~] 4. Intégration CinetPay différée : activation manuelle par l'administrateur via la base de données
- [x] Panel Admin (/admin) : rôle admin (table user_roles + has_role), display_name, liste utilisateurs, gestion plan/statut, résumé revenus
- [x] Paiement manuel : demandes + preuves, validation admin, bandeau dashboard
- [x] Grille tarifaire landing/abonnement alignée (FCFA/USD, limites réelles)
- [x] Suivi crédits IA admin (table ai_usage_log, barre, alertes 80/95%, limite éditable)
- [ ] BUG: redirection post-connexion/inscription vers landing au lieu de /dashboard — reproduire et corriger
- [ ] Notification e-mail admin (bloqué: domaine d'envoi non configuré)
- [ ] Tests navigateur du flux paiement manuel (crédits workspace)
