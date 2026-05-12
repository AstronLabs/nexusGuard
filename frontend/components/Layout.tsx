import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import type React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  FileText,
  Gavel,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Shield,
  Users,
  Vote,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  activeOn?: string[];
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, activeOn: ["/dashboard", "/analytics"] },
  { href: "/claims/new", label: "Claims", icon: Gavel, activeOn: ["/claims/new"] },
  { href: "/governance", label: "Governance", icon: Vote, activeOn: ["/governance"] },
  { href: "/analytics", label: "Liquidity", icon: BarChart3, activeOn: ["/analytics"] },
  { href: "#", label: "Settings", icon: Settings }
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-gutter">
          <Link href="/" className="font-heading text-headline-md font-bold text-on-surface">
            Nexus Guard
          </Link>
          <div className="hidden items-center gap-stack-lg md:flex">
            <Link className="text-label-caps font-semibold text-primary" href="/">
              Platform
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/governance">
              Governance
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/analytics">
              Analytics
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-stack-sm">
          <Wallet className="hidden text-on-surface-variant sm:block" size={20} />
          <Link className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary" href="/dashboard">
            Connect Wallet
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <Sidebar />
      <div className="flex min-h-screen flex-col md:ml-64">
        <AppHeader />
        <main className="mx-auto w-full max-w-container-max flex-1 p-margin-mobile md:p-margin-desktop">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

function Sidebar() {
  const router = useRouter();

  return (
    <aside className="fixed hidden h-screen w-64 flex-col border-r border-outline-variant bg-surface-container-low p-stack-md md:flex">
      <Link href="/" className="mb-stack-lg flex items-center gap-3 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <Shield size={18} />
        </div>
        <div>
          <h2 className="font-heading text-headline-md font-bold">Nexus Guard</h2>
          <p className="text-body-sm leading-none text-on-surface-variant">Institutional Micro-Insurance</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon, activeOn }) => {
          const active = activeOn?.includes(router.pathname);
          return (
            <Link
              key={label}
              href={href}
              className={clsx(
                "flex items-center gap-stack-md rounded-lg px-4 py-3 text-sm transition",
                active
                  ? "bg-secondary-container font-medium text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <Link
        href="/claims/new"
        className="mb-stack-md flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        <Plus size={18} />
        New Claim
      </Link>
      <div className="border-t border-outline-variant pt-stack-md">
        <a className="flex items-center gap-stack-md rounded-lg px-4 py-2 text-body-sm text-on-surface-variant hover:bg-surface-container-high">
          <BookOpen size={18} />
          Docs
        </a>
        <a className="flex items-center gap-stack-md rounded-lg px-4 py-2 text-body-sm text-on-surface-variant hover:bg-surface-container-high">
          <Users size={18} />
          Community
        </a>
      </div>
    </aside>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-container-max items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-stack-lg">
          <Menu className="md:hidden" size={22} />
          <div className="hidden items-center gap-stack-lg md:flex">
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/">
              Platform
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/governance">
              Governance
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="/analytics">
              Analytics
            </Link>
            <Link className="text-label-caps text-on-surface-variant hover:text-primary" href="#">
              Support
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-stack-sm">
          <Activity className="text-on-surface-variant" size={20} />
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-caps text-white hover:opacity-80">
            <Wallet size={18} />
            Connect Wallet
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto flex w-full max-w-container-max flex-col items-center justify-between gap-stack-md px-margin-mobile py-stack-lg md:flex-row md:px-margin-desktop">
        <div className="text-center md:text-left">
          <p className="font-heading text-headline-md font-bold text-primary">Nexus Guard</p>
          <p className="text-body-sm text-on-surface-variant">© 2024 Nexus Guard Protocol. Decentralized & Fully Audited.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-stack-md text-body-sm text-on-surface-variant">
          <a className="hover:text-primary">Privacy Policy</a>
          <a className="hover:text-primary">Terms of Service</a>
          <a className="hover:text-primary">Risk Disclosure</a>
          <a className="font-mono hover:text-primary">Whitepaper</a>
        </div>
      </div>
    </footer>
  );
}
