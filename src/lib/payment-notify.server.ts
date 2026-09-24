// Notification e-mail à l'administrateur lors d'une nouvelle demande de paiement.
// Tant qu'aucun domaine d'envoi n'est configuré pour le projet, la notification
// est simplement tracée côté serveur (aucune erreur remontée à l'utilisateur).

export const ADMIN_EMAIL = "nouridine237@gmail.com";

export type PaymentNotification = {
  userName: string;
  email: string;
  plan: string;
  montant: string;
  reference: string;
};

export async function notifyAdminOfPaymentRequest(payload: PaymentNotification) {
  console.info(
    `[payments] Nouvelle demande de paiement à notifier à ${ADMIN_EMAIL} —`,
    `${payload.userName} (${payload.email}) · plan ${payload.plan} · ${payload.montant} · réf ${payload.reference}`,
  );
}
