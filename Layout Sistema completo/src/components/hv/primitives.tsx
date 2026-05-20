import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function OrnamentalDivider(_props?: { symbol?: string }) {
  return <div className="my-8" style={{ borderTop: "1px solid var(--border)" }} />;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-6 mb-8">
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-2.5">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        )}
        <h1 className="text-[22px] leading-[1.2] font-medium text-[#1a1a1f] tracking-[-0.02em]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-[13.5px] text-[var(--ink-500)] leading-relaxed max-w-2xl font-normal">
            {subtitle}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-[var(--ink-400)] mb-4">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {it.to ? (
            <Link to={it.to} className="hover:text-[#1a1a1f] transition-colors">
              {it.label}
            </Link>
          ) : (
            <span className="text-[#1a1a1f] font-medium">{it.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight size={12} className="text-[var(--ink-300)]" />}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function StatCard({
  label,
  value,
  delta,
  trend,
  spark,
  context,
  icon: _icon,
  accent,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; up?: boolean };
  trend?: { value: string; up?: boolean };
  spark?: number[];
  context?: string;
  icon?: LucideIcon;
  accent?: "gold";
}) {
  const d = delta ?? trend;
  return (
    <div className="card-editorial" style={{ padding: 20 }}>
      <div className="eyebrow">{label}</div>
      <div
        className="kpi-number mt-3"
        style={{ fontSize: 28, lineHeight: 1, color: accent === "gold" ? "var(--gold-700)" : undefined }}
      >
        {value}
      </div>
      {d && (
        <div className={`mt-2 trend-pill ${d.up ? "trend-pill--up" : "trend-pill--down"}`}>
          {d.up ? <TrendingUp size={12} strokeWidth={1.75} /> : <TrendingDown size={12} strokeWidth={1.75} />}
          {d.value}
          {context && <span className="ml-1 text-[var(--ink-400)]">· {context}</span>}
        </div>
      )}
      {spark && (
        <div className="mt-3 -mx-1">
          <Sparkline data={spark} height={40} color={accent === "gold" ? "var(--gold)" : "var(--navy)"} />
        </div>
      )}
    </div>
  );
}

export const HeroStatCard = StatCard;

export function StatusDot({
  tone = "neutral",
}: {
  tone?: "danger" | "warning" | "success" | "neutral" | "navy";
}) {
  const c =
    tone === "danger" ? "var(--danger)" :
    tone === "warning" ? "var(--warning)" :
    tone === "success" ? "var(--success)" :
    tone === "navy" ? "var(--navy)" : "var(--ink-400)";
  return <span className="status-dot" style={{ background: c }} />;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "gold" | "navy" | "success" | "warning" | "danger" | "neutral";
}) {
  return <span className={`badge-soft badge-soft--${tone}`}>{children}</span>;
}

export function AlertStrip({
  tone = "warning",
  title,
  children,
}: {
  tone?: "danger" | "warning" | "success";
  title: string;
  children?: React.ReactNode;
}) {
  const map = {
    danger: { bg: "rgba(180, 36, 50, 0.04)", color: "var(--danger)" },
    warning: { bg: "rgba(162, 90, 8, 0.05)", color: "var(--warning)" },
    success: { bg: "rgba(31, 122, 77, 0.05)", color: "var(--success)" },
  } as const;
  const s = map[tone];
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ background: s.bg, border: `1px solid ${s.color}25` }}
    >
      <StatusDot tone={tone} />
      <div className="flex-1">
        <div className="text-[13px] font-medium" style={{ color: s.color }}>
          {title}
        </div>
        {children && <div className="mt-0.5 text-[12.5px] text-[var(--ink-500)]">{children}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({
  count,
  title,
  action,
}: {
  count?: string | number;
  eyebrow?: string;
  title: string;
  tone?: "navy" | "gold" | "danger" | "warning";
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-[14px] font-medium text-[#1a1a1f] tracking-tight">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-[12.5px] font-normal text-[var(--ink-400)] tabular">
            {count}
          </span>
        )}
      </h2>
      <div className="flex-1" />
      {action}
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "gold" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "px-2.5 py-1 text-[12px] rounded-md",
    md: "px-3 py-1.5 text-[12.5px] rounded-lg",
    lg: "px-4 py-2 text-[13.5px] rounded-lg",
  };
  const styles: Record<string, string> = {
    primary: "bg-[#1e2044] text-white hover:bg-[var(--navy-700)]",
    gold: "text-white hover:opacity-95",
    ghost: "text-[#1a1a1f] hover:bg-[var(--ink-50)]",
    outline: "border border-[var(--border)] text-[#1a1a1f] bg-white hover:bg-[var(--ink-50)] hover:border-[rgba(15,17,35,0.12)]",
    danger: "border border-[rgba(180,36,50,0.25)] text-[var(--danger)] bg-white hover:bg-[rgba(180,36,50,0.04)]",
  };
  const goldStyle = variant === "gold" ? { background: "#987814" } : undefined;
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${sizes[size]} ${styles[variant]} ${props.className ?? ""}`}
      style={{ ...goldStyle, ...(props.style ?? {}) }}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card-editorial p-5 ${className}`}>{children}</div>;
}

export function CardHero({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card-hero p-6 ${className}`}>{children}</div>;
}
