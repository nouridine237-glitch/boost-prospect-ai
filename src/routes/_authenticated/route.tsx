import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { onboardingOptions } from "@/lib/onboarding";
import { OnboardingProvider } from "@/components/onboarding";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { claimReferral } from "@/lib/referral.functions";
import { clearRef, readRef } from "@/lib/referral-capture";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    await context.queryClient.ensureQueryData(onboardingOptions(data.user.id));
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const claim = useServerFn(claimReferral);
  useEffect(() => {
    const code = readRef();
    if (!code) return;
    claim({ data: { code } }).then(() => clearRef()).catch(() => {});
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <OnboardingProvider key={user.id} userId={user.id}><Outlet /></OnboardingProvider>;
}