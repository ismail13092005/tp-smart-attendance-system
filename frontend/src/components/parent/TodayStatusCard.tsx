/**
 * TodayStatusCard — shows a single today session with attendance status.
 */
import { Clock, MapPin, BookOpen, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TodaySession } from '../../hooks/useParentDashboard';

interface Props {
  session: TodaySession;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const STATUS_CFG = {
  present: { icon: CheckCircle2, color: 'text-success',          bg: 'bg-success/10',     label: 'Present' },
  late:    { icon: AlertTriangle, color: 'text-warning',          bg: 'bg-warning/10',     label: 'Late' },
  absent:  { icon: XCircle,      color: 'text-destructive',      bg: 'bg-destructive/10', label: 'Absent' },
};

const DEFAULT_CFG = { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Not yet' };

export function TodayStatusCard({ session: s }: Props) {
  const cfg = (s.attendance_status ? STATUS_CFG[s.attendance_status] : null) ?? DEFAULT_CFG;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      s.attendance_status === 'present' ? 'border-success/30 bg-success/5' :
      s.attendance_status === 'absent'  ? 'border-destructive/20 bg-destructive/5' :
      s.attendance_status === 'late'    ? 'border-warning/20 bg-warning/5' :
      'border-border bg-card',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm">{s.course_code}</p>
            <p className="text-xs text-muted-foreground truncate">{s.course_name}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}
              </span>
              {s.campus_location && (
                <span className="flex items-center gap-1 truncate max-w-[140px]">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {s.campus_location}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{s.faculty_name}</p>
          </div>
        </div>

        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0', cfg.bg)}>
          <Icon className={cn('h-5 w-5', cfg.color)} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
        {s.marked_at && (
          <span className="text-muted-foreground">
            Marked at {new Date(s.marked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {s.is_manual_override && (
          <span className="text-warning text-xs">Manual override</span>
        )}
      </div>
    </div>
  );
}
