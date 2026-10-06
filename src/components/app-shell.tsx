import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Bot, ContactRound, CreditCard, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const nav = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: ContactRound, label: "Prospects", to: "/prospects" },
  { icon: Bot, label: "Assistant IA", to: "/assistant" },
  { icon: BarChart3, label: "Statistiques", to: "/statistiques" },
  { icon: GraduationCap, label: "Académie", to: "/academie" },
  { icon: Users, label: "Former mon équipe", to: "/former-equipe" },
  { icon: CreditCard, label: "Abonnement", to: "/abonnement" },
  { icon: Settings, label: "Paramètres", to: "/parametres" },
] as const;

const planLabels: Record<string, string> = { gratuit: "Gratuit", pro: "Pro", expert: "Expert", business: "Business" };

export function AppShell({ children, user, title }: { children: React.ReactNode; user: User; title: string }) {
  const location = useLocation();
  const [plan, setPlan] = useState<string>("gratuit");
  const [isAdmin, setIsAdmin] = useState(false);
  const displayName = String(user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "Networker");
  const items = isAdmin ? [...nav, { icon: ShieldCheck, label: "Admin", to: "/admin" }] : nav;

  useEffect(() => {
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.plan) setPlan(data.plan);
    });
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <main className="min-h-screen bg-background pb-20 lg:pl-64 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="p-6"><Brand /></div>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {items.map(({ icon: Icon, label, to }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={label}
                to={to}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${active ? "bg-primary/12 font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Icon className="size-4" />{label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-4 flex items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="size-4" /> Se déconnecter
        </button>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Menu className="size-5 text-muted-foreground" />
            <Brand compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs text-muted-foreground">Espace de travail</p>
            <p className="text-sm font-bold">{title}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground">Plan {planLabels[plan] ?? plan}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-primary/15 font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">
        {nav.slice(0, 5).map(({ icon: Icon, label, to }) => {
          const active = location.pathname === to;
          return (
            <Link key={label} to={to} aria-label={label} className={`flex w-16 flex-col items-center gap-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="size-5" />
              <span>{label === "Assistant IA" ? "Assistant" : label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
