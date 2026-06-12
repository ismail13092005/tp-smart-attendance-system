/**
 * NotificationItem
 * Single notification row with type-aware icon and colour.
 */
import { Bell, AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Notification } from '../../hooks/useStudentDashboard';

interface Props {
  notification: Notification;
}

const TYPE_CONFIG: Record<string, {
  icon: React.ElementType;
  containerClass: string;
  iconClass: string;
  label: string;
}> = {
  absence_alert: {
    icon: AlertTriangle,
    containerClass: 'border-destructive/20 bg-destructive/5',
    iconClass: 'text-destructive',
    label: 'Absence Alert',
  },
  low_attendance: {
    icon: TrendingDown,
    containerClass: 'border-warning/20 bg-warning/5',
    iconClass: 'text-warning',
    label: 'Low Attendance',
  },
  session_started: {
    icon: CheckCircle2,
    containerClass: 'border-success/20 bg-success/5',
    iconClass: 'text-success',
    label: 'Session Started',
  },
  default: {
    icon: Bell,
    containerClass: 'border-border bg-card',
    iconClass: 'text-primary',
    label: 'Notification',
  },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationItem({ notification: n }: Props) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
  const Icon = cfg.icon;
  const isUnread = n.status !== 'read';

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-start gap-3 transition-colors',
      cfg.containerClass,
      isUnread && 'ring-1 ring-inset ring-primary/10',
    )}>
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 mt-0.5',
        n.type === 'absence_alert' ? 'bg-destructive/10' :
        n.type === 'low_attendance' ? 'bg-warning/10' :
        n.type === 'session_started' ? 'bg-success/10' : 'bg-primary/10',
      )}>
        <Icon className={cn('h-4 w-4', cfg.iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isUnread && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(n.created_at)}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
      </div>
    </div>
  );
}
