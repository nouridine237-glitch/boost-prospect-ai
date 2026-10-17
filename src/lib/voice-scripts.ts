export type VoiceStep = { label: string; seconds: number; text: string };
export type VoiceScript = { id: string; situation: string; goal: string; steps: VoiceStep[] };

export const totalSeconds = (v: VoiceScript) => v.steps.reduce((s, x) => s + x.seconds, 0);
export const voiceText = (v: VoiceScript) => v.steps.map(s => s.text).join("\n\n");

export const voiceScripts: VoiceScript[] = [
  { id: "premier-contact", situation: "Premier contact avec une connaissance", goal: "Ouvrir la discussion sans rien vendre", steps: [
    { label: "Salutation", seconds: 8, text: "Salut [Prénom], c'est [Ton prénom] ! J'espère que tu vas bien, ça fait longtemps." },
    { label: "Raison du message", seconds: 15, text: "Je pensais à toi parce que je découvre en ce moment des produits qui m'aident beaucoup, et je me suis dit que ça pourrait t'intéresser." },
    { label: "Question ouverte", seconds: 10, text: "Est-ce que tu serais curieux d'en savoir un peu plus ? Aucune obligation, dis-moi simplement." } ] },
  { id: "relance-douce", situation: "Relance après un silence", goal: "Reprendre contact sans pression", steps: [
    { label: "Salutation", seconds: 6, text: "Coucou [Prénom], c'est [Ton prénom]." },
    { label: "Rappel", seconds: 12, text: "Je reviens vers toi suite à notre échange de l'autre jour. Je sais que tout le monde est occupé, donc pas de souci si tu n'as pas eu le temps." },
    { label: "Question", seconds: 10, text: "Tu as pu y réfléchir un peu ? Dis-moi franchement ce que tu en penses, même si c'est non." } ] },
  { id: "apres-presentation", situation: "Après une présentation", goal: "Recueillir l'avis du prospect", steps: [
    { label: "Remerciement", seconds: 8, text: "Merci [Prénom] d'avoir pris le temps de regarder la présentation, ça me fait plaisir." },
    { label: "Écoute", seconds: 12, text: "J'aimerais vraiment savoir ce que tu en as retenu. Qu'est-ce qui t'a plu, et qu'est-ce qui te pose question ?" },
    { label: "Prochaine étape", seconds: 10, text: "Si tu veux, on peut en parler 10 minutes cette semaine. Quel moment t'arrange ?" } ] },
  { id: "client-satisfait", situation: "Suivi d'un client", goal: "Prendre des nouvelles après un achat", steps: [
    { label: "Salutation", seconds: 6, text: "Bonjour [Prénom], c'est [Ton prénom]." },
    { label: "Nouvelles", seconds: 12, text: "Je voulais savoir comment ça se passe avec le produit. Est-ce que tu as remarqué une différence ?" },
    { label: "Disponibilité", seconds: 10, text: "Si tu as la moindre question sur l'utilisation, je suis là. N'hésite pas à me répondre ici." } ] },
  { id: "invitation-webinaire", situation: "Invitation à une réunion en ligne", goal: "Inviter à découvrir sans engagement", steps: [
    { label: "Accroche", seconds: 8, text: "Salut [Prénom] ! J'ai pensé à toi pour une petite réunion en ligne." },
    { label: "Détails", seconds: 15, text: "C'est [jour] à [heure], ça dure environ 30 minutes. On y explique les produits et le fonctionnement, simplement et honnêtement." },
    { label: "Question", seconds: 8, text: "Ça te dirait de venir écouter ? Tu peux juste regarder, sans rien décider." } ] },
  { id: "nouvelle-recrue", situation: "Accueil d'un nouveau membre", goal: "Rassurer et lancer le premier pas", steps: [
    { label: "Bienvenue", seconds: 8, text: "Bienvenue dans l'équipe [Prénom] ! Je suis vraiment content de t'accompagner." },
    { label: "Rassurer", seconds: 15, text: "Au début, c'est normal de ne pas tout savoir. On avance pas à pas, à ton rythme, et je reste disponible pour toi." },
    { label: "Premier pas", seconds: 10, text: "Pour commencer, est-ce qu'on peut se caler un appel de 15 minutes cette semaine ?" } ] },
];
