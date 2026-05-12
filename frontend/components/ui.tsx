import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type React from "react";

type Children = {
  children: React.ReactNode;
};

export function IconBadge({
  icon: Icon,
  tone = "secondary"
}: {
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "neutral";
}) {
  return (
    <div
      className={clsx(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
        tone === "primary" && "bg-primary-container text-on-primary-container",
        tone === "secondary" && "bg-secondary-container/80 text-on-secondary-container",
        tone === "neutral" && "bg-surface-container-high text-on-surface-variant"
      )}
    >
      <Icon size={20} />
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary"
}: Children & {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition",
        variant === "primary" && "bg-primary text-on-primary hover:opacity-90",
        variant === "secondary" &&
          "border border-outline-variant bg-white text-on-surface hover:bg-surface-container-low",
        variant === "ghost" && "text-on-surface-variant hover:text-primary"
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className
}: Children & {
  className?: string;
}) {
  return (
    <section className={clsx("rounded-xl border border-outline-variant bg-white p-6 shadow-soft", className)}>
      {children}
    </section>
  );
}

export function StatusPill({
  children,
  tone = "success"
}: Children & {
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "success" && "bg-emerald-50 text-emerald-900",
        tone === "warning" && "bg-amber-50 text-amber-800",
        tone === "neutral" && "bg-surface-container-high text-on-surface-variant"
      )}
    >
      {children}
    </span>
  );
}

export function PageTitle({
  eyebrow,
  title,
  children
}: Children & {
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="mb-stack-lg flex flex-col gap-stack-md md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-1 text-label-caps uppercase tracking-wider text-secondary">{eyebrow}</p>
        <h1 className="font-heading text-headline-lg text-on-surface">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Bars({
  values,
  labels,
  activeIndex
}: {
  values: number[];
  labels?: string[];
  activeIndex?: number;
}) {
  return (
    <>
      <div className="flex h-64 w-full items-end gap-2 px-2">
        {values.map((value, index) => (
          <div
            key={value + index}
            className={clsx(
              "flex-1 rounded-t transition-colors",
              activeIndex === index ? "bg-primary" : "bg-surface-container-high hover:bg-primary-fixed-dim"
            )}
            style={{ height: `${value}%` }}
          />
        ))}
      </div>
      {labels && (
        <div className="mt-4 flex justify-between px-2 text-[10px] font-mono text-on-surface-variant">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </>
  );
}

export function ProgressBar({
  value,
  color = "bg-secondary"
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
      <div className={clsx("h-full rounded-full", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function FieldLabel({ children }: Children) {
  return <label className="ml-1 text-body-sm font-medium text-on-surface">{children}</label>;
}
