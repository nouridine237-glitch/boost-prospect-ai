import { z } from "zod";

export const analysisReportSchema = z.object({
  version: z.literal(1), url: z.string().max(2048), analyzedAt: z.string().max(100),
  pages: z.array(z.object({ url: z.string().max(2048), ok: z.boolean(), httpStatus: z.number().optional(), title: z.string().max(1000).optional(), error: z.string().max(2000).optional(), truncated: z.boolean().optional() })).max(5),
  claims: z.array(z.object({
    category: z.enum(["identite", "description", "offre", "fonctionnalite", "public_cible", "argument", "cta"]),
    text: z.string().max(1000), status: z.enum(["confirmee", "a_verifier", "a_venir", "introuvable"]),
    excerpt: z.string().max(1000), sourceUrl: z.string().max(2048), note: z.string().max(2000), href: z.string().max(2048).optional(),
  })).max(150),
  visual: z.object({ themeColor: z.string().nullable(), colors: z.array(z.string()).max(8), fonts: z.array(z.string()).max(6), ogImage: z.string().nullable(), favicon: z.string().nullable() }),
  warnings: z.array(z.string().max(3000)).max(100), limits: z.array(z.string().max(3000)).max(30),
});

export const saveAnalysisNotesSchema = z.object({ id: z.string().uuid(), notes: z.string().max(12000), version: z.number().int().nonnegative() });

export function announcedAvailability(text: string): "developpement" | "futur" | "non_precisee" {
  if (/(en (cours de )?développement|in development|under development)/i.test(text)) return "developpement";
  if (/(bient[oô]t|prochainement|à venir|coming soon|not yet available|pas encore disponible)/i.test(text)) return "futur";
  return "non_precisee";
}