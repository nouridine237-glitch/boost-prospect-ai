export type QuizQuestion = { q: string; options: string[]; answer: number };

export const PASS_RATIO = 0.8;

export const quizzes: Record<number, QuizQuestion[]> = {
  1: [
    { q: "Dans un MLM légitime, d'où vient principalement le revenu ?", options: ["Des frais d'inscription des recrues", "De la vente de produits à de vrais clients", "Des investissements des membres"], answer: 1 },
    { q: "Que signifie généralement « PV » dans un plan de compensation ?", options: ["Point Volume", "Prix de Vente", "Prime Variable"], answer: 0 },
    { q: "Quel est un signal d'alerte d'un système pyramidal ?", options: ["On peut gagner sans recruter", "Le produit a une vraie valeur", "On gagne surtout en recrutant, pas en vendant"], answer: 2 },
    { q: "Que dire à un prospect sur les revenus ?", options: ["Lui promettre un revenu garanti", "Ne jamais promettre de revenu garanti", "Lui montrer uniquement les meilleurs revenus"], answer: 1 },
    { q: "Qu'est-ce qui détermine réellement le succès ?", options: ["La chance", "Une activité structurée et constante", "Le nombre de messages envoyés en masse"], answer: 1 },
  ],
  2: [
    { q: "Pourquoi l'image compte-t-elle autant ?", options: ["Le prospect confond vendeur, produit et publicité", "Seul le produit compte", "Pour impressionner l'équipe"], answer: 0 },
    { q: "Quelle est une erreur d'image fréquente ?", options: ["Une photo de profil nette", "Le « bling bling » excessif", "Une bio claire"], answer: 1 },
    { q: "Sur WhatsApp, une bonne pratique est :", options: ["Utiliser un pseudo mystérieux", "Une photo nette et ton vrai nom", "Changer de statut toutes les heures avec des promos"], answer: 1 },
    { q: "Un fil Facebook/Instagram crédible est :", options: ["100 % promotionnel", "Équilibré entre vie, valeur et activité", "Vide"], answer: 1 },
    { q: "Construire son image, c'est :", options: ["Jouer un personnage", "Rester authentique et régulier", "Copier un leader connu"], answer: 1 },
  ],
  3: [
    { q: "Qu'est-ce que le contenu change dans la prospection ?", options: ["Les gens viennent vers toi", "Rien du tout", "Il remplace le produit"], answer: 0 },
    { q: "Lequel est un type de contenu efficace ?", options: ["Promesse de revenu rapide", "Réponse à une objection courante", "Capture d'écran de virement"], answer: 1 },
    { q: "Comment ne jamais manquer d'idées ?", options: ["Copier les posts des autres", "Noter chaque question ou objection reçue", "Publier au hasard"], answer: 1 },
    { q: "Quelle erreur éloigne les prospects ?", options: ["Un contenu éducatif", "Un contenu 100 % promotionnel", "Des coulisses de ton activité"], answer: 1 },
    { q: "Pour que le contenu fonctionne, il faut surtout :", options: ["De la régularité", "Publier une fois par an", "Des promesses de gains"], answer: 0 },
  ],
  4: [
    { q: "Le marché chaud, c'est :", options: ["Des inconnus sur internet", "Famille, amis, collègues", "Les clients d'un concurrent"], answer: 1 },
    { q: "Une bonne approche commence par :", options: ["Un message générique envoyé en masse", "Un contact initial personnalisé", "Une présentation de 30 minutes"], answer: 1 },
    { q: "Face à « Je vais réfléchir », que faire ?", options: ["Insister jusqu'à un oui", "Demander ce qui le fait hésiter", "Le supprimer de tes contacts"], answer: 1 },
    { q: "Une objection traitée avec respect et sans pression :", options: ["Renforce la confiance", "Fait perdre la vente", "N'a aucun effet"], answer: 0 },
    { q: "Laquelle de ces pratiques ferme des portes définitivement ?", options: ["Écouter le prospect", "Insister après un refus clair", "Respecter sa réponse"], answer: 1 },
  ],
  5: [
    { q: "Pourquoi le suivi est-il si important ?", options: ["La majorité des ventes ne se concluent pas au premier contact", "Il ne sert à rien", "Pour remplir l'agenda"], answer: 0 },
    { q: "Combien de statuts compte le pipeline de suivi ?", options: ["3", "6", "10"], answer: 1 },
    { q: "Après un premier contact sans réponse, relancer après :", options: ["2 à 4 jours", "1 heure", "6 mois"], answer: 0 },
    { q: "Chaque relance doit :", options: ["Répéter le même message", "Apporter quelque chose de nouveau", "Mettre la pression"], answer: 1 },
    { q: "À quoi sert le niveau d'intérêt (faible, moyen, élevé) ?", options: ["À prioriser ton temps", "À juger la personne", "À rien"], answer: 0 },
  ],
  6: [
    { q: "Qu'est-ce qui génère le plus de résultats dans la durée ?", options: ["Recruter un maximum de personnes", "Quelques filleuls bien formés et actifs", "Ne pas former du tout"], answer: 1 },
    { q: "Quelle période est décisive pour un nouveau filleul ?", options: ["Les 48 premières heures", "Le premier anniversaire", "Aucune"], answer: 0 },
    { q: "Par quoi commence un bon parcours de démarrage ?", options: ["Recruter immédiatement 10 personnes", "Utiliser le produit soi-même", "Les techniques avancées"], answer: 1 },
    { q: "Pour animer une équipe dans la durée :", options: ["Tout faire à sa place", "Donner l'exemple et célébrer les petites réussites", "Communiquer une fois par an"], answer: 1 },
    { q: "Lequel est un piège courant ?", options: ["Déléguer la formation avec le temps", "Confondre motivation et compétence", "Écouter les filleuls discrets"], answer: 1 },
  ],
};
