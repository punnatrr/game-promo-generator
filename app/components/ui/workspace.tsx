import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function EmptyState({ title, description, href, action, onAction }: { title: string; description: string; href?: string; action?: string; onAction?: () => void }) {
  return <section className="empty-state"><span aria-hidden="true" className="empty-icon">＋</span><h2>{title}</h2><p>{description}</p>{href && action ? <Link className="action-link secondary" href={href}>{action}</Link> : onAction && action ? <button className="action-link secondary" type="button" onClick={onAction}>{action}</button> : null}</section>;
}

export function Skeleton({ label = "กำลังโหลดข้อมูล…" }: { label?: string }) {
  return <div role="status" className="loading-skeleton"><span className="sr-only">{label}</span><div /><div /><div /></div>;
}

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return <ol className="workflow-steps" aria-label="ขั้นตอนการทำงาน">{labels.map((label, index) => <li key={label} aria-current={index === current ? "step" : undefined} data-complete={index < current}><span aria-hidden="true">{index < current ? "✓" : index + 1}</span><span>{label}{index < current && <span className="sr-only"> เสร็จแล้ว</span>}</span></li>)}</ol>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
