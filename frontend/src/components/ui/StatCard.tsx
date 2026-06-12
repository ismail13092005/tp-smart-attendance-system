import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  title, value, subtitle, icon: Icon,
  iconBg = 'bg-primary/10', iconColor = 'text-primary',
  trend, loading, highlight, className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('stat-card', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className={cn(
      'stat-card',
      highlight && 'border-primary/30 bg-primary/5',
      className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground leading-tight">{title}</p>
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} aria-hidden />
          </div>
        )}
      </div>

      <div>
        <p className="text-3xl font-bold text-foreground leading-none tabular">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>

      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isPositive ? 'text-success' : 'text-destructive',
        )}>
          {isPositive
            ? <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
          {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
}
