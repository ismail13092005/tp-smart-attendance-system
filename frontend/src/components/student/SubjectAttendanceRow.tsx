/**
 * SubjectAttendanceRow
 * Single row showing subject name, progress bar, and percentage.
 * Used in both Home (compact) and My Attendance (full) views.
 */
import { AlertTriangle } from 'lucide-react';
import { cn, attendanceColor } from '../../lib/utils';

interface Props {
  courseCode: string;
  courseName: string;
  total: number;
  attended: number;
  pct: number;
  compact?: boolean;
}

export function SubjectAttendanceRow({ courseCode, courseName, total, attended, pct, compact }: Props) {
  const isLow = pct > 0 && pct < 75;
  const barColor = pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className={cn('space-y-1.5', !compact && 'py-3')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{courseCode}</p>
            {!compact && (
              <p className="text-xs text-muted-foreground truncate">{courseName}</p>
            )}
          </div>
          {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!compact && (
            <span className="text-xs text-muted-foreground tabular-nums">{attended}/{total}</span>
          )}
          <span className={cn('text-sm font-bold tabular-nums w-12 text-right', attendanceColor(pct))}>
            {pct > 0 ? `${pct}%` : '—'}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
