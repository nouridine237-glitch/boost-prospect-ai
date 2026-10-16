// Mémorise le code ?ref=CODE (localStorage + cookie) jusqu'à l'inscription.
const KEY = "mlm-ref";

export function captureRefFromUrl() {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{8}$/.test(code)) return;
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  document.cookie = `${KEY}=${code}; path=/; max-age=${30 * 86400}; samesite=lax`;
}

export function readRef(): string | null {
  if (typeof window === "undefined") return null;
  let v: string | null = null;
  try { v = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!v) v = document.cookie.split("; ").find((c) => c.startsWith(`${KEY}=`))?.split("=")[1] ?? null;
  return v && /^[A-Z0-9]{8}$/.test(v) ? v : null;
}

export function clearRef() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  document.cookie = `${KEY}=; path=/; max-age=0`;
}
