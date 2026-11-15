# Refonte de la page d'accueil MLM Boost AI — audit et proposition (aucune modification)

Audit fait en lecture seule du code actuel (page d'accueil, pages de l'application, fichier des forfaits, règles en base). Rien n'a été modifié. La campagne publicitaire est mise de côté.

## 1. Fonctionnalités vérifiées et forfaits

Forfaits (source unique dans le code) : Gratuit 0 FCFA · Pro 5 000 FCFA (~8 $) · Expert 12 000 FCFA (~20 $) · Business 25 000 FCFA (~41 $).

| Fonction | Disponible | Forfait |
|---|---|---|
| Assistant IA : message de prospection, réponse à un prospect, script d'appel, post réseau social, message d'accueil/encouragement (5 modes) | Oui | Tous. Quota : 5 / 100 / 500 / 500 générations par mois |
| Prospects (fiche, historique, étapes, pipeline) | Oui | Gratuit 10 max, payant illimité |
| File « À relancer aujourd'hui » et dates de relance | Oui | Code : tous ; carte tarifaire : affichée sous Pro (à clarifier) |
| Envoi WhatsApp assisté (l'app ouvre WhatsApp, l'utilisateur envoie) | Oui | Tous |
| Import / export CSV | Oui | Pro+ |
| Scripts (12 modèles), objections, trames vocales | Oui | Tous (personnalisation IA sur le quota) |
| Modèles par entreprise (Longrich) | Oui | Pro+ |
| Simulateur de conversation (prospect virtuel IA) | Oui | Tous, consomme le quota |
| Coach du jour : 3/5/8 missions, priorités, séries, bilan de semaine, conseil IA au clic | Oui | Tous |
| Centre de commande (brief du jour, sans IA) | Oui | Tous |
| Objectifs hebdomadaires | Oui | Tous |
| Planificateur de statuts | Oui | Gratuit 7 / semaine, payant 60 / semaine |
| Suivi des campagnes (attribution manuelle) | Oui | Gratuit 1 campagne active ; comparaison et filtres : Expert |
| Statistiques avancées | Oui | Expert+ |
| Plan d'action 30 jours | Oui | Pro+ |
| Académie : 6 niveaux, quiz, cours vidéo, coach IA par leçon | Oui | Gratuit niveaux 1-2, Pro+ complet |
| Parcours de duplication 7 jours + kits | Oui | Pro+ (aperçu verrouillé en Gratuit) |
| Vidéothèque : import de vidéos, création de formations | Oui | Pro+ (2 / 5 / 15 Go) |
| Partage de formations à l'équipe | Oui | Partage initial : Business. Repartage : membre autorisé, un seul niveau |
| Former mon équipe : lien public, 6 niveaux sans compte, quiz 80 %, certificat | Oui | Business |
| Mon équipe (recrues, notes, prochaines actions) | Oui | Tous |
| Ma page (page de capture publique) et parrainage | Oui | Tous |
| Rapports hebdomadaires | À venir | Expert (badge « Bientôt ») |
| WhatsApp Business | À venir | Business (badge « Bientôt ») |
| Support prioritaire | Rien dans le code | Business — engagement humain à confirmer |

## 2. Écarts et promesses à corriger

1. « Assistant IA à 4 modes » sur la page actuelle : le code en propose 5.
2. Pilier A « relances » : aucun mode IA « relance » dédié. Dire « messages de relance rédigés avec l'assistant » plutôt qu'un mode spécifique, et ne jamais parler de relances automatiques.
3. Règle enregistrée sur les forfaits en contradiction avec le code : elle mentionne Expert « illimité », « relances automatiques » en Pro, CSV en Expert, modèles par entreprise en Business. Le code (et l'affichage actuel) dit 500 générations, CSV et modèles dès Pro. La page suivra le code ; la note sera corrigée après votre accord.
4. FAQ paiement : elle dit « paiement manuel uniquement », alors que l'abonnement propose aussi un paiement en ligne (SasPay). À confirmer avant de l'annoncer.
5. « Support prioritaire » (Business) : promesse de service, sans support dans l'outil. À confirmer.
6. « Relances du jour » : la carte tarifaire la place dans Pro, alors que l'écran existe pour tous. Choisir l'une des deux versions.
7. « Duplique » : rester précis. La duplication = parcours 7 jours, kits, formations partagées et lien de formation. Pas de copie automatique d'équipe ni de suivi de l'activité des membres au-delà de la progression à l'Académie.
8. « Construis » : verbe vague. À relier à « ton suivi, ta page, ta routine », jamais à « ton revenu » ou « ton équipe en X jours ».
9. Aperçus actuels : faux téléphones avec des contacts d'exemple (indiqués comme illustratifs). Les remplacer par de vraies captures prises sur un compte de démonstration, avec uniquement des contacts fictifs.
10. Adresse principale : le partage et la balise canonique pointent vers l'ancienne adresse lovable.app au lieu de www.mlmboostai.app.
11. La règle enregistrée impose le titre actuel (« Organise ta prospection MLM… »). Le nouveau titre la remplace seulement après votre validation.

## 3. Architecture proposée

1. **Barre du haut** (fixe, compacte) : logo · Plateforme · Forfaits · FAQ · Connexion · bouton « Commencer gratuitement ».
2. **Accroche** — Titre : « Construis. Prospecte. Forme. Duplique. » Sous-titre : « Ton activité MLM, pilotée depuis un seul espace. » Texte : « Messages avec l'IA, suivi des prospects, coach du jour, académie et formations d'équipe. Tu gardes la main sur chaque envoi. » Boutons : « Commencer gratuitement » + « Découvrir la plateforme ». Mention : « Gratuit pour démarrer · Sans carte bancaire ». Visuel : vraie capture du tableau de bord dans un cadre téléphone, halo bleu discret.
3. **Engagements** (pas de chiffres) : Aucun message envoyé à ta place · Tes prospects restent privés · Paiement Mobile Money · Aucun revenu garanti.
4. **Ça te parle ?** (garder les 3 problèmes actuels, textes resserrés).
5. **Ta journée avec MLM Boost AI** (parcours en 4 étapes) : Ajoute tes prospects → Écris ton message avec l'IA → Envoie toi-même sur WhatsApp → Le coach te dit qui relancer demain.
6. **Les 4 piliers** (une carte chacun, avec un repère de forfait honnête) :
   - A. *Écris sans partir de zéro* : 5 modes d'assistant, scripts, objections, trames vocales, simulateur. « Dès le Gratuit, 5 générations / mois. »
   - B. *Ne perds plus un prospect* : fiche, historique, étapes, À relancer, campagnes. « Gratuit : 10 prospects. »
   - C. *Apprends et transmets* : Académie 6 niveaux, parcours 7 jours, vidéothèque. « Niveaux 1-2 en Gratuit, le reste dès Pro. »
   - D. *Vois où tu en es* : tableau de bord, objectifs, coach du jour, plan 30 jours, statistiques. « Plan 30 jours dès Pro, statistiques avancées en Expert. »
7. **Coach du jour** : « Chaque matin, tes priorités. » 3, 5 ou 8 missions choisies selon tes relances en retard et l'intérêt de tes prospects, jours de repos, séries, bilan de semaine, conseil IA si tu le demandes. Capture réelle du coach.
8. **Forme ton équipe** : « Partage ce que tu sais, sans perdre la main. » Lien de formation avec quiz et certificat (Business), tes propres formations vidéo (dès Pro), partage aux membres de ton équipe (Business) avec un seul niveau de repartage, et accès conservé une fois accepté. Mention : « Pas d'accès aux prospects de tes membres. »
9. **À l'intérieur** : 3 à 4 vraies captures (À relancer, fiche prospect, assistant, académie), légende « Compte de démonstration ».
10. **Ce que l'outil ne fait pas** : pas d'envoi automatique, pas de promesse de gains, pas de liste de contacts achetée, pas d'accès aux données de ton équipe.
11. **Fondateur** (garder : Nouridine, Nkongsamba, outil jeune ; vraie photo si fournie).
12. **Forfaits** : 4 cartes tirées du fichier des forfaits, Pro « Populaire », badges « Bientôt » conservés, bouton « Comparer les forfaits » qui déplie un tableau détaillé. Boutons « Commencer gratuitement » / « Choisir Pro »…
13. **FAQ** : gratuit ? · débutant ? · quelles entreprises MLM ? · que se passe-t-il à la limite du forfait ? · envoi automatique ? · garantie de revenus ? · données privées ? · comment payer ? · partage avec mon équipe ?
14. **Appel final** : « Prends 10 minutes pour organiser ta prospection. » + « Commencer gratuitement » et « Découvrir les forfaits ».
15. **Pied de page** : liens, Facebook, e-mail, bouton WhatsApp, mention obligatoire sur une seule ligne.

Boutons : « Commencer gratuitement » (principal, répété 4 fois et en barre mobile), « Découvrir la plateforme » (va aux piliers), « Découvrir les forfaits » (va aux tarifs). Aucune fenêtre surgissante.

## 4. Améliorations prioritaires (mobile d'abord)

1. Vraies captures en WebP légères (2 tailles), chargées seulement à l'approche.
2. Accroche visible sans défiler sur un Android de 360 px : titre sur 2 lignes maximum, bouton principal au-dessus de la ligne de flottaison.
3. Cartes piliers en carrousel horizontal sur téléphone, grille sur ordinateur.
4. Repères de forfait en petites pastilles cohérentes (Gratuit / Pro / Expert / Business / Bientôt).
5. Tableau comparatif replié par défaut sur téléphone.
6. Boutons d'au moins 48 px, texte à 16 px minimum, contraste vérifié sur fond noir.
7. Animations légères : apparition au défilement, désactivées si l'appareil réduit les animations.
8. Barre de bouton fixe sur téléphone (déjà présente) qui ne recouvre pas le bouton WhatsApp.
9. Corriger l'adresse principale pour le partage et la recherche.

## 5. Validations nécessaires avant de commencer

1. Nouveau titre et sous-titre à la place des textes enregistrés actuels.
2. Paiement en ligne SasPay actif en production : peut-on l'annoncer ?
3. « Support prioritaire » Business : réel engagement (délai) ou à retirer ?
4. « Relances du jour » : pour tous ou réservé à Pro sur la carte tarifaire ?
5. Garder la mention « Afrique francophone » dans le sous-texte ?
6. Captures : accord pour créer un compte de démonstration avec des contacts fictifs.
7. Photo du fondateur (ou garder l'initiale « N »).
8. Corriger la note interne sur les forfaits pour qu'elle suive le code.
9. Périmètre : page d'accueil seulement, sans toucher à la connexion, au tableau de bord, aux forfaits ni au paiement.

## Détails techniques

- Fichiers concernés à l'implémentation : `src/routes/index.tsx`, styles `lp-*` dans `src/styles.css`, nouveaux visuels dans `src/assets`. `PLAN_CARD_ITEMS` reste la source des cartes tarifaires ; repères de forfait dérivés de `FEATURE_MIN_PLAN`.
- `LandingPhone` (faux écrans) retiré ou conservé uniquement en secours si les captures ne sont pas prêtes.
- Canonical et og:url vers https://www.mlmboostai.app.
- roadmap.md : tâche « Refonte page d'accueil » ajoutée au démarrage de l'implémentation (mode plan en cours).
- Vérification : captures à 360 et 1280 px, poids des images, aucun texte de forfait différent de `plans.ts`.
