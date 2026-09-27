# Boost Prospect AI

Crée une application web "MLM Boost AI" — un SaaS d'aide à la prospection 

pour les networkers MLM (assistant IA + gestion de prospects).



DESIGN SYSTEM :

- Palette : bleu électrique comme couleur d'accent, sur fond sombre (dark mode)

- Typographie : Inter

- Cartes avec coins arrondis, ombres subtiles, bon contraste sur fond sombre

- Boutons avec états hover clairs



PAGE 1 — LANDING PAGE (page publique) :

- Navigation : logo "MLM Boost AI", liens (Fonctionnalités, Tarifs, Connexion), 

  bouton CTA "Essayer gratuitement"

- Hero section : titre accrocheur positionnant l'app comme un outil de 

  productivité et de prospection (PAS comme une machine à revenus garantis), 

  sous-titre, CTA principal

- 4 cartes fonctionnalités : Assistant IA conversationnel, Générateur de 

  contenu (messages/scripts/posts), CRM de suivi des prospects, Statistiques 

  de performance

- Section tarifs : 4 plans côte à côte — Gratuit / Pro (mis en avant, 

  badge "Populaire") / Expert / Business — avec liste de fonctionnalités par plan

- Footer : liens utiles + mention obligatoire "Aucun revenu garanti — outil 

  d'aide à la prospection"



PAGE 2 — CONNEXION :

- Panneau gauche : branding/image, panneau droit : formulaire email/mot de 

  passe, lien "Créer un compte", lien mot de passe oublié



PAGE 3 — DASHBOARD (après connexion) :

- Sidebar de navigation (desktop) : Dashboard, Prospects, Assistant IA, 

  Statistiques, Académie, Abonnement, Paramètres

- Header : nom utilisateur, avatar

- 4 cartes statistiques en haut : Prospects actifs, Messages générés, 

  Clients ce mois, Taux de conversion

- Liste des prospects (repeating cards) : nom, téléphone, badge de statut 

  coloré (Nouveau, Contacté, Discussion, Intéressé, Client, Non intéressé), 

  bouton d'action pour changer le statut

- Panneau Assistant IA : 4 modes sélectionnables (Message de prospection, 

  Réponse à un prospect, Script d'appel, Post réseau social), zone de 

  saisie du contexte, bouton "Générer"



BASE DE DONNÉES :

Connecte Supabase avec ces tables (déjà existantes à relier, pas à recréer) :

- prospects (id, user_id, name, phone, status, notes, social_network)

- ai_generations (id, user_id, generated_content)



Responsive mobile avec navigation en bottom bar sur mobile.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b870d54-e993-41ad-8245-aaa7069390b2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
