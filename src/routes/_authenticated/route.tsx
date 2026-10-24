import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

/**
 * Gate de autenticação de todo o app. Rotas públicas: apenas /login e
 * /reset-password. Cada criança deste layout é protegida; as chamadas a
 * servidor vão com bearer token via attachSupabaseAuth (src/start.ts) e são
 * revalidadas por requireSupabaseAuth no servidor.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
