import { useMemo, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  AlertTriangle,
  ListChecks,
  ClipboardCheck,
  FileText,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  GraduationCap,
  Users,
  UsersRound,
  Settings,
  Compass,
  Radar,
  Handshake,
  Target,
  Shuffle,
  Workflow,
  GitBranch,
  Truck,
  Factory,
  MessageSquare,
  IdCard,
  BookOpen,
  Gauge,
  LifeBuoy,
  ChevronDown,
  Lock,
  Gavel,
  Flag,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { JawdaLogo } from "@/components/brand/logo";
import { navTop, navGroups, navFooter, mockPlanos, mockNCs, type NavItem } from "@/lib/mock-data";
import { useEnabledModules } from "@/lib/queries/contract";
import { moduleForRoute } from "@/lib/module-access";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  AlertTriangle,
  ListChecks,
  ClipboardCheck,
  FileText,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  GraduationCap,
  Users,
  UsersRound,
  Settings,
  Compass,
  Radar,
  Handshake,
  Target,
  Shuffle,
  Workflow,
  GitBranch,
  Truck,
  Factory,
  MessageSquare,
  IdCard,
  BookOpen,
  Gauge,
  LifeBuoy,
  Gavel,
  Flag,
};

function useBadge(to: string): number | null {
  if (to === "/planos-de-acao") {
    const n = mockPlanos.filter((p) => p.status === "Atrasado").length;
    return n > 0 ? n : null;
  }
  if (to === "/nao-conformidades") {
    const n = mockNCs.filter((n) => n.slaStatus === "vencido").length;
    return n > 0 ? n : null;
  }
  return null;
}

function isItemActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function NavRow({
  item,
  active,
  collapsed,
  locked,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  locked: boolean;
}) {
  const Icon = iconMap[item.icon] ?? LayoutDashboard;
  const badge = useBadge(item.to);

  // Módulo não contratado: sem cadeado e "falar com a Jáwda" (seção 4/7 do
  // Guia). Item continua visível (dá noção do produto completo), mas não é
  // um <Link> — clicar não navega, o bloqueio de verdade é o ModuleGate na
  // rota (defesa em profundidade: cadeado aqui é só UX, quem impede acesso
  // de fato é o gate + RLS de contract_modules).
  if (locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled
          tooltip="Disponível mediante contratação — fale com a Jáwda"
          className="h-9 cursor-not-allowed rounded-lg text-muted-foreground/60"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span className="truncate">{item.label}</span>
          {!collapsed && <Lock className="ml-auto h-3.5 w-3.5" />}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="h-9 rounded-lg data-[active=true]:bg-brand-soft data-[active=true]:text-brand data-[active=true]:font-medium hover:bg-brand-soft/60"
      >
        <Link to={item.to}>
          <Icon className="h-[18px] w-[18px]" />
          <span className="truncate">{item.label}</span>
          {!collapsed && badge !== null && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--severity-critical)] px-1.5 text-[10px] font-semibold text-white">
              {badge}
            </span>
          )}
          {!collapsed && item.externo && (
            <span
              className="ml-auto rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
              title="Integração externa: dados vêm de sistema já existente"
            >
              Externo
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { data: enabledModules } = useEnabledModules();

  // Enquanto o contrato ainda carrega (enabledModules undefined), nada
  // aparece bloqueado — mesmo critério do ModuleGate, evita cadeado
  // piscando no primeiro carregamento da página.
  const isLocked = (to: string) => {
    if (!enabledModules) return false;
    const module = moduleForRoute(to);
    return module !== null && !enabledModules.has(module);
  };

  const activeGroupIdx = useMemo(() => {
    return navGroups.findIndex((g) => g.items.some((it) => isItemActive(pathname, it.to)));
  }, [pathname]);

  const [openIdx, setOpenIdx] = useState<number>(activeGroupIdx >= 0 ? activeGroupIdx : 0);
  // when nav changes to a different group, auto-open it
  const effectiveOpen = activeGroupIdx >= 0 ? activeGroupIdx : openIdx;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <JawdaLogo showWordmark={!collapsed} size={26} />
      </SidebarHeader>
      <SidebarContent className="px-2">
        {/* Top single item */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <NavRow
                item={navTop}
                active={isItemActive(pathname, navTop.to)}
                collapsed={collapsed}
                locked={isLocked(navTop.to)}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Groups */}
        {navGroups.map((group, idx) => {
          const GroupIcon = iconMap[group.icon] ?? Compass;
          const open = effectiveOpen === idx;
          const hasActive = group.items.some((it) => isItemActive(pathname, it.to));
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {/* Group header */}
                  {collapsed ? (
                    // In collapsed mode: render items directly with tooltips
                    group.items.map((item) => (
                      <NavRow
                        key={item.to}
                        item={item}
                        active={isItemActive(pathname, item.to)}
                        collapsed
                        locked={isLocked(item.to)}
                      />
                    ))
                  ) : (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => {
                            setOpenIdx(idx);
                            const first = group.items[0];
                            if (first) navigate({ to: first.to });
                          }}
                          className={cn(
                            "h-9 rounded-lg text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-brand-soft/40",
                            hasActive && "text-brand",
                          )}
                        >
                          <GroupIcon className="h-[16px] w-[16px]" />
                          <span className="truncate">{group.label}</span>
                          <ChevronDown
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setOpenIdx(open ? -1 : idx);
                            }}
                            className={cn(
                              "ml-auto h-4 w-4 shrink-0 cursor-pointer rounded transition-transform hover:bg-brand-soft",
                              open && "rotate-180",
                            )}
                          />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {open &&
                        group.items.map((item) => (
                          <div key={item.to} className="pl-3">
                            <NavRow
                              item={item}
                              active={isItemActive(pathname, item.to)}
                              collapsed={false}
                              locked={isLocked(item.to)}
                            />
                          </div>
                        ))}
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
        <SidebarMenu className="gap-1">
          {navFooter.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              active={isItemActive(pathname, item.to)}
              collapsed={collapsed}
              locked={isLocked(item.to)}
            />
          ))}
        </SidebarMenu>
        {!collapsed && (
          <div className="mt-3 px-2 text-[10px] text-muted-foreground">v1.0 · Jáwda Quality</div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
