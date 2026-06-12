import { Link } from 'react-router-dom';
import { Clock, MapPin, Users, QrCode, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProfSession } from '../../hooks/useProfessorDashboard';

interface Props {
  session: ProfSession;
  showActions?: boolean;
}

const STATUS_CFG = {
  active:    { dot: 'bg-success animate-pulse', label: 'Live',      ring: 'border-success/30 bg-success/5' },
  scheduled: { dot: 'bg-info',                  label: 'Upcoming',  ring: 'border-border bg-card' },
  completed: { dot: 'bg-muted-foreground',       label: 'Completed', ring: 'border-border bg-card' },
  cancelled: { dot: 'bg-destructive',            label: 'Cancelled', ring: 'border-destructive/20 bg-card' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function SessionCard({ session: s, showActions = true }: Props) {
  const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.scheduled;
  const pct = s.expected_count > 0 ? Math.round((s.present_count / s.expected_count) * 100) : 0;

  return (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', cfg.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
            <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
            <span className="text-xs text-muted-foreground capitalize">· {s.session_type}</span>
          </div>
          <p className="font-semibold text-foreground text-sm">{s.course_code}</p>
          <p className="text-xs text-muted-foreground truncate">{s.course_name}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}
            </span>
            {s.location && (
              <span className="flex items-center gap-1 truncate max-w-[160px]">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {s.location}
              </span>
            )}
          </div>
        </div>

        {/* Attendance count */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-foreground leading-none">{s.present_count}</p>
          <p className="text-xs text-muted-foreground">/{s.expected_count}</p>
          {s.expected_count > 0 && (
            <p className={cn('text-xs font-medium mt-0.5',
              pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive',
            )}>{pct}%</p>
          )}
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <Link
            to={`/professor/session/${s.id}`}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <QrCode className="h-3.5 w-3.5" />
            {s.status === 'active' ? 'Manage QR' : 'View'}
          </Link>
          <Link
            to={`/professor/attendance-sheet?session=${s.id}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            <Users className="h-3.5 w-3.5" />
            Sheet
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
