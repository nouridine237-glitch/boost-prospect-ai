// Notification e-mail à l'administrateur lors d'une nouvelle demande de paiement.
// L'envoi passe par le système d'e-mails du site ; en cas d'échec, la demande
// de paiement reste enregistrée et l'erreur est simplement tracée côté serveur.

export const ADMIN_EMAIL = "nouridine237@gmail.com";

export type PaymentNotification = {
  userName: string;
  email: string;
  plan: string;
  montant: string;
  reference: string;
};

export async function notifyAdminOfPaymentRequest(payload: PaymentNotification) {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("payment-notification", ADMIN_EMAIL, {
      templateData: payload,
      idempotencyKey: `payment-notification-${payload.reference}`,
      ...(payload.email ? { replyTo: payload.email } : {}),
    });
  } catch (error) {
    console.error("[payments] Échec de l'envoi de la notification e-mail :", error);
  }
}
