import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { onboardingOptions } from "@/lib/onboarding";
import { OnboardingProvider } from "@/components/onboarding";

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
  return <OnboardingProvider key={user.id} userId={user.id}><Outlet /></OnboardingProvider>;
}