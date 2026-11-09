# Vidéothèque MLM V1 — refonte visuelle premium (mobile-first)

Périmètre : affichage uniquement. Le fonctionnement, les données, les droits, les quotas et les décisions déjà validées ne changent pas :
- import à partir du plan Pro ;
- repartage par les membres autorisés, sur un seul niveau ;
- accès durable ;
- retrait possible pendant 7 jours ;
- chacun garde la version reçue.

Point de départ : la V1 est déjà en ligne dans l'aperçu, avec 5 écrans :
- Ma vidéothèque ;
- Mes formations ;
- l'éditeur de formation ;
- Formations reçues ;
- la lecture d'une formation.

Ils ont été vérifiés à 360 px. Ce plan les rend plus soignés, sans rien ajouter côté données.

## 1. Direction visuelle

- On garde le thème existant : fond sombre, Inter, accent bleu électrique, couleur verte de réussite déjà définie. Aucune nouvelle couleur codée en dur ; on ajoute seulement quelques variables de thème si besoin (surface surélevée, bordure douce).
- **Hiérarchie** : un titre court, une phrase d'aide, puis le contenu. Une seule action bleue par écran. Les actions secondaires sont en contour ou sans fond.
- **Surfaces :**
  - cartes arrondies à 16 px, bordure fine semi-transparente et ombre très douce ;
  - au survol ou à la sélection, la bordure s'éclaire en bleu, sans dégradé ;
  - le seul halo autorisé est celui déjà présent sur l'Académie.
- **Typographie** : titres de 22 à 28 px en gras, texte courant de 14 à 15 px, informations secondaires en 12 px atténué. Les durées et tailles en chiffres à largeur fixe, pour qu'ils restent alignés.
- **Icônes** : uniquement lucide, en 16 ou 20 px :
  - Film : vidéo ;
  - Layers : formation ;
  - Inbox : formations reçues ;
  - Share2 : partage ;
  - ShieldCheck : accès durable ;
  - Repeat : repartage.
- **Mouvement** : 150 à 200 ms (apparition par fondu et léger glissement, pression des boutons à 0,98), désactivé si le téléphone est réglé pour réduire les animations.
- **Tactile** : zones d'au moins 44 px, 8 px d'écart entre deux actions, actions principales à portée du pouce en bas d'écran sur mobile.

## 2. Arborescence des écrans

```text
Académie (en-tête + onglets défilants, onglet actif souligné en bleu)
├── Catalogue                          /academie            (inchangé)
├── Ma vidéothèque                     /academie/videos
│   ├── Jauge d'espace + bouton « Ajouter »  (fixé en bas sur mobile)
│   ├── Recherche + puces catégories + filtre « Archivées »
│   ├── Grille de VideoCard
│   ├── Feuille d'ajout (plein écran mobile / dialogue desktop)
│   └── Aperçu vidéo (dialogue) · Modifier · Archiver (confirmation)
├── Mes formations                     /academie/mes-formations
│   ├── Liste de CourseCard (statut, version, nb leçons, destinataires)
│   └── Éditeur                        /academie/mes-formations/$id
│       ├── En-tête (titre, statut Brouillon / Publiée vN / Modifiée)
│       ├── Parcours : modules repliables → leçons
│       ├── Panneau Partage (destinataires, badges, progression agrégée)
│       ├── Barre fixe : Aperçu · Publier
│       └── Feuille Partager
├── Formations reçues                  /academie/recues
│   ├── Invitations en attente (bandeaux en tête)
│   ├── « Reprendre » : dernière leçon en cours
│   └── Grille de ReceivedCourseCard
└── Lecture                            /academie/lecture/$courseId
    ├── Lecteur, reprise, vitesse
    ├── Leçon suivante · Signaler
    └── Sommaire par module avec état de chaque leçon
```

## 3. Composants réutilisables (dossier `src/components/videotheque/`)

| Composant | Contenu et comportement |
|---|---|
| `AcademyTabs` (existant, affiné) | Pastilles défilantes, compteur d'invitations en attente sur « Formations reçues » |
| `PageHeader` | Sur-titre, titre, phrase d'aide, action principale optionnelle |
| `StorageMeter` | Barre fine, « 1,2 Go / 2 Go », passe en orange à 80 % et en rouge à 95 %, lien vers les plans si l'espace est plein |
| `VideoCard` | Miniature 16:9, badge d'état en haut à gauche (Envoi, Prête, Échec, Archivée), durée en bas à droite, titre sur 2 lignes, puce catégorie, taille, icône de partage « utilisée dans N formations », menu « … » |
| `VideoGrid` | 1 colonne à 360 px, 2 de 600 à 1023 px, 3 ou 4 au-delà ; filtres en puces défilantes |
| `UploadDropzone` | Grande zone en pointillés bleus ; sur mobile, deux boutons « Galerie » et « Fichiers » ; sur ordinateur, glisser-déposer avec surbrillance |
| `UploadProgressCard` | Pourcentage, Mo envoyés sur total, vitesse, temps restant, Pause, Reprendre et Annuler, avec un message d'erreur en clair |
| `StatusBadge` | Une seule pastille pour tous les statuts (vidéo, formation, accès), couleur, icône et texte, jamais la couleur seule |
| `CourseCard` | Icône Layers, titre, « Publiée v2 · 6 leçons · 4 personnes », état |
| `ModuleSection` | Titre du module modifiable, compteur de leçons, repliable, « + Leçon dans ce module » |
| `LessonRow` | Poignée de déplacement (ordinateur) ou flèches (mobile), miniature, titre, durée, menu « … » regroupant Modifier et Retirer |
| `VideoPicker` | Grille de miniatures avec recherche, sélection marquée d'un anneau bleu et d'une coche |
| `PublishBar` | Barre fixée en bas : statut (« 2 modifications non publiées »), Aperçu, Publier |
| `RecipientPicker` | Choix « Toute l'équipe (N) » ou « Choisir », recherche, cases à cocher, groupes « Mon équipe » / « Équipe de mon leader », statut déjà acquis grisé |
| `PermissionBadges` | Toujours « Regarder », plus « Repartager » si activé, et « Accès durable » |
| `ShareSummary` | Encadré : « Elles pourront regarder la version 2. Elles la garderont même si vous changez de forfait. Vous pourrez retirer l'accès pendant 7 jours. » |
| `ReceivedCourseCard` | Auteur (et « via X » si repartagé), anneau de progression, « Reprendre la leçon 3 », badge « Accès durable », « Nouvelle version disponible » |
| `InviteBanner` | « X vous partage “Titre” », résumé (leçons, durée), Accepter (principal) et Refuser |
| `FilePlayer` (existant, affiné) | Gros bouton lecture, plein écran, vitesse, barre de progression de la leçon, reprise proposée |
| `LessonOutline` | Sommaire par module ; état de chaque leçon (terminée en vert avec coche, en cours en bleu avec pourcentage, non commencée en gris) |
| `EmptyState`, `CardSkeletons`, `ErrorLine` (existants, affinés) | Icône, une phrase, un bouton ; squelettes à la forme réelle ; erreur en ligne avec « Réessayer » |
| `ConfirmDialog` | Titre clair, conséquence en une phrase, bouton de confirmation nommé par l'action (« Archiver », « Retirer l'accès ») |

Messages : notifications courtes et lisibles par les lecteurs d'écran, sans jargon. Les erreurs de la base sont traduites (déjà fait dans `vtError`).

## 4. États et comportement selon l'écran

| Écran | Mobile (360 à 599 px) | Tablette (600 à 1023 px) | Ordinateur (1024 px et plus) |
|---|---|---|---|
| Vidéothèque | 1 colonne, bouton « Ajouter » fixé en bas au-dessus de la barre de navigation | 2 colonnes | 3 ou 4 colonnes, bouton dans l'en-tête |
| Ajout | Feuille plein écran, boutons Galerie / Fichiers | Feuille centrée | Dialogue avec glisser-déposer |
| Éditeur | Une colonne : parcours, puis partage replié en accordéon ; barre Publier fixée en bas | Idem, plus large | Deux colonnes : parcours à gauche, partage et aperçu à droite |
| Partage | Feuille du bas, liste défilante, bouton fixé en bas | Feuille | Dialogue |
| Reçues | 1 colonne, « Reprendre » en tête | 2 colonnes | 2 ou 3 colonnes |
| Lecture | Vidéo pleine largeur, sommaire en dessous | Idem | Vidéo à gauche, sommaire collant à droite |

**États couverts sur chaque liste :**
- chargement (squelettes) ;
- liste vide ;
- erreur ;
- aucun résultat de filtre ;
- lecture seule (plan expiré : « Import disponible avec le plan Pro, vos vidéos restent consultables »).

## 5. Critères de validation visuelle

- Pas de défilement horizontal à 360, 390, 768, 1280 et 1440 px.
- Zones tactiles d'au moins 44 px, texte d'au moins 12 px (14 px pour le corps), contraste AA.
- Une seule action bleue principale visible par écran.
- Aucune couleur codée en dur : uniquement les couleurs du thème.
- Miniatures chargées seulement quand elles apparaissent à l'écran, aucune vidéo téléchargée avant le clic.
- Chaque liste a ses états chargement, vide et erreur.
- Statuts lisibles sans la couleur (icône et texte).
- Le résumé de partage dit en une phrase ce que le destinataire pourra faire.
- Les confirmations d'archivage et de retrait nomment la conséquence.
- Animations entre 150 et 200 ms, désactivées si le téléphone est réglé pour réduire les animations.
- La mention « Aucun revenu garanti » reste là où elle existe déjà.

## 6. Revue visuelle pendant les tests

- Captures automatiques à **360 px (Android)** et **1280 px**, pour chaque écran et chaque état. Les cas « Envoi en cours » et « Échec » sont provoqués par une interruption simulée, et les états vide et erreur sont aussi capturés.
- Parcours complet rejoué avec votre compte : ajout, formation, publication, aperçu, lecture.
- Pour tester partage et réception à l'écran, il faut un second compte membre de votre équipe. Les données de test sont supprimées ensuite.
- Les captures avant/après vous sont présentées dans le chat. Rien n'est publié.

## 7. Étapes et estimation (indicative)

1. Thème et composants de base (`PageHeader`, `StatusBadge`, `StorageMeter`, `EmptyState`, squelettes) : 2 à 3 crédits.
2. Vidéothèque et ajout (`VideoCard`, `UploadDropzone`, `UploadProgressCard`) : 3 à 4.
3. Éditeur en parcours (`ModuleSection`, `LessonRow`, `VideoPicker`, `PublishBar`) : 3 à 5.
4. Partage (`RecipientPicker`, `PermissionBadges`, `ShareSummary`) : 2 à 3.
5. Formations reçues et lecture (`ReceivedCourseCard`, `InviteBanner`, `LessonOutline`, lecteur) : 3 à 4.
6. Revue visuelle mobile et ordinateur, puis corrections : 2 à 3.

Total : environ **15 à 22 crédits**.

## Décisions encore nécessaires

1. **Compte de test :** pouvez-vous inviter un second compte dans votre équipe ? C'est nécessaire pour vérifier à l'écran le partage, l'invitation et la réception.
2. **Bouton « Ajouter » fixé en bas sur mobile :** d'accord, ou préférez-vous le garder en haut de la page ?
3. **Glisser-déposer :** ordinateur seulement (proposé) ? Sur mobile, on garde les flèches haut/bas.
4. **Indicateur de partage sur les cartes vidéo** (« utilisée dans N formations ») : souhaité ? Il demande un petit calcul de plus au chargement, sans nouvelle table.
5. **Hors design, toujours en attente :**
   - conservation 12 mois des copies reçues si un compte est supprimé, avec la mention correspondante dans les conditions d'utilisation ;
   - vérification des tarifs de stockage et de trafic dans la facturation Lovable Cloud.
