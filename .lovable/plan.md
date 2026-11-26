# MLM Boost AI — Admin Ad Studio : Lot 2

## Objectif
Prolonger le Lot 1, sans reconstruction : URL Analyzer et AI Creative Director textuel, en français/anglais. Conserver les sept rubriques et leur état « À venir » pour les fonctions non livrées. Aucun moteur vidéo, voix off, montage, export vidéo, abonnement, paiement ou publication.

Le cahier des charges Performance Center précédent est préservé intégralement dans `.lovable/reviews/performance-center-spec-before-ad-studio-lot2.md` et n'est pas modifié.

## 1. Audit vérifié
- Code lu : route `src/routes/_authenticated/admin_.ad-studio.tsx`, `src/lib/ad-studio.ts`, `ad-studio.functions.ts`, `ad-studio.test.ts`, `url-analyzer.ts`, `url-analyzer.server.ts`, `src/start.ts` et migration `0038_ad_studio_url_analyses.sql`.
- Lovable Cloud lu : politiques analyses/rôles/réglages/générations/usage IA/campagnes ; existence réelle de l'historique confirmée. Rôle admin du compte principal confirmé ; aucun facteur MFA vérifié à l'instant de l'audit.
- Lot 1 : contrôle UUID côté serveur, authentification et CSRF, shell et sept modules préparés conservés.
- Lot 2A partiel : extraction HTML littérale sourcée, lancement/liste/détail, cinq pages maximum, une analyse simultanée. Pas d'interface URL Analyzer ni Creative Director dans la page examinée.
- Risques : contrôle UUID seul sans rôle/MFA ; contrôle DNS avant fetch mais sans fixation de l'IP réellement contactée (rebinding non résolu) ; développement/futur fusionnés ; erreurs de sauvegarde finale non contrôlées ; clôture après trois minutes pouvant confondre interruption et traitement actif. Les 164 tests historiques n'ont pas été relancés pendant cet audit.
- Firecrawl désormais connecté avec autorisation de l'utilisateur, via la connexion gérée Lovable. Aucune analyse facturée lancée. Clé Lovable AI et SDK déjà présents ; disponibilité du modèle et appel réel restent à vérifier.

## 2. Ordre d'intervention
1. Sécuriser uniquement Ad Studio : UUID principal + `has_role(...,'admin')` + session MFA `aal2`, à chaque opération, avec RLS cohérentes. Ajouter inscription/vérification MFA pour le studio sans modifier les règles générales admin.
2. Vérifier le transport Firecrawl et ses garanties anti-SSRF documentées : la connexion seule ne prouve pas la sécurité. Ne pas conserver de fallback fetch arbitraire. Si redirections/rebinding/réseaux réservés ne peuvent pas être sécurisés, désactiver l'analyse avec erreur explicite.
3. Compléter URL Analyzer : rapport, historique, correction stratégique, sauvegarde et récupération.
4. Ajouter marque/contexte campagne et génération textuelle réelle, édition indépendante, versions et validation.
5. Tester persistance, accès/RLS et parcours réel principal+MFA ; vérifier mobile/ordinateur et non-régression Lot 1.

## 3. URL Analyzer
Parcours : URL HTTP/HTTPS → validation → confirmation du coût si nécessaire → attente/en cours → terminé/erreur → édition → sauvegarde → utilisation dans le directeur créatif. Historique daté avec recherche, filtre et relance explicite.

Rapport : identité, description, offres, bénéfices, cible explicite, problèmes annoncés, arguments, différenciation/positionnement, CTA et identité visuelle détectable. URL/date/extrait bref pour chaque affirmation. Conserver le rapport original ; corrections admin identifiées séparément.

Deux dimensions distinctes :
- preuve : « Confirmée par une source », « À vérifier », « Introuvable » ;
- disponibilité déclarée : présentée disponible / explicitement en développement / explicitement future / non précisée.

Une source publique confirme une déclaration, pas le fonctionnement réel. Un tarif ne prouve pas la disponibilité. « À venir » uniquement si explicitement futur. Aucun avantage, public ou témoignage inventé. Les informations absentes restent absentes.

Sécurité : aucun cookie/token utilisateur vers les sites ; URL sans identifiants, IP directes, réseaux privés/loopback/link-local/métadonnées/réservés et ports non standards refusés ; vérifier DNS, destination réelle et chaque redirection, empêcher rebinding. Pages traitées comme données non fiables, sans exécuter leurs instructions. Ne pas charger leurs médias arbitraires dans le navigateur. Bornes existantes : 5 pages, profondeur 1, 5 redirections, 1,5 Mo/page, budget lecture 25 s ; adaptations seulement selon contrat réel du fournisseur.

## 4. AI Creative Director
Fiche de marque centrale privée : nom, ton, langues, cible, positionnement, contraintes, arguments autorisés/interdits, éléments visuels validés et références de l'analyse. Ne pas imposer l'identité MLM Boost AI à une autre marque.

Dossier lié à l'analyse et à la marque ; campagne CRM optionnelle, uniquement celle du propriétaire, sans changer logique/quotas des campagnes. Le contexte sauvegardé est réutilisé à chaque modification, sans nouvelle lecture automatique du site.

Cinq variantes par dossier : concept, angle, cible, accroche, message, script, storyboard textuel/scènes et CTA. Adaptation Facebook/Instagram/TikTok/YouTube et formats 9:16/1:1/16:9 pour la planification textuelle seulement. Aucun média généré.

Génération réelle via Lovable AI côté serveur, streaming et schéma strict. Instructions système séparées des données web/admin non fiables. Fonctions futures exclues des arguments disponibles ; aucune promesse de revenus. Rapports qualité/conformité et score /100 présentés comme évaluations IA, jamais certification juridique ou performance prouvée.

Édition indépendante des variantes ; régénération d'une seule scène/variante au choix. Autosauvegarde après modification importante, erreur visible et contrôle de concurrence. Versions immuables, aperçu avant restauration, restauration créant une nouvelle version. Validation explicite d'une version ; tout changement retire sa validation. Duplication indépendante et archivage. Corbeille/suppression définitive confirmée : durée à valider, aucune purge arbitraire.

## 5. Architecture et données
Réutiliser authentification, `user_roles`, middleware, composants et historique existants. Aucun rôle parallèle. Pas de bucket ni table média : `user_videos` et stockage privé inchangés. `app_settings` peut stocker uniquement des réglages non secrets Ad Studio, lus après contrôle principal.

Ne pas détourner `ai_generations`/`ai_usage_log` : types et quotas actuels concernent l'assistant MLM. Les dossiers publicitaires ne doivent pas modifier implicitement les quotas abonnés.

Migrations additives proposées, après inspection complète des colonnes/migrations :
- Étendre `ad_studio_url_analyses` sans la recréer : correction stratégique, transport, suivi d'opération et états supplémentaires si retenus ; préserver anciens rapports.
- `ad_studio_brands` : identité centrale réutilisable, nécessaire D13/D14.
- `ad_studio_creatives` : contexte/brief, références analyse/marque/campagne, langue/plateforme, état et version courante.
- `ad_studio_revisions` : snapshots immuables, auteur/date/version/opération, nécessaires historique/restauration/validation.
- `ad_studio_operations` : clé d'idempotence, cible, état, run fournisseur, résultat/erreur sûre et consommation connue/inconnue ; anti-double-clic et traitement des interruptions ambiguës.

GRANT explicites puis RLS pour chaque nouvelle table publique. Lecture limitée UUID principal + rôle admin + MFA ; écritures sensibles uniquement par fonctions serveur contrôlées. Journaux de révision/opération non modifiables directement. Autre admin/utilisateur/Business refusé. Renforcer les politiques de l'historique uniquement dans le périmètre Ad Studio, sans toucher les règles générales admin.

## 6. Coûts et erreurs
Firecrawl géré : conversion documentée 4 crédits Lovable pour 1 000 crédits Firecrawl, 2 sur forfait workspace Business ; ne pas confondre ce forfait avec l'abonnement Business de l'application. Coût exact dépend des formats/options et de `creditsUsed` ; aucune estimation par analyse inventée avant vérification. Afficher coût/consommation dans la bonne unité et demander confirmation avant essai facturé.

Lovable AI textuel : défaut `openai/gpt-6-astra`, disponibilité à vérifier. Lire les workflows SDK/Responses et helpers requis avant implémentation. Clés serveur seulement, streaming, run corrélé et signal Stop propagé. Crédits consommés par les appels réels, aucun montant exact promis.

D4 : une relance contrôlée uniquement si le fournisseur garantit et permet de tester l'absence de double facturation. Idempotence locale ≠ garantie de facturation distante. Sans garantie, relance manuelle confirmée ; aucune reprise après timeout ambigu. Refus/400/401/402/403/404 ne déclenchent aucune relance automatique. Pas de fournisseur alternatif silencieux.

D22 : plafond/budget et mécanisme de réservation fiable à valider avant de promettre un blocage exact. Ne pas ajouter de limite ad hoc non approuvée. Annulation ne garantit pas remboursement du travail déjà engagé.

## 7. Fichiers concernés
Modifier :
- `src/routes/_authenticated/admin_.ad-studio.tsx` ;
- `src/lib/ad-studio.functions.ts`, `url-analyzer.ts`, `url-analyzer.server.ts`, `ad-studio.test.ts` ;
- `roadmap.md`, documentation d'architecture si capacité disponible.

Créer selon besoin :
- `src/components/ad-studio/url-analyzer-panel.tsx`, `analysis-report.tsx`, `creative-director-panel.tsx`, `brand-editor.tsx`, `version-history.tsx`, `mfa-gate.tsx` ;
- `src/lib/ad-studio-access.functions.ts`, `ad-studio.schemas.ts`, `creative-director.functions.ts`, `creative-director.server.ts`, helpers SDK server-only ;
- tests URL, accès/MFA, cinq variantes/scènes, versions/validation et erreurs/opérations ; migrations générées par l'outil Cloud uniquement, sans modification manuelle des fichiers générés.

Conserver navigation/shell/métadonnées et composants Button/Input/Tabs/Dialog existants. Palette sémantique noir/bleu/violet existante, reduced-motion ; mobile Android en colonne, actions accessibles, aucun débordement ; desktop contexte/édition côte à côte.

## 8. Décisions D1–D30
Lot 2 : D1/D25 guidés, D2/D3 qualité/langues, D5 scène ciblée, D7–D9 versions/sauvegarde/aperçu, D10–D12 recherche/duplication/archivage des textes, D13/D14 marque, D15 validation sans export final, D16–D18 adaptations/5 variantes/formats textuels, D19–D21 évaluations clairement qualifiées.

D28 maintenant : MFA et serveur, aucun contournement si non configurée. D4/D6/D22 conditionnels aux garanties, autorisations et plafonds.

Lots futurs : comparaison complète fournisseurs D23, comptabilité complète D24, orchestration média D25, file autonome/notifications D26, pilotage complet D27, journal global D29 et sauvegardes infrastructure/restauration/tests réguliers D30. Traçabilité minimale des opérations textuelles incluse ; versions textuelles ≠ sauvegardes infrastructure. Ne pas annoncer les fonctions globales disponibles.

## 9. Tests et critères d'acceptation
- Principal+admin+aal2 autorisé ; autre admin/utilisateur, principal sans MFA, déconnecté et appels directs sensibles refusés ; vérifier RLS réelles.
- URL valide/interdite/encodée/IPv6, DNS mixte, redirection privée, rebinding, taille/non HTML/timeout/erreur fournisseur ; transport non sûr = aucun fetch arbitraire.
- Développement/futur/source distincts, tarifs non probants et injection web ignorée.
- Cinq variantes exactes ; indépendance édition ; une seule scène régénérée ; autosauvegarde/récupération au rechargement ; conflit concurrent ; aperçu/restauration ; changement invalidant validation.
- Une opération pour double clic ; timeout/facturation inconnue sans retry ; crédits insuffisants/refus interrompant la chaîne.
- Parcours réel principal MFA : analyse URL autorisée, rapport, génération, édition, sauvegarde, rechargement et relecture. Si compte/service inaccessible, vérification explicitement non effectuée.
- Tests ciblés puis non-régression ; contrôle automatique compilation/typecheck de la plateforme, sans build manuel ni publication. Playwright mobile/ordinateur ; sept modules Lot 1 préservés.

## 10. Points à valider avant activation
1. Firecrawl connecté ; vérifier garanties SSRF et coûts avant premier essai facturé.
2. Activation MFA du compte principal : aucun facteur vérifié actuellement.
3. Plafonds IA/campagne et politique de coûts ; aucune dépense nouvelle sans accord.
4. Durée corbeille/conservation ; pas de purge automatique arbitraire.
5. Garantie distante D4 : ne jamais la déclarer résolue par le seul anti-double-clic.

Livraison : compte rendu exact fonctions réelles, fichiers, migrations, tests, risques et commit. Aucun déploiement/publication.
