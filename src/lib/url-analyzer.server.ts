/**
 * Lecture HTTP des pages publiques pour l'URL Analyzer — serveur uniquement.
 * Protections : validation d'adresse, résolution DNS (DNS-over-HTTPS) avec refus de toute IP
 * privée/réservée avant chaque requête et chaque redirection, redirections manuelles,
 * taille/durée/nombre de pages limités, aucun cookie ni jeton transmis.
 */
import {
  ANALYZER_LIMITS, buildReport, extractPage, isBlockedIp, pickSubpages, validatePublicUrl,
  type AnalysisReport, type AnalyzedPage, type ExtractedPage,
} from "./url-analyzer";

export class AnalyzerError extends Error {}

const DOH = "https://cloudflare-dns.com/dns-query";
const UA = "MLMBoostAI-URLAnalyzer/1.0 (+https://www.mlmboostai.app)";

async function resolveAll(host: string, signal: AbortSignal): Promise<string[]> {
  const out: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: "application/dns-json" }, signal, redirect: "manual",
    }).catch(() => null);
    if (!res || !res.ok) throw new AnalyzerError("Vérification DNS impossible pour le moment. Réessaie plus tard.");
    const json = (await res.json().catch(() => null)) as { Status?: number; Answer?: { type: number; data: string }[] } | null;
    if (!json) throw new AnalyzerError("Vérification DNS impossible pour le moment.");
    for (const a of json.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
  }
  return out;
}

/** Refuse un hôte dont une seule des adresses résolues est privée, réservée ou locale. */
export async function assertPublicHost(host: string, signal: AbortSignal): Promise<void> {
  const ips = await resolveAll(host, signal);
  if (ips.length === 0) throw new AnalyzerError("Nom de domaine introuvable.");
  if (ips.some(isBlockedIp)) throw new AnalyzerError("Adresse refusée : le domaine pointe vers un réseau privé ou réservé.");
}

type Fetched = { finalUrl: string; status: number; html: string; truncated: boolean };

export async function fetchPublicPage(rawUrl: string, deadline: number): Promise<Fetched> {
  let current = rawUrl;
  for (let hop = 0; hop <= ANALYZER_LIMITS.maxRedirects; hop++) {
    const check = validatePublicUrl(current);
    if (!check.ok) throw new AnalyzerError(hop ? `Redirection refusée : ${check.error}` : check.error);
    const remaining = deadline - Date.now();
    if (remaining < 500) throw new AnalyzerError("Durée maximale d'analyse atteinte.");
    const signal = AbortSignal.timeout(Math.min(ANALYZER_LIMITS.pageTimeoutMs, remaining));
    await assertPublicHost(check.host, signal);
    let res: Response;
    try {
      res = await fetch(check.url, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml;q=0.9", "accept-language": "fr,en;q=0.8" },
      });
    } catch (e) {
      throw new AnalyzerError(e instanceof Error && e.name === "TimeoutError" ? "Le site a mis trop de temps à répondre." : "Le site est injoignable.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!loc) throw new AnalyzerError("Redirection sans destination.");
      current = new URL(loc, check.url).toString();
      continue;
    }
    if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new AnalyzerError(`Le site a répondu avec une erreur ${res.status}.`); }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!type.includes("text/html") && !type.includes("application/xhtml")) {
      await res.body?.cancel().catch(() => {});
      throw new AnalyzerError("Ce n'est pas une page web (HTML).");
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    let truncated = declared > ANALYZER_LIMITS.maxBytesPerPage;
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
        if (size >= ANALYZER_LIMITS.maxBytesPerPage) { truncated = true; await reader.cancel().catch(() => {}); break; }
      }
    }
    const buf = new Uint8Array(Math.min(size, ANALYZER_LIMITS.maxBytesPerPage));
    let off = 0;
    for (const c of chunks) { const part = c.subarray(0, buf.length - off); buf.set(part, off); off += part.length; if (off >= buf.length) break; }
    return { finalUrl: check.url, status: res.status, html: new TextDecoder("utf-8", { fatal: false }).decode(buf), truncated };
  }
  throw new AnalyzerError("Trop de redirections.");
}

/** Analyse complète : page d'accueil puis au plus 4 pages liées du même site (profondeur 1). */
export async function analyzePublicUrl(rawUrl: string, now: () => number = Date.now): Promise<AnalysisReport> {
  const first = validatePublicUrl(rawUrl);
  if (!first.ok) throw new AnalyzerError(first.error);
  const deadline = now() + ANALYZER_LIMITS.totalBudgetMs;
  const home = await fetchPublicPage(first.url, deadline);
  const pages: ExtractedPage[] = [extractPage(home.html, home.finalUrl)];
  const statuses: AnalyzedPage[] = [{ url: home.finalUrl, ok: true, httpStatus: home.status, title: pages[0]!.title, truncated: home.truncated }];
  const subs = pickSubpages(pages[0]!.links, home.finalUrl);
  const results = await Promise.allSettled(subs.map((u) => fetchPublicPage(u, deadline)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const ex = extractPage(r.value.html, r.value.finalUrl);
      pages.push(ex);
      statuses.push({ url: r.value.finalUrl, ok: true, httpStatus: r.value.status, title: ex.title, truncated: r.value.truncated });
    } else {
      statuses.push({ url: subs[i]!, ok: false, error: r.reason instanceof AnalyzerError ? r.reason.message : "erreur inattendue" });
    }
  });
  return buildReport(first.url, pages, statuses, new Date(now()));
}
