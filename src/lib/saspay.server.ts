// Intégration SasPay (checkout hébergé). Serveur uniquement.
// Doc : https://docs.saspay.me — base https://api.saspay.me/api/v1
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_LIMITS } from "@/lib/admin.functions";

export const SASPAY_BASE = "https://api.saspay.me/api/v1";
export const SASPAY_PRICES: Record<string, { label: string; amount: string }> = {
  pro: { label: "Pro", amount: "5000.00" },
  expert: { label: "Expert", amount: "12000.00" },
  business: { label: "Business", amount: "25000.00" },
};
export const SASPAY_CURRENCY = "XAF";

function apiKey() {
  const key = process.env["SASPAY_API_KEY"];
  if (!key) throw new Error("Paiement en ligne non configuré.");
  return key;
}

export async function saspayFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SASPAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    console.error(`[saspay] ${init.method ?? "GET"} ${path} → ${res.status}`, json?.code ?? "");
    throw new Error(`saspay_${res.status}`);
  }
  return json;
}

async function activatePlan(userId: string, plan: string) {
  const limits = PLAN_LIMITS[plan]!;
  const now = new Date();
  const renew = new Date(now);
  renew.setMonth(renew.getMonth() + 1);
  const payload = {
    plan: plan as any,
    status: "actif" as any,
    limite_prospects: limits.prospects,
    limite_generations_ia: limits.generations,
    date_renouvellement: renew.toISOString(),
    updated_at: now.toISOString(),
  };
  const { data: existing } = await supabaseAdmin.from("subscriptions").select("id").eq("user_id", userId).maybeSingle();
  if (existing) await supabaseAdmin.from("subscriptions").update(payload).eq("id", (existing as any).id);
  else await supabaseAdmin.from("subscriptions").insert({ user_id: userId, ...payload });
}

type Row = { id: string; user_id: string; plan_demande: string; saspay_session_id: string | null; statut: string };

/**
 * Revérifie une session auprès de SasPay et met à jour la demande.
 * Idempotent : la transition en_attente → valide est conditionnelle,
 * le plan n'est activé que par l'appel qui l'a effectivement réalisée.
 */
export async function syncSaspayRequest(row: Row): Promise<"valide" | "echoue" | "en_attente"> {
  if (row.statut !== "en_attente" || !row.saspay_session_id) return row.statut as any;
  const sid = encodeURIComponent(row.saspay_session_id);
  const status = await saspayFetch(`/checkout-sessions/${sid}/status/`);
  const s = String(status?.status ?? "").toUpperCase();
  const t = String(status?.transaction_status ?? "").toUpperCase();

  if (s === "PAID" && t === "SUCCESS") {
    const detail = await saspayFetch(`/checkout-sessions/${sid}/`);
    const expected = SASPAY_PRICES[row.plan_demande];
    const amountOk = expected && Number(detail?.amount).toFixed(2) === expected.amount;
    const currencyOk = String(detail?.currency ?? "").toUpperCase() === SASPAY_CURRENCY;
    if (!amountOk || !currencyOk) {
      console.error("[saspay] montant/devise incohérents pour la demande", row.id);
      return "en_attente";
    }
    const { data: updated } = await supabaseAdmin
      .from("payment_requests")
      .update({ statut: "valide" as any, reference_transaction: String(status?.transaction_reference ?? status?.transaction_id ?? "") })
      .eq("id", row.id)
      .eq("statut", "en_attente")
      .select("id");
    if (updated && updated.length > 0) await activatePlan(row.user_id, row.plan_demande);
    return "valide";
  }

  if (s === "EXPIRED" || s === "CANCELLED" || t === "FAILED" || t === "CANCELLED") {
    await supabaseAdmin.from("payment_requests").update({ statut: "echoue" as any }).eq("id", row.id).eq("statut", "en_attente");
    return "echoue";
  }
  return "en_attente";
}

export async function syncPendingSaspay(filter: { userId?: string }) {
  let q = supabaseAdmin
    .from("payment_requests")
    .select("id, user_id, plan_demande, saspay_session_id, statut")
    .eq("method", "saspay")
    .eq("statut", "en_attente")
    .gte("created_at", new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  const { data } = await q;
  for (const row of (data ?? []) as Row[]) {
    try { await syncSaspayRequest(row); } catch (e) { console.error("[saspay] sync échouée", row.id, e); }
  }
}

// --- Signature webhook : HMAC-SHA256 hex de "{timestamp}.{corps brut}" ---
export async function verifySaspaySignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string) {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const got = signature.trim().toLowerCase();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
