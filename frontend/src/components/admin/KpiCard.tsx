/**
 * KpiCard — large admin-grade KPI card with icon, value, subtitle, and trend.
 */
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; label: string };
  loading?: boolean;
  highlight?: boolean;
  className?: string;
}

export function KpiCard({
  label, value, subtitle, icon: Icon,
  iconBg, iconColor, trend, loading, highlight, className,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card p-5 space-y-3', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card p-5 space-y-3 transition-shadow hover:shadow-sm',
      highlight ? 'border-primary/30 bg-primary/5' : 'border-border',
      className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground leading-tight">{label}</p>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground leading-none">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {trend && (
        <p className={cn('text-xs font-medium flex items-center gap-1',
          trend.value >= 0 ? 'text-success' : 'text-destructive',
        )}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
