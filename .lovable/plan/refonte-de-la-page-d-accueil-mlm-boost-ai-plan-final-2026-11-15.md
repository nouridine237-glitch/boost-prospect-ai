# Refonte de la page d'accueil MLM Boost AI — plan final

Périmètre : la page d'accueil uniquement. Plan rédigé à partir du code actuel, qui reste la source de vérité. Aucun fichier de l'application n'a été modifié.

## 1. Décisions validées

1. Titre : « Construis. Prospecte. Forme. Duplique. »
2. Sous-titre : « Ton activité MLM, pilotée depuis un seul espace. »
3. Paiement : SasPay (en ligne) et Mobile Money, comme sur la page Abonnement. Aucun autre moyen n'est cité.
4. Support prioritaire Business : présenté comme un engagement de service humain, pas comme une fonction de l'app.
5. Suivi des prospects et prochaines relances : présentés comme disponibles sur tous les forfaits. Vérifié dans le code : l'écran « À relancer » n'est réservé à aucun forfait.
6. Cible internationale, avec la priorité à l'Afrique francophone. Les exemples sont pris au Cameroun et en Afrique.
7. Aucune limite à Longrich : les modèles Longrich sont cités comme un exemple de modèle par entreprise.

## 2. Ce qu'on peut montrer, et pour qui

Source : la liste des forfaits et des fonctions réservées dans le code. Prix : Gratuit 0 FCFA · Pro 5 000 FCFA (~8 $) · Expert 12 000 FCFA (~20 $) · Business 25 000 FCFA (~41 $), par mois.

**Disponible pour tous (avec limites)**
- Assistant IA, 5 modes : message de prospection, réponse à un prospect, script d'appel, post réseau social, message d'accueil. Générations par mois : 5 / 100 / 500 / 500.
- Prospects : fiche, historique, étapes, pipeline, prochaines relances, écran « À relancer ». Gratuit : 10 prospects. Payant : illimité.
- WhatsApp assisté : l'app ouvre WhatsApp avec le message prêt, et l'utilisateur l'envoie lui-même. Vérifié dans le code.
- Scripts (12), objections, trames vocales, simulateur de conversation (utilise le quota IA).
- Coach du jour : 3, 5 ou 8 missions, priorités, jours de repos, séries, bilan de semaine, conseil IA à la demande.
- Centre de commande, objectifs de la semaine, Mon équipe, Ma page (page de capture), parrainage.
- Planificateur de statuts : 7 par semaine en Gratuit, 60 en payant.
- Suivi des campagnes : 1 campagne active à la fois en Gratuit.
- Académie : niveaux 1 et 2.

**Réservé à certains forfaits**
- Dès Pro : Académie complète (6 niveaux), import et export CSV, modèles par entreprise, parcours de duplication 7 jours et kits, plan d'action 30 jours, vidéothèque (2 / 5 / 15 Go selon le forfait).
- Dès Expert : statistiques avancées, comparaison des campagnes.
- Business : former son équipe (lien public, quiz, certificat), partager des formations à son équipe (un seul niveau de repartage), support prioritaire (service).

**Bientôt (jamais présenté comme disponible)** : rapports hebdomadaires (Expert), WhatsApp Business (Business).

**Interdit sur la page** : envoi automatique, relances automatiques, faux chiffres, faux avis, logos de partenaires, résultats ou revenus promis.

## 3. Corrections à faire sur la page

1. « Assistant IA à 4 modes » devient « 5 modes ».
2. Carte Pro : retirer « File À relancer aujourd'hui », puisque c'est disponible dès Gratuit. Le changement se fait seulement dans le texte affiché sur la page, sans toucher aux forfaits.
3. FAQ paiement : citer SasPay et Mobile Money, avec l'activation après vérification pour Mobile Money.
4. Remplacer les faux écrans de téléphone par de vraies captures.
5. Adresse de partage : passer de l'ancienne adresse lovable.app à https://www.mlmboostai.app (adresse principale du projet). Correction prévue, pas encore faite.
6. Mettre à jour la règle enregistrée sur la page publique (ancien titre) et celle des forfaits (qui ne correspond plus au code). Cela se fera seulement au moment de l'implémentation.

## 4. Architecture, section par section

1. **Navigation** fixe : logo · Plateforme · Forfaits · FAQ · Connexion · « Commencer gratuitement ». Menu repliable sur téléphone.
2. **Accroche** : titre et sous-titre validés. Texte : « Écris tes messages avec l'IA, suis tes prospects, forme ton équipe. Tu envoies toi-même chaque message. » Boutons : « Commencer gratuitement » (inscription) et « Découvrir la plateforme » (va aux piliers). Mention : « Gratuit pour démarrer · Sans carte bancaire ». Visuel : vraie capture du tableau de bord.
3. **Engagements** : Aucun message envoyé à ta place · Tes prospects restent privés · SasPay et Mobile Money · Aucun revenu garanti.
4. **Ça te parle ?** : les 3 problèmes actuels (oublis, quoi écrire, aucune vision).
5. **Ta journée** en 4 étapes : ajoute un prospect → écris ton message avec l'IA → envoie-le toi-même sur WhatsApp → le coach te rappelle qui relancer.
6. **Les 4 piliers**, avec une pastille de forfait sur chacun :
   - Écris sans partir de zéro (assistant, scripts, objections, trames, simulateur). Pastille « Dès Gratuit ».
   - Ne perds plus un prospect (fiche, étapes, relances, campagnes). Pastille « Dès Gratuit · 10 prospects ».
   - Apprends et transmets (Académie, parcours 7 jours, vidéothèque). Pastilles « Niveaux 1-2 gratuits · Complet dès Pro ».
   - Vois où tu en es (tableau de bord, objectifs, coach, plan 30 jours, statistiques). Pastilles « Plan 30 jours : Pro · Statistiques : Expert ».
7. **Coach du jour** : « Chaque matin, tes priorités. » Missions classées selon les relances en retard et l'intérêt du prospect. Conseil IA seulement si tu le demandes. Capture réelle.
8. **Formation et duplication** : « Transmets ce qui marche, sans perdre la main. » Parcours 7 jours et kits (Pro), tes formations vidéo (Pro), lien de formation avec certificat et partage à ton équipe (Business), un seul niveau de repartage, accès gardé une fois accepté. Phrase : « Tu ne vois pas les prospects de tes membres. »
9. **Captures** : 4 vraies captures (À relancer, fiche prospect, assistant, Académie), légende « Compte de démonstration, contacts fictifs ».
10. **Transparence** : ce que l'outil ne fait pas (pas d'envoi automatique, pas de promesse de gains, pas d'accès aux données de ton équipe), et les fonctions « Bientôt ».
11. **Fondateur** : la section actuelle (Nouridine, Nkongsamba, outil jeune).
12. **Forfaits** : 4 cartes tirées du code, Pro « Populaire », badges « Bientôt » gardés, Business « Support prioritaire (service) ». Un bouton « Comparer les forfaits » déplie un tableau. Boutons et liens actuels conservés.
13. **FAQ** : gratuit ? · débutant ? · toutes les entreprises MLM et tous les pays ? · que se passe-t-il à la limite ? · envoi automatique ? · garantie de revenus ? · données privées ? · comment payer ? · partage avec l'équipe ?
14. **Appel final** : « Prends 10 minutes pour organiser ta prospection. » avec « Commencer gratuitement » et « Découvrir les forfaits » (va aux tarifs).
15. **Pied de page** : liens actuels, Facebook, e-mail, bouton WhatsApp flottant, mention obligatoire sur une ligne.

Destinations des boutons inchangées : inscription, inscription puis Abonnement pour les forfaits payants, Connexion, Formation, WhatsApp, et redirection vers le tableau de bord si l'utilisateur est déjà connecté.

## 5. Visuel et mobile

- Fond noir profond, bleu électrique en accent, police Inter, contraste vérifié.
- Téléphone 360 px d'abord : titre lisible sans défiler, bouton principal visible tout de suite, textes à 16 px, boutons d'au moins 48 px.
- Piliers en carrousel sur téléphone, en grille sur tablette et ordinateur.
- Tableau des forfaits replié sur téléphone.
- Images légères, chargées à l'approche.
- Animations discrètes, coupées si l'appareil demande moins d'animations.
- Barre de bouton fixe sur téléphone, sans masquer le bouton WhatsApp. Aucune fenêtre surgissante.

## 6. Points qui demandent votre vérification

1. Compte de démonstration pour les captures : qui le crée, et avec quelles données fictives.
2. Délai précis du support prioritaire (ex. « réponse sous 24 h ») ou formulation générale.
3. Photo du fondateur, ou garder l'initiale « N ».
4. Exemples camerounais (prénoms, produits) : validation du ton.
5. SasPay : moyens de paiement acceptés à afficher tels quels (cartes, Mobile Money via SasPay ?). À confirmer, pour ne rien inventer.

## 7. Hors périmètre

Aucun autre écran (connexion, inscription, tableau de bord, abonnement, paiement, admin, fonctions internes), aucune logique métier, aucun prix ni quota, aucune modification du serveur ou de la base de données, aucune publication ni mise en ligne.

## 8. Risques et dépendances

- Les captures dépendent du compte de démonstration. Sans lui, la section est reportée plutôt que de garder de faux écrans.
- Textes de forfaits à garder alignés sur le code, pour éviter un nouvel écart.
- Poids des images à surveiller sur les réseaux mobiles.

## 9. Vérifications prévues

- Page vue à 360, 768 et 1280 px. Rien ne déborde.
- Tous les boutons mènent aux mêmes destinations qu'aujourd'hui.
- Prix, quotas et badges identiques au code. Aucune fonction « Bientôt » présentée comme disponible.
- Aucune mention d'envoi automatique ni de promesse de revenus. Mention de bas de page présente.
- Moins d'animations quand l'appareil le demande. Images optimisées.
- Adresse de partage et titre/description propres à la page.

## Détails techniques

- Fichiers prévus : `src/routes/index.tsx`, classes `lp-*` dans `src/styles.css`, captures dans `src/assets`, et éventuellement le retrait de `src/components/landing-phone.tsx`. Cartes tarifaires lues depuis `PLAN_CARD_ITEMS` et `FEATURE_MIN_PLAN`. Le retrait de « À relancer » sur la carte Pro se fera par un filtre sur la page, sans modifier `plans.ts`. À valider : `abonnement.tsx` affiche aussi cette ligne, et ce fichier reste hors périmètre.
- Canonical et og:url vers https://www.mlmboostai.app (rien dans `__root.tsx`).
- roadmap.md : la tâche sera ajoutée au début de l'implémentation, puisque le mode plan n'autorise que ce document.
