/**
 * TodaySessionCard
 * Shows a single today's lecture with time, location, status, and action button.
 */
import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Clock, QrCode } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TodaySession } from '../../hooks/useStudentDashboard';

interface Props {
  session: TodaySession;
}

const STATUS_CONFIG = {
  active:    { dot: 'bg-success animate-pulse', label: 'Live Now', badge: 'bg-success/10 text-success border-success/30' },
  scheduled: { dot: 'bg-info',                  label: 'Upcoming', badge: 'bg-info/10 text-info border-info/30' },
  completed: { dot: 'bg-muted-foreground',       label: 'Ended',    badge: 'bg-muted text-muted-foreground border-border' },
  cancelled: { dot: 'bg-destructive',            label: 'Cancelled',badge: 'bg-destructive/10 text-destructive border-destructive/30' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function TodaySessionCard({ session }: Props) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.scheduled;

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm',
      session.status === 'active' ? 'border-success/30' : 'border-border',
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 mt-0.5',
            session.status === 'active' ? 'bg-success/10' : 'bg-primary/10',
          )}>
            <BookOpen className={cn('h-5 w-5', session.status === 'active' ? 'text-success' : 'text-primary')} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">
              {session.course_code}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{session.course_name}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTime(session.scheduled_start)} – {formatTime(session.scheduled_end)}
              </span>
              {session.location && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {session.location}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.faculty_name} · <span className="capitalize">{session.session_type}</span>
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Status badge */}
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', cfg.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>

          {/* Action */}
          {session.status === 'active' && (
            <Link
              to="/student/scan-attendance"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5" />
              Mark Now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
