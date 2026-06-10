"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  ClipboardList,
  Receipt,
  Settings,
  LogOut,
  Anchor,
  Menu,
  X,
  ChevronDown,
  Bug,
  Wrench,
  ShieldAlert,
  Gavel,
  CalendarRange,
  CalendarOff,
  CalendarClock,
  Megaphone,
  ClipboardCheck,
  History,
  FileArchive,
  Gauge,
  BarChart3,
  PackageCheck,
  Undo2,
  ClipboardEdit,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/app/[locale]/(app)/actions";
import {
  canAccess,
  PERMISSION_DOMAINS,
  PERMISSION_TREE,
  planAllowsFeature,
  trialDaysRemaining,
  type StoredPermissions,
  type Role,
  type PlanAbonnement,
  type PlanFeature,
  type TenantStatut,
} from "@porttrack/shared";

// Routes dont la visibilité dépend d'une fonctionnalité de plan (V7 §15.2).
const HREF_TO_PLAN_FEATURE: Record<string, PlanFeature> = {
  "/planning": "planning",
};

// Map href (route locale-agnostique) → clé de sous-droit, pour filtrer le menu.
const HREF_TO_PERMISSION: Record<string, string> = {};
for (const d of PERMISSION_DOMAINS) {
  for (const sr of PERMISSION_TREE[d].subRights) HREF_TO_PERMISSION[sr.href] = sr.key;
}

type NavLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavLink[];
};

// Liens de tête (avant les groupes)
const NAV_TOP: NavLink[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
];

// Groupes repliables (accordéon)
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Exploitation",
    icon: Users,
    items: [
      { label: "Chauffeurs",   href: "/chauffeurs",   icon: Users },
      { label: "Équipes",      href: "/equipes",      icon: CalendarClock },
      { label: "Planning",     href: "/planning",     icon: CalendarRange },
      { label: "Absences",     href: "/absences",     icon: CalendarOff },
      { label: "Désignations", href: "/designations", icon: Megaphone },
      { label: "Check-lists",  href: "/checklists",   icon: ClipboardCheck },
      { label: "Accidents",    href: "/accidents",    icon: ShieldAlert },
      { label: "Infractions",  href: "/infractions",  icon: Gavel },
    ],
  },
  {
    label: "Flotte & Garage",
    icon: Truck,
    items: [
      { label: "Flotte", href: "/flotte", icon: Truck },
      { label: "Pannes", href: "/pannes", icon: Wrench },
    ],
  },
  {
    label: "Opérations conteneurs",
    icon: Package,
    items: [
      { label: "Tableau Opérations",  href: "/operations",   icon: Gauge },
      { label: "Conteneurs",          href: "/conteneurs",   icon: Package },
      { label: "Flux & affectations", href: "/affectations", icon: ClipboardList },
      { label: "Livraison",           href: "/livraisons",   icon: PackageCheck },
      { label: "Récupération",        href: "/recuperations", icon: Undo2 },
      { label: "Saisie opération",    href: "/saisie-operation", icon: ClipboardEdit },
    ],
  },
  {
    label: "Archives & Conformité",
    icon: FileArchive,
    items: [
      { label: "Archives EIR", href: "/eir",        icon: FileArchive },
      { label: "Traçabilité",  href: "/historique", icon: History },
    ],
  },
  {
    label: "Bilans",
    icon: BarChart3,
    items: [
      { label: "Activité aconiers", href: "/bilan-aconiers", icon: BarChart3 },
    ],
  },
];

// Routes réservées au Manager / Super Admin (masquées pour les autres profils,
// comme le tableau de bord). Le menu et les pages appliquent cette règle.
const MANAGER_ONLY_HREFS = new Set(["/dashboard", "/bilan-aconiers"]);

// Liens de pied (après les groupes)
const NAV_BOTTOM: NavLink[] = [
  { label: "Facturation", href: "/facturation", icon: Receipt, comingSoon: true },
  { label: "Paramètres",  href: "/parametres",  icon: Settings },
];

/** Une ligne de navigation (lien direct ou item de groupe). */
function NavRow({ item, active, onNavigate }: { item: NavLink; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const inner = (
    <span
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : item.comingSoon
            ? "text-muted-foreground/60 cursor-not-allowed"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" />
        {item.label}
      </span>
      {item.comingSoon && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Bientôt</Badge>
      )}
    </span>
  );
  if (item.comingSoon) return <div aria-disabled>{inner}</div>;
  return <Link href={item.href} onClick={onNavigate}>{inner}</Link>;
}

/** Bouton de déconnexion avec spinner pendant la soumission du form (server action). */
function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}

type AppShellProps = {
  children: React.ReactNode;
  userEmail: string;
  userName?: string | null;
  userRole: string;
  userPermissions?: StoredPermissions;
  tenantName: string | null;
  tenantPlan?: PlanAbonnement | null;
  tenantStatut?: TenantStatut | null;
  tenantTrialEnd?: string | null;
};

export function AppShell({
  children,
  userEmail,
  userName,
  userRole,
  userPermissions,
  tenantName,
  tenantPlan,
  tenantStatut,
  tenantTrialEnd,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // pathname inclut le préfixe locale (/fr/dashboard, /en/dashboard) — on
  // le retire pour matcher les hrefs (locale-agnostiques).
  const stripLocale = (p: string) => p.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";
  const cleanPath = stripLocale(pathname);
  const isActive = (href: string) => cleanPath === href || cleanPath.startsWith(href + "/");
  const closeMobile = () => setMobileOpen(false);

  // Identité affichée : « Prénom Nom » si connu, sinon l'email. Initiales du nom
  // quand on l'a (sinon 2 premières lettres de l'email).
  const displayName = userName?.trim() || userEmail;
  const initials = (
    userName?.trim()
      ? userName.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("")
      : userEmail.slice(0, 2)
  ).toUpperCase();

  // Filtrage du menu par droits. Manager/Super Admin voient tout. Les autres
  // ne voient que les sous-droits accordés. Tableau de bord = Manager seul ;
  // Paramètres/Facturation/Debug restent visibles par tous.
  const role = userRole as Role;
  const privileged = role === "MANAGER" || role === "SUPER_ADMIN";
  const perms = userPermissions ?? {};
  const canSee = (href: string): boolean => {
    // Gating par plan : s'applique à TOUS, y compris le Manager (c'est une
    // limite d'abonnement, pas une permission). Le SUPER_ADMIN n'a pas de tenant
    // → tenantPlan null → planAllowsFeature renvoie true (aucune restriction).
    const feature = HREF_TO_PLAN_FEATURE[href];
    if (feature && !planAllowsFeature(tenantPlan ?? null, feature)) return false;

    if (privileged) return true;
    const key = HREF_TO_PERMISSION[href];
    if (key) return canAccess(role, perms, key);
    if (MANAGER_ONLY_HREFS.has(href)) return false;
    return true;
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Backdrop mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Anchor className="size-4" />
            </span>
            PORTTRACK
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {/* Liens de tête */}
          {NAV_TOP.filter((item) => canSee(item.href)).map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} onNavigate={closeMobile} />
          ))}

          {/* Groupes repliables — le groupe contenant la page active est ouvert par défaut */}
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((it) => canSee(it.href));
            if (items.length === 0) return null; // groupe sans aucun droit → masqué
            const containsActive = items.some((it) => isActive(it.href));
            const isOpen = openGroups[group.label] ?? containsActive;
            const GroupIcon = group.icon;
            return (
              <div key={group.label}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroups((o) => ({ ...o, [group.label]: !isOpen }))}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    containsActive
                      ? "text-primary font-medium"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="size-4" />
                    {group.label}
                  </span>
                  <ChevronDown className={cn("size-4 transition-transform duration-[500ms] ease-in-out", isOpen && "rotate-180")} />
                </button>
                {/* Sous-menu animé : max-height + fondu (technique max-height bulletproof, contrairement à grid-rows qui peut snap selon le navigateur) */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-[500ms] ease-in-out",
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
                  )}
                >
                  <div className="ml-4 mt-1 space-y-1 border-l border-border/60 pl-2">
                    {items.map((it) => (
                      <NavRow key={it.href} item={it} active={isActive(it.href)} onNavigate={closeMobile} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Liens de pied */}
          {NAV_BOTTOM.filter((item) => canSee(item.href)).map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} onNavigate={closeMobile} />
          ))}

          {/* Debug — réservé au SUPER_ADMIN (outil interne PORTTRACK / Hinov) */}
          {userRole === "SUPER_ADMIN" && (
            <Link href="/debug" onClick={closeMobile} className="block pt-4">
              <span
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  cleanPath === "/debug"
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Bug className="size-4" />
                Debug session
              </span>
            </Link>
          )}
        </nav>

        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/70">PORTTRACK v0.1.0</p>
          <p>© 2026 PORTTRACK · Géré par Hinov Group</p>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
            {tenantName ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Espace de</span>
                <span className="text-sm font-medium">{tenantName}</span>
              </div>
            ) : userRole === "SUPER_ADMIN" ? (
              <Badge variant="info" className="text-xs">
                Mode SUPER_ADMIN — Tous les tenants
              </Badge>
            ) : null}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {initials}
              </span>
              <span className="hidden sm:inline">{displayName}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {userMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30"
                  aria-label="Fermer le menu"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Connecté en tant que
                    <div className="mt-0.5 font-medium text-foreground">{displayName}</div>
                    {userName?.trim() && <div className="mt-0.5 truncate">{userEmail}</div>}
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {userRole}
                      </Badge>
                    </div>
                  </div>
                  <div className="my-1 border-t" />
                  <form action={signOutAction}>
                    <SignOutButton />
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Bandeau essai (uniquement pendant un essai TRIAL en cours) */}
        {tenantStatut === "TRIAL" && (() => {
          const days = trialDaysRemaining(tenantTrialEnd ?? null);
          if (days === null) return null;
          const urgent = days <= 7;
          return (
            <div
              className={cn(
                "px-4 py-2 text-center text-sm lg:px-8",
                urgent ? "bg-amber-100 text-amber-900" : "bg-primary/5 text-foreground",
              )}
            >
              {days > 0 ? (
                <>Essai gratuit — il reste <strong>{days} jour{days > 1 ? "s" : ""}</strong>. Contactez PORTTRACK pour activer votre abonnement.</>
              ) : (
                <>Votre essai gratuit se termine <strong>aujourd&apos;hui</strong>. Contactez PORTTRACK pour continuer.</>
              )}
            </div>
          );
        })()}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
