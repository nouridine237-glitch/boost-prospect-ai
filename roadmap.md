# Roadmap

- [ ] Guide de démarrage : accueil unique, trois étapes Dashboard, masquage par utilisateur et vérification.

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

- [x] Suivi des crédits IA dans le Panel Admin (journal, barre de progression, limite éditable, alertes 80%/95%)
- [x] Bug redirection post-connexion : la page d’accueil renvoie les utilisateurs connectés vers /dashboard (retour Google inclus)
- [x] Correction du typage de l’écran d’erreur racine
- [x] Section « Mes recrues » sur la page Prospects (onglets, cartes, toast, IA, dashboard) — testée Client → recrue → retour
- [ ] Acheter et connecter un nom de domaine (en attente du nom choisi)
