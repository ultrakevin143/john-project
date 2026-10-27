"use client";
import { WorkspaceProviders } from "@/app-shell/providers";
import { AuditView } from "@/features/audit/audit.screen";
import { Login } from "@/features/auth/login";
import { SecuritySettings } from "@/features/auth/security-settings";
import { GovernanceView } from "@/features/governance/governance.screen";
import { IntegrationsView } from "@/features/integrations/integrations.screen";
import { OperationsView } from "@/features/operations/operations.screen";
import { OverviewView } from "@/features/overview/overview.screen";
import { QualityView } from "@/features/quality/quality.screen";
import { ReferenceView } from "@/features/reference/reference.screen";
import { ReliabilityView } from "@/features/reliability/reliability.screen";
import { ReportsView } from "@/features/reports/reports.screen";
import { UsersView } from "@/features/users/users.screen";
import { NetworkView } from "@/features/water-balance/water-balance.screen";
import { ApiFailure, api } from "@/shared/api/client";
import { type Envelope, type User } from "@/shared/api/contracts";
import { Alert, Button, Loading, Sheet } from "@/shared/ui/index";
import { Droplets, LogOut, Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Toaster, toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

export function Workspace() {
  return (
    <WorkspaceProviders>
      <Suspense
        fallback={
          <main className="boot">
            <Loading />
          </main>
        }
      >
        <SessionWorkspace />
      </Suspense>
    </WorkspaceProviders>
  );
}
export function SessionWorkspace() {
  const path = usePathname() ?? "/overview",
    recordId = useSearchParams().get("record"),
    {
      data,
      error,
      isLoading,
      mutate: reloadUser,
    } = useSWR<Envelope<User>>("/auth/me"),
    { mutate } = useSWRConfig(),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(false),
    [loggingOut, setLoggingOut] = useState(false),
    [securitySettings, setSecuritySettings] = useState(false);
  if (isLoading)
    return (
      <main className="boot">
        <Loading />
      </main>
    );
  if (error && !(error instanceof ApiFailure && error.status === 401))
    return (
      <main className="boot">
        <Alert title="The API is unavailable">
          <p>{error.message}</p>
          <Button onClick={() => reloadUser()}>Connect again</Button>
        </Alert>
      </main>
    );
  const user = data?.data;
  if (!user)
    return (
      <>
        <Login
          onLogin={(u) => reloadUser({ data: u }, { revalidate: false })}
        />
        <Toaster richColors />
      </>
    );
  const can = (p: string) => user.permissions.includes(p),
    nav = [
      { href: "/overview", name: "Overview", show: true },
      { href: "/network", name: "Water balance", show: can("reports:nrw") },
      { href: "/operations", name: "Operations", show: true },
      { href: "/reference", name: "Reference setup", show: true },
      {
        href: "/integrations",
        name: "Integrations",
        show: can("integrations:read"),
      },
      { href: "/quality", name: "Data quality", show: can("dq:read") },
      { href: "/governance", name: "Governance", show: can("governance:read") },
      { href: "/audit", name: "Audit", show: can("audit:read") },
      { href: "/reports", name: "Reports", show: can("reports:read") },
      { href: "/users", name: "Users", show: user.roleCode === "admin" },
    ].filter((n) => n.show);
  const navigation = (
    <>
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setMenu(false)}
          aria-current={
            path === n.href || path.startsWith(n.href + "/")
              ? "page"
              : undefined
          }
        >
          {n.name}
        </Link>
      ))}
    </>
  );
  let content: React.ReactNode;
  if (path === "/" || path === "/overview")
    content = <OverviewView user={user} />;
  else if (path === "/network" && can("reports:nrw")) content = <NetworkView />;
  else if (path === "/reference") content = <ReferenceView user={user} />;
  else if (path === "/users" && user.roleCode === "admin")
    content = <UsersView user={user} />;
  else if (
    path === "/reliability" &&
    can("domain:metering") &&
    can("reports:read")
  )
    content = <ReliabilityView />;
  else if (path.startsWith("/operations"))
    content = (
      <OperationsView
        key={`${path}:${recordId ?? ""}`}
        user={user}
        entity={path.split("/")[2]}
        initialRecordId={recordId}
      />
    );
  else if (path === "/integrations" && can("integrations:read"))
    content = <IntegrationsView user={user} />;
  else if (path === "/quality" && can("dq:read"))
    content = <QualityView user={user} />;
  else if (path === "/governance" && can("governance:read"))
    content = <GovernanceView user={user} />;
  else if (path === "/audit" && can("audit:read")) content = <AuditView />;
  else if (path === "/reports" && can("reports:read"))
    content = <ReportsView user={user} />;
  else
    content = (
      <Alert title="Page unavailable">
        This page does not exist or your role does not have access. Use the
        navigation to open an available workspace.
      </Alert>
    );
  return (
    <div className={`app${dark ? " dark" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <Link href="/overview" className="brand">
          <Droplets size={27} />
          <span>
            Water Utility<strong>Data Hub</strong>
          </span>
        </Link>
        <nav aria-label="Workspace" className="desktop-nav">
          {navigation}
        </nav>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSecuritySettings(true)}
          >
            Security settings
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            onClick={() => {
              setDark(!dark);
              document.documentElement.classList.toggle("dark", !dark);
            }}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={22} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loggingOut}
            aria-label="Sign out"
            onClick={async () => {
              setLoggingOut(true);
              try {
                await api("/auth/logout", { method: "POST" });
                await mutate(() => true, undefined, { revalidate: false });
                await reloadUser(
                  { data: undefined as unknown as User },
                  { revalidate: false },
                );
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Sign-out failed.",
                );
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            <LogOut size={15} />
            <span className="logout-label">Sign out</span>
          </Button>
        </div>
      </header>
      <Sheet title="Workspace navigation" open={menu} onOpenChange={setMenu}>
        <div className="sheet-brand">
          <Droplets />
          Water Utility Data Hub
        </div>
        <nav className="mobile-nav" aria-label="Mobile workspace">
          {navigation}
        </nav>
      </Sheet>
      <div className="district-strip">
        <span>Cebu · Demonstration Water Utility</span>
        <span>
          {user.name} <span className="strip-divider">/</span> {user.role}
        </span>
      </div>
      <main id="main-content" className="main-content">
        {securitySettings ? (
          <SecuritySettings
            close={() => setSecuritySettings(false)}
            signedOut={() => {
              setSecuritySettings(false);
              void mutate(() => true, undefined, { revalidate: false });
              void reloadUser(
                { data: undefined as unknown as User },
                { revalidate: false },
              );
            }}
          />
        ) : (
          content
        )}
      </main>
      <footer className="app-footer">
        <span>Water Utility Data Hub</span>
        <span>Synthetic records · Manila time (PHT) · Refresh on demand</span>
      </footer>
      <Toaster richColors theme={dark ? "dark" : "light"} />
    </div>
  );
}
