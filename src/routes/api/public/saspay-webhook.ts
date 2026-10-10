import { createFileRoute } from "@tanstack/react-router";

const HANDLED = new Set(["transaction.success", "transaction.failed", "transaction.cancelled"]);

export const Route = createFileRoute("/api/public/saspay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SASPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        const { verifySaspaySignature, syncPendingSaspay } = await import("@/lib/saspay.server");
        const ok = await verifySaspaySignature(
          raw,
          request.headers.get("x-webhook-timestamp"),
          request.headers.get("x-webhook-signature"),
          secret,
        );
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let event = "";
        try { event = String(JSON.parse(raw)?.event ?? ""); } catch { return new Response("Bad payload", { status: 400 }); }
        if (!HANDLED.has(event)) return new Response("ignored");

        // Le webhook ne fait foi de rien : on revérifie chaque session en attente auprès de SasPay.
        await syncPendingSaspay({});
        return new Response("ok");
      },
    },
  },
});
