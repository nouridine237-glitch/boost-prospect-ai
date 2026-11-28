import { ExternalLink, FileCheck } from "lucide-react";
import { CATEGORY_LABELS, STATUS_LABELS, validatePublicUrl, type AnalysisReport } from "@/lib/url-analyzer";
import { announcedAvailability } from "@/lib/ad-studio.schemas";

export function AnalysisReportView({ report }: { report: AnalysisReport }) {
  return <section className="min-w-0 space-y-6">
    <div className="border-b border-border pb-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FileCheck className="size-5 text-primary" />Rapport source</h2>
      <p className="mt-2 text-xs text-muted-foreground">Une source confirme une déclaration, pas le fonctionnement réel. Les tarifs ne prouvent pas la disponibilité.</p>
      <p className="mt-2 text-xs text-muted-foreground">Analyse du {new Date(report.analyzedAt).toLocaleString("fr-FR")}</p>
    </div>
    {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
      const claims = report.claims.filter((claim) => claim.category === category);
      return <section key={category} className="space-y-3"><h3 className="text-sm font-semibold">{label}</h3>
        {claims.map((claim, index) => {
          const availability = announcedAvailability(claim.excerpt || claim.text);
          const source = validatePublicUrl(claim.sourceUrl);
          const status = availability === "developpement" ? "En développement (annoncé)" : STATUS_LABELS[claim.status];
          return <article key={`${category}-${index}`} className="rounded-md border border-border bg-card p-4">
            <span className={`text-xs font-medium ${claim.status === "confirmee" ? "text-info" : "text-warning"}`}>{status}</span>
            <p className="mt-2 break-words text-sm font-medium">{claim.text}</p>
            {claim.excerpt && <blockquote className="mt-3 border-l-2 border-border pl-3 text-xs text-muted-foreground">« {claim.excerpt} »</blockquote>}
            <p className="mt-2 text-xs text-muted-foreground">{claim.note}</p>
            {source.ok && <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 text-xs text-primary"><ExternalLink className="size-3 shrink-0" /><span className="truncate">{claim.sourceUrl}</span></a>}
          </article>;
        })}
      </section>;
    })}
    <section className="border-t border-border pt-4"><h3 className="text-sm font-semibold">Identité détectée</h3><p className="mt-2 text-xs text-muted-foreground">Polices : {report.visual.fonts.join(", ") || "Introuvable"}</p><p className="mt-1 break-words text-xs text-muted-foreground">Couleurs déclarées : {report.visual.colors.join(", ") || "Introuvable"}</p></section>
    {report.warnings.length > 0 && <section className="border-t border-border pt-4"><h3 className="text-sm font-semibold text-warning">Limites de lecture</h3><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{report.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
  </section>;
}