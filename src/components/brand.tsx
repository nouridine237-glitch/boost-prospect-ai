import { Sparkles } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow">
        <Sparkles className="size-4" />
      </span>
      {!compact && <span className="text-base font-extrabold text-foreground">MLM Boost AI</span>}
    </div>
  );
}