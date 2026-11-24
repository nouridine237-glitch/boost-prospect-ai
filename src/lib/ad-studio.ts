/** Administrateur principal autorisé pour l'Admin Ad Studio (vérifié côté serveur). */
export const AD_STUDIO_OWNER_ID = "da34c34b-7f66-4103-aa6a-d29f8fe3f300";

export function isAdStudioOwner(userId: string | null | undefined): boolean {
  return typeof userId === "string" && userId.toLowerCase() === AD_STUDIO_OWNER_ID;
}

export type AdStudioModule = { key: string; title: string; description: string; status: "a_venir" };

export const AD_STUDIO_MODULES: readonly AdStudioModule[] = [
  { key: "campagnes", title: "Campagnes publicitaires", description: "Préparer et suivre les campagnes.", status: "a_venir" },
  { key: "visuels", title: "Visuels", description: "Création d'images publicitaires.", status: "a_venir" },
  { key: "videos", title: "Vidéos", description: "Création et montage vidéo.", status: "a_venir" },
  { key: "voix", title: "Voix off", description: "Narration audio des annonces.", status: "a_venir" },
  { key: "mediatheque", title: "Médiathèque", description: "Bibliothèque des contenus créés.", status: "a_venir" },
  { key: "couts", title: "Suivi des coûts", description: "Dépenses par création et campagne.", status: "a_venir" },
  { key: "journal", title: "Journal d'activité", description: "Historique des actions de l'atelier.", status: "a_venir" },
];
