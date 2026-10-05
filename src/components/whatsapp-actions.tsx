import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const countryCodes = [
  { value: "237", label: "Cameroun (+237)" },
  { value: "225", label: "Côte d'Ivoire (+225)" },
  { value: "221", label: "Sénégal (+221)" },
  { value: "", label: "Autre (pas d'indicatif ajouté)" },
] as const;

let cachedCode: string | null = null;
const listeners = new Set<(c: string) => void>();
export function setCachedCountryCode(code: string) { cachedCode = code; listeners.forEach(l => l(code)); }

export function useDefaultCountryCode() {
  const [code, setCode] = useState(cachedCode ?? "237");
  useEffect(() => {
    listeners.add(setCode);
    if (cachedCode === null) {
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        supabase.from("profiles").select("preferences").eq("id", data.user.id).maybeSingle().then(({ data: p }) => {
          const prefs = (p?.preferences ?? {}) as Record<string, unknown>;
          setCachedCountryCode(typeof prefs["default_country_code"] === "string" ? (prefs["default_country_code"] as string) : "237");
        });
      });
    }
    return () => { listeners.delete(setCode); };
  }, []);
  return code;
}

export function normalizePhone(raw: string, defaultCode: string): string {
  const hadPlus = raw.trim().startsWith("+") || raw.trim().startsWith("00");
  let digits = raw.replace(/[\s\-().+]/g, "").replace(/\D/g, "");
  if (raw.trim().startsWith("00")) digits = digits.slice(2);
  if (hadPlus) return digits;
  if (defaultCode && digits.startsWith(defaultCode) && digits.length > defaultCode.length + 7) return digits;
  digits = digits.replace(/^0+/, "");
  return defaultCode + digits;
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.04.72C5.79.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.6l6.01-1.58a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02" /></svg>;
}

export function WhatsAppActions({ message, phone, prospectStatus, onMarkContacted }: { message: string; phone?: string | null; prospectStatus?: string; onMarkContacted?: () => Promise<void> | void }) {
  const code = useDefaultCountryCode();
  const [copied, setCopied] = useState(false);
  const empty = !message.trim();
  const noPhone = !phone?.trim();

  async function copy() {
    if (await copyText(message)) {
      setCopied(true); toast.success("Message copié");
      setTimeout(() => setCopied(false), 2000);
    } else toast.error("Copie impossible");
  }

  function send() {
    if (!phone) return;
    const number = normalizePhone(phone, code);
    if (number.length < 8) { toast.error("Numéro invalide"); return; }
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    if (onMarkContacted && prospectStatus === "nouveau") {
      toast("Message ouvert dans WhatsApp", { duration: 10000, action: { label: "Marquer comme Contacté ?", onClick: () => { void onMarkContacted(); } } });
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <span className="min-w-[150px] flex-1" title={noPhone ? "Ajoute un numéro de téléphone à ce prospect" : undefined}>
          <Button type="button" size="sm" onClick={send} disabled={empty || noPhone} className="w-full bg-[#25D366] text-[#0b2e1a] hover:bg-[#25D366]/90"><WhatsAppIcon /> Envoyer via WhatsApp</Button>
        </span>
        <Button type="button" size="sm" variant="outline" onClick={copy} disabled={empty} className="min-w-[110px] flex-1 sm:flex-none">{copied ? <><Check /> Copié ✓</> : <><Copy /> Copier</>}</Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Tu vérifies et envoies toi-même le message dans WhatsApp.</p>
    </div>
  );
}
