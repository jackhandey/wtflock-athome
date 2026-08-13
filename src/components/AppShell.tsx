import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Gauge,
  ListFilter,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Settings as SettingsIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { listAlerts } from "@/lib/alerts.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Live", icon: Gauge },
  { to: "/events", label: "Events", icon: ListFilter },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert },
  { to: "/watchlist", label: "Watchlist", icon: ShieldCheck },
  { to: "/cameras", label: "Cameras", icon: Camera },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const fetchAlerts = useServerFn(listAlerts);

  const { data: openAlerts } = useQuery({
    queryKey: ["alerts", "open"],
    queryFn: () => fetchAlerts({ data: { openOnly: true } }),
    refetchInterval: 20000,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="plate text-sm font-semibold">HOMEWATCH</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.to === "/alerts" && openAlerts && openAlerts.length > 0 ? (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                      {openAlerts.length}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
