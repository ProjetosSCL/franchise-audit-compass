import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/dashboard.functions";
import {
  FileOutput,
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/", label: "Painel geral", icon: LayoutDashboard },
  { to: "/importar", label: "Importar", icon: UploadCloud },
  { to: "/tendencia", label: "Tendência", icon: TrendingUp },
  { to: "/contestacao", label: "Contestação", icon: FileOutput },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerState = useRouterState();
  const [email, setEmail] = useState<string | null>(null);
  const dashboardFn = useServerFn(getDashboard);
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardFn() });
  const searchMonth = routerState.location.search.month;
  const now = new Date();
  const month = typeof searchMonth === "string" ? searchMonth : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b px-5">
          <span className="text-base font-semibold tracking-tight">SCL Audit</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.to === "/"
                ? routerState.location.pathname === "/"
                : routerState.location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <details className="group mt-2 border-t pt-2">
            <summary className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent">
              <Building2 className="h-4 w-4" />
              Detalhe da franquia
            </summary>
            <div className="mt-1 flex flex-col gap-1">
              {data?.franchises.map((franchise) => (
                <Link key={franchise.id} to="/franquia/$franchiseId/$month" params={{ franchiseId: franchise.id, month }} className="rounded-md py-2 pl-10 pr-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                  {franchise.display_name}
                </Link>
              ))}
            </div>
          </details>
        </nav>
        <div className="border-t p-3">
          <div className="truncate px-3 pb-2 text-xs text-muted-foreground">{email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
