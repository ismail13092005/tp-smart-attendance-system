import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function ChartCard({
  title, subtitle, action, children, footer, loading, className, bodyClassName,
}: ChartCardProps) {
  return (
    <div className={cn('chart-card', className)}>
      <div className="chart-card-header">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className={cn('chart-card-body', bodyClassName)}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        ) : children}
      </div>
      {footer && (
        <div className="px-5 pb-4 pt-0 border-t border-border mt-2">
          {footer}
        </div>
      )}
    </div>
  );
}
