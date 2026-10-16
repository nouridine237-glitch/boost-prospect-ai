import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const getPublicCapturePage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: rows } = await sb.rpc("capture_page_view", { _slug: data.slug });
    return (rows && rows[0]) ?? null;
  });

const leadSchema = z.object({
  slug: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, "Nom trop court").max(80),
  phone: z.string().trim().min(6, "Numéro invalide").max(30).regex(/^[+\d\s().-]+$/, "Numéro invalide"),
  interest: z.string().trim().max(300).default(""),
  website: z.string().max(0).optional(), // honeypot
});

export const submitCaptureLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => leadSchema.parse(d))
  .handler(async ({ data }) => {
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`capture:${ip}`));
    const ipHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("submit_capture_lead", {
      _slug: data.slug, _name: data.name, _phone: data.phone, _interest: data.interest, _ip_hash: ipHash,
    });
    if (error) return { ok: false, message: "Envoi impossible pour le moment. Réessaie plus tard." };
    if (res === "rate_limited") return { ok: false, message: "Trop d'envois depuis ta connexion. Réessaie dans une heure." };
    if (res === "not_found") return { ok: false, message: "Cette page n'existe plus." };
    if (res === "owner_full") return { ok: false, message: "Cette page ne peut pas recevoir de demandes pour le moment. Contacte la personne par WhatsApp." };
    return { ok: true, message: "" };
  });
