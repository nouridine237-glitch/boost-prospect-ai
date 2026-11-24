/**
 * URL Analyzer (Admin Ad Studio, lot 2A) — règles pures, testées.
 * Le contenu des pages est traité comme des données non fiables : il est seulement
 * découpé, nettoyé et classé, jamais interprété comme une instruction.
 */

export const ANALYZER_LIMITS = {
  maxUrlLength: 2048,
  maxPages: 5, // page d'accueil + 4 pages liées (profondeur 1)
  maxRedirects: 5,
  maxBytesPerPage: 1_500_000,
  pageTimeoutMs: 8_000,
  totalBudgetMs: 25_000,
} as const;

export type ClaimStatus = "confirmee" | "a_verifier" | "a_venir" | "introuvable";
export type ClaimCategory = "identite" | "description" | "offre" | "fonctionnalite" | "public_cible" | "argument" | "cta";

export type Claim = {
  category: ClaimCategory;
  text: string;
  status: ClaimStatus;
  excerpt: string;
  sourceUrl: string;
  note: string;
  href?: string;
};

export type AnalyzedPage = { url: string; ok: boolean; httpStatus?: number; title?: string; error?: string; truncated?: boolean };

export type VisualIdentity = { themeColor: string | null; colors: string[]; fonts: string[]; ogImage: string | null; favicon: string | null };

export type AnalysisReport = {
  version: 1;
  url: string;
  analyzedAt: string;
  pages: AnalyzedPage[];
  claims: Claim[];
  visual: VisualIdentity;
  warnings: string[];
  limits: string[];
};

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  confirmee: "Confirmée par une source",
  a_verifier: "À vérifier",
  a_venir: "À venir",
  introuvable: "Introuvable",
};

export const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  identite: "Identité / nom de marque",
  description: "Description",
  offre: "Produits, services et offres",
  fonctionnalite: "Fonctionnalités observables",
  public_cible: "Public cible",
  argument: "Bénéfices et arguments",
  cta: "Appels à l'action",
};

// ---------- Validation d'URL (anti-SSRF, premier niveau) ----------

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet", ".localdomain", ".arpa", ".test", ".invalid", ".example"];

export type UrlCheck = { ok: true; url: string; host: string } | { ok: false; error: string };

export function validatePublicUrl(raw: string): UrlCheck {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "Saisis une adresse." };
  if (input.length > ANALYZER_LIMITS.maxUrlLength) return { ok: false, error: "Adresse trop longue." };
  let u: URL;
  try { u = new URL(input); } catch { return { ok: false, error: "Adresse invalide. Exemple : https://mlmboostai.app" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Seules les adresses http:// et https:// sont acceptées." };
  if (u.username || u.password) return { ok: false, error: "Les identifiants dans l'adresse sont refusés." };
  if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "Seuls les ports standards (80, 443) sont acceptés." };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, error: "Adresse invalide." };
  if (host.startsWith("[") || host.includes(":")) return { ok: false, error: "Les adresses IP directes sont refusées." };
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) return { ok: false, error: "Les adresses IP directes sont refusées." };
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, error: "Adresse interne refusée." };
  if (!host.includes(".")) return { ok: false, error: "Nom de domaine public requis." };
  if (!/^[a-z0-9.-]+$/.test(host)) return { ok: false, error: "Nom de domaine invalide (utilise la forme internationale)." };
  u.hash = "";
  return { ok: true, url: u.toString(), host };
}

// ---------- Adresses IP interdites ----------

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true;
  return V4_BLOCKED.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]!);
    if (n === null) return null;
    s = s.slice(0, -v4[1]!.length) + ((n >>> 16) & 0xffff).toString(16) + ":" + (n & 0xffff).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

/** Vrai si l'adresse IP est privée, réservée, locale ou illisible (refus par défaut). */
export function isBlockedIp(ip: string): boolean {
  const s = ip.trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return v4Blocked(s);
  const g = expandV6(s);
  if (!g) return true;
  const [a, b] = [g[0]!, g[1]!];
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return v4Blocked(`${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`); // IPv4 mappée / compatible
  }
  if (a === 0x64 && b === 0xff9b) return v4Blocked(`${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`); // NAT64
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((a & 0xff00) === 0xff00) return true; // multicast
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  if (a === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // discard
  if (a === 0x2002) return true; // 6to4 (peut encapsuler une IPv4 privée)
  return false;
}

// ---------- Extraction HTML ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function safeChar(code: number): string {
  try { return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ""; } catch { return ""; }
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, " ").replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}

export type PageBlock = { tag: string; text: string; inner: string; href: string | null; pricing: boolean };

export type ExtractedPage = {
  url: string;
  title: string;
  description: string | null;
  siteName: string | null;
  blocks: PageBlock[];
  links: string[];
  visual: VisualIdentity;
  textLength: number;
};

const PRICE_RE = /(\d[\d\s.,]*\s*(fcfa|xaf|xof|€|eur|usd|\$)|(\$|€)\s*\d)/i;
const PERIOD_RE = /(\/\s*mois|par mois|mensuel|\/\s*an\b|par an|month|year|tarif|pricing|forfait|abonnement)/i;

/** Découpe une page en blocs de texte classables. Aucune interprétation du contenu. */
export function extractPage(rawHtml: string, pageUrl: string): ExtractedPage {
  const html = rawHtml.slice(0, ANALYZER_LIMITS.maxBytesPerPage);
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 20000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string) => {
    for (const m of metas) {
      const k = (attr(m, "name") ?? attr(m, "property") ?? "").toLowerCase();
      if (k === key) { const c = attr(m, "content"); if (c) return textOf(c).slice(0, 400); }
    }
    return null;
  };
  const title = textOf(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 200);

  const styles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join(" ") + " " + (html.match(/\sstyle\s*=\s*"[^"]*"/gi) ?? []).join(" ");
  const colorCounts = new Map<string, number>();
  for (const c of styles.match(/#[0-9a-f]{6}\b/gi) ?? []) colorCounts.set(c.toLowerCase(), (colorCounts.get(c.toLowerCase()) ?? 0) + 1);
  const colors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
  const fonts = new Set<string>();
  for (const l of head.match(/<link\b[^>]*>/gi) ?? []) {
    const href = attr(l, "href") ?? "";
    if (/fonts\.googleapis\.com/i.test(href)) for (const f of href.matchAll(/family=([^&:]+)/gi)) fonts.add(decodeURIComponent(f[1]!.replace(/\+/g, " ")).slice(0, 60));
  }
  const iconTag = (head.match(/<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i) ?? [])[0];
  const themeColor = meta("theme-color");
  const visual: VisualIdentity = {
    themeColor: themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor) ? themeColor.toLowerCase() : null,
    colors,
    fonts: [...fonts].slice(0, 6),
    ogImage: absolutize(meta("og:image"), pageUrl),
    favicon: absolutize(iconTag ? attr(iconTag, "href") : null, pageUrl),
  };

  const body = (html.match(/<body[\s\S]*$/i)?.[0] ?? html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|object)\b[\s\S]*?<\/\1>/gi, " ");

  const sectionStarts = [...body.matchAll(/<(section|footer|nav)\b/gi)].map((m) => ({ i: m.index ?? 0, tag: m[1]!.toLowerCase() }));
  const ranges = sectionStarts.map((s, k) => {
    const next = sectionStarts[k + 1]?.i ?? body.length;
    let end = next;
    if (s.tag !== "section") {
      const close = body.toLowerCase().indexOf(`</${s.tag}>`, s.i);
      end = close >= 0 ? close + s.tag.length + 3 : next;
    }
    const t = textOf(body.slice(s.i, end));
    return { start: s.i, end, tag: s.tag, pricing: s.tag === "section" && PRICE_RE.test(t) && PERIOD_RE.test(t) };
  });
  const rangeAt = (i: number) => {
    const hits = ranges.filter((r) => i >= r.start && i < r.end);
    return hits.find((r) => r.tag !== "section") ?? hits[0];
  };

  const blocks: PageBlock[] = [];
  const links = new Set<string>();
  for (const m of body.matchAll(/<(h[1-6]|p|li|button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1]!.toLowerCase();
    const inner = m[3] ?? "";
    const text = textOf(inner).slice(0, 400);
    const r = rangeAt(m.index ?? 0);
    if (r && (r.tag === "nav" || r.tag === "footer") && tag !== "a") continue;
    let href: string | null = null;
    if (tag === "a") href = absolutize(attr(`<a${m[2] ?? ""}>`, "href"), pageUrl);
    else { const a = inner.match(/<a\b[^>]*>/i); if (a) href = absolutize(attr(a[0], "href"), pageUrl); }
    if (href && sameSite(href, pageUrl)) links.add(href.split("#")[0]!);
    if (r && (r.tag === "nav" || r.tag === "footer")) continue;
    if (!text) continue;
    blocks.push({ tag, text, inner, href, pricing: !!r?.pricing });
  }
  return {
    url: pageUrl, title,
    description: meta("description") ?? meta("og:description"),
    siteName: meta("og:site_name") ?? meta("application-name"),
    blocks, links: [...links], visual,
    textLength: textOf(body).length,
  };
}

function absolutize(href: string | null, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch { return null; }
}

function bareHost(h: string) { return h.toLowerCase().replace(/^www\./, ""); }
export function sameSite(a: string, b: string): boolean {
  try { return bareHost(new URL(a).hostname) === bareHost(new URL(b).hostname); } catch { return false; }
}

const SKIP_PATH = /(login|connexion|signin|sign-in|signup|sign-up|inscription|register|auth|admin|account|compte|dashboard|logout|deconnexion|api\/|cart|panier|checkout|paiement|wp-admin|\.(pdf|zip|png|jpe?g|gif|webp|svg|mp4|mp3|xml|json)$)/i;
const PRIORITY_PATH = /(tarif|pricing|prix|price|plan|fonctionnal|feature|produit|product|service|solution|offre|about|a-propos|apropos)/i;

/** Pages liées du même site à lire (profondeur 1), hors pages privées ou de connexion. */
export function pickSubpages(links: string[], homeUrl: string, max = ANALYZER_LIMITS.maxPages - 1): string[] {
  const home = new URL(homeUrl);
  const seen = new Set<string>([home.origin + home.pathname]);
  const candidates: string[] = [];
  for (const l of links) {
    try {
      const u = new URL(l);
      if (!sameSite(l, homeUrl) || u.search || SKIP_PATH.test(u.pathname)) continue;
      const key = u.origin + u.pathname;
      if (seen.has(key) || u.pathname === "/" ) continue;
      seen.add(key);
      candidates.push(u.toString());
    } catch { /* ignoré */ }
  }
  candidates.sort((a, b) => Number(PRIORITY_PATH.test(new URL(b).pathname)) - Number(PRIORITY_PATH.test(new URL(a).pathname)));
  return candidates.slice(0, max);
}

// ---------- Classement ----------

const FUTURE_RE = /(^|[^\p{L}])(bient[ôo]t( disponible)?|prochainement|à venir|a venir|coming soon|en cours de développement|en développement|disponible sous peu|pas encore disponible|not yet available)(?=$|[^\p{L}])/iu;
const CTA_RE = /^(commencer|commence|essayer|essaie|créer|crée|découvrir|découvre|démarrer|démarre|s['’]inscrire|inscris|rejoindre|rejoins|voir|obtenir|obtiens|choisir|choisis|passer|contacter|contacte|parler|écris|télécharger|demander|réserver|start|get|try|sign up|join|book|contact|buy|acheter|j['’]ai déjà)/i;
const AUDIENCE_RE = /(^|[^\p{L}])(pour les|pour tous les|destinée? aux?|conçue? pour|pensée? pour|réservée? aux?|built for|designed for|made for)\s+\p{L}/iu;

export function isFutureMention(text: string): boolean { return FUTURE_RE.test(text); }
function stripFuture(text: string) {
  const out = text.replace(new RegExp(FUTURE_RE.source, "giu"), "$1").replace(/^[\s,;:·–—-]+|[\s,;:·–—-]+$/g, "").replace(/\s+/g, " ").trim();
  return out.length >= 4 ? out : "";
}
function norm(t: string) { return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }

function classify(text: string, pricing: boolean): { status: ClaimStatus; note: string; text: string } {
  if (isFutureMention(text)) return { status: "a_venir", note: "Le site indique explicitement que c'est une fonction future.", text: stripFuture(text) };
  if (pricing) return { status: "a_verifier", note: "Mentionné dans une offre tarifaire : la disponibilité réelle n'est pas prouvée par cette seule mention.", text };
  return { status: "confirmee", note: "Texte présent sur la page source.", text };
}

const CAPS: Record<ClaimCategory, number> = { identite: 2, description: 3, offre: 20, fonctionnalite: 40, public_cible: 6, argument: 16, cta: 12 };

export function buildReport(url: string, pages: ExtractedPage[], pageStatus: AnalyzedPage[], now: Date = new Date()): AnalysisReport {
  const claims: Claim[] = [];
  const seen = new Set<string>();
  const count = (c: ClaimCategory) => claims.filter((x) => x.category === c).length;
  const warnings: string[] = [];
  const add = (c: Omit<Claim, "excerpt"> & { excerpt?: string }) => {
    const key = c.category + "|" + norm(c.text);
    if (!norm(c.text) || seen.has(key) || count(c.category) >= CAPS[c.category]) return;
    seen.add(key);
    claims.push({ ...c, text: c.text.slice(0, 300), excerpt: (c.excerpt ?? c.text).slice(0, 220) });
  };

  const home = pages[0];
  if (home) {
    if (home.siteName) add({ category: "identite", text: home.siteName, status: "confirmee", note: "Nom déclaré dans les métadonnées du site.", sourceUrl: home.url });
    else if (home.title) {
      const brand = home.title.split(/\s[—–|\-:·]\s/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.length - b.length)[0] ?? home.title;
      add({ category: "identite", text: brand, status: "a_verifier", note: "Déduit du titre de la page, à confirmer.", excerpt: home.title, sourceUrl: home.url });
    }
  }
  const OFFER_NOTE = "Offre ou prix affiché par le site (le prix ne prouve pas les fonctions incluses).";
  let offer: { text: string; hasPrice: boolean; url: string } | null = null;
  const flushOffer = () => {
    if (offer?.hasPrice) add({ category: "offre", text: offer.text, status: "confirmee", note: OFFER_NOTE, sourceUrl: offer.url });
    offer = null;
  };
  for (const p of pages) {
    flushOffer();
    if (p.description) add({ category: "description", text: p.description, status: "confirmee", note: "Description déclarée dans les métadonnées de la page.", sourceUrl: p.url });
    for (const b of p.blocks) {
      const ctaText = b.text.length <= 40;
      if ((b.tag === "button" || b.tag === "a") && ctaText && CTA_RE.test(b.text)) {
        add({ category: "cta", text: b.text, status: "confirmee", note: b.href ? "Bouton ou lien visible sur la page." : "Bouton visible sur la page.", sourceUrl: p.url, ...(b.href ? { href: b.href } : {}) });
        continue;
      }
      if (b.tag === "a" || b.tag === "button") continue;
      if (AUDIENCE_RE.test(b.text) && b.text.length <= 300) {
        const c = classify(b.text, false);
        add({ category: "public_cible", text: c.text, status: c.status === "confirmee" ? "confirmee" : c.status, note: c.status === "confirmee" ? "Public mentionné explicitement par le site." : c.note, excerpt: b.text, sourceUrl: p.url });
      }
      if (b.pricing && /^h[2-4]$/.test(b.tag) && b.text.length <= 80) {
        flushOffer();
        offer = { text: b.text, hasPrice: false, url: p.url };
        continue;
      }
      if (b.pricing && b.tag === "p" && PRICE_RE.test(b.text) && b.text.length <= 160) {
        if (offer) { offer.text += " · " + b.text; offer.hasPrice = true; }
        else add({ category: "offre", text: b.text, status: "confirmee", note: OFFER_NOTE, sourceUrl: p.url });
        continue;
      }
      if (b.tag === "li" && /^\s*<a\b[\s\S]*<\/a>\s*$/i.test(b.inner)) continue; // menu
      if (b.tag === "li" || b.tag === "h3" || b.tag === "h4") {
        if (b.text.length < 6 || b.text.length > 220) continue;
        const c = classify(b.text, b.pricing);
        add({ category: "fonctionnalite", text: c.text, status: c.status, note: c.note, excerpt: b.text, sourceUrl: p.url });
        continue;
      }
      if (b.tag === "h1" || b.tag === "h2" || (b.tag === "p" && b.text.length >= 40 && b.text.length <= 300)) {
        const c = classify(b.text, b.pricing);
        add({ category: "argument", text: c.text, status: c.status, note: c.status === "confirmee" ? "Argument écrit tel quel sur la page." : c.note, excerpt: b.text, sourceUrl: p.url });
      }
    }
    flushOffer();
    if (p.textLength < 300) warnings.push(`Peu de texte lisible sur ${p.url} : le contenu est peut-être chargé par JavaScript et n'a pas pu être lu.`);
  }

  const src = home?.url ?? url;
  const missing: [ClaimCategory, string][] = [
    ["identite", "Aucun nom de marque explicite trouvé."],
    ["description", "Aucune description déclarée trouvée."],
    ["offre", "Aucune offre ou tarif identifiable trouvé."],
    ["fonctionnalite", "Aucune fonctionnalité listée trouvée."],
    ["public_cible", "Aucun public cible explicitement identifié."],
    ["argument", "Aucun argument explicite trouvé."],
    ["cta", "Aucun appel à l'action trouvé."],
  ];
  for (const [cat, msg] of missing) if (count(cat) === 0) claims.push({ category: cat, text: msg, status: "introuvable", excerpt: "", sourceUrl: src, note: "Recherché sur les pages lues, sans résultat." });
  for (const cat of Object.keys(CAPS) as ClaimCategory[]) if (count(cat) >= CAPS[cat]) warnings.push(`Liste « ${CATEGORY_LABELS[cat]} » limitée à ${CAPS[cat]} éléments.`);
  for (const s of pageStatus) if (!s.ok) warnings.push(`Page non lue : ${s.url} (${s.error ?? "erreur"}).`);
  for (const s of pageStatus) if (s.truncated) warnings.push(`Page tronquée à ${Math.round(ANALYZER_LIMITS.maxBytesPerPage / 1000)} ko : ${s.url}.`);

  const visual = pages.reduce<VisualIdentity>((acc, p) => ({
    themeColor: acc.themeColor ?? p.visual.themeColor,
    colors: [...new Set([...acc.colors, ...p.visual.colors])].slice(0, 8),
    fonts: [...new Set([...acc.fonts, ...p.visual.fonts])].slice(0, 6),
    ogImage: acc.ogImage ?? p.visual.ogImage,
    favicon: acc.favicon ?? p.visual.favicon,
  }), { themeColor: null, colors: [], fonts: [], ogImage: null, favicon: null });

  return {
    version: 1,
    url,
    analyzedAt: now.toISOString(),
    pages: pageStatus,
    claims,
    visual,
    warnings: [...new Set(warnings)],
    limits: [
      "Seul le contenu public, sans connexion, est lu : HTML initial de la page d'accueil et de 4 pages liées au maximum (profondeur 1).",
      "Le texte chargé uniquement par JavaScript, les images et les vidéos ne sont pas analysés.",
      "Une mention dans une offre tarifaire n'est pas une preuve que la fonction est disponible.",
      "Le classement est automatique et littéral : aucune information n'est ajoutée ni déduite, et les instructions éventuellement écrites dans les pages sont ignorées.",
      "Le public cible n'est indiqué que s'il est écrit explicitement.",
    ],
  };
}
