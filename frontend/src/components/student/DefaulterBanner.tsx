/**
 * DefaulterBanner
 * Shown when overall attendance < 75%.
 * Calculates how many more classes the student needs to attend.
 */
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  pct: number;
  total: number;
  attended: number;
}

export function DefaulterBanner({ pct, total, attended }: Props) {
  if (pct === 0 || pct >= 75) return null;

  // How many more classes needed to reach 75%?
  // 0.75 * (total + x) = attended + x  →  x = (0.75*total - attended) / 0.25
  const needed = Math.ceil((0.75 * total - attended) / 0.25);
  const isCritical = pct < 60;

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-start gap-3',
      isCritical
        ? 'border-destructive/40 bg-destructive/8'
        : 'border-warning/40 bg-warning/8',
    )}>
      <div className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 mt-0.5',
        isCritical ? 'bg-destructive/15' : 'bg-warning/15',
      )}>
        <AlertTriangle className={cn('h-5 w-5', isCritical ? 'text-destructive' : 'text-warning')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', isCritical ? 'text-destructive' : 'text-warning')}>
          {isCritical ? 'Critical: Very Low Attendance' : 'Low Attendance Warning'}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your attendance is <strong>{pct}%</strong> — below the required 75%.
          {needed > 0 && (
            <> You need to attend <strong>{needed} more class{needed !== 1 ? 'es' : ''}</strong> to reach the threshold.</>
          )}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Required: 75% · Current: {pct}% · Gap: {(75 - pct).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
