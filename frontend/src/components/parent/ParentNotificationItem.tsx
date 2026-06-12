import { Bell, AlertTriangle, TrendingDown, CheckCircle2, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ParentNotification {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  created_at: string;
  read_at?: string | null;
}

interface Props {
  notification: ParentNotification;
  onRead?: () => void;
}

const TYPE_CFG: Record<string, { icon: React.ElementType; containerClass: string; iconClass: string; iconBg: string }> = {
  absence_alert:   { icon: AlertTriangle,  containerClass: 'border-destructive/20 bg-destructive/5', iconClass: 'text-destructive', iconBg: 'bg-destructive/10' },
  low_attendance:  { icon: TrendingDown,   containerClass: 'border-warning/20 bg-warning/5',         iconClass: 'text-warning',     iconBg: 'bg-warning/10' },
  session_started: { icon: CheckCircle2,   containerClass: 'border-success/20 bg-success/5',         iconClass: 'text-success',     iconBg: 'bg-success/10' },
  parent_alert:    { icon: ClipboardList,  containerClass: 'border-primary/20 bg-primary/5',         iconClass: 'text-primary',     iconBg: 'bg-primary/10' },
  default:         { icon: Bell,           containerClass: 'border-border bg-card',                  iconClass: 'text-primary',     iconBg: 'bg-primary/10' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ParentNotificationItem({ notification: n, onRead }: Props) {
  const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.default;
  const Icon = cfg.icon;
  const isUnread = n.status !== 'read';

  // For daily reports, render a structured summary from payload
  const payload = n.payload as {
    attendedCount?: number;
    missedCount?: number;
    totalCount?: number;
    sessions?: Array<{ courseCode: string; courseName: string; time: string; status: string }>;
  } | undefined;

  const isDailyReport = n.type === 'parent_alert' && payload?.sessions;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex items-start gap-3 transition-colors cursor-pointer',
        cfg.containerClass,
        isUnread && 'ring-1 ring-inset ring-primary/10',
      )}
      onClick={() => isUnread && onRead?.()}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-full shrink-0 mt-0.5', cfg.iconBg)}>
        <Icon className={cn('h-4 w-4', cfg.iconClass)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {isUnread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
            <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(n.created_at)}</span>
          </div>
        </div>

        {isDailyReport && payload?.sessions ? (
          // Structured daily report view
          <div className="mt-2 space-y-2">
            {/* Summary bar */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {payload.attendedCount ?? 0} attended
              </span>
              <span className="text-muted-foreground">·</span>
              <span className={cn('font-medium', (payload.missedCount ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {payload.missedCount ?? 0} missed
              </span>
              <span className="text-muted-foreground">of {payload.totalCount ?? 0}</span>
            </div>

            {/* Session list */}
            <div className="space-y-1">
              {payload.sessions.map((s, i) => {
                const attended = s.status === 'present' || s.status === 'late';
                const time = new Date(s.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={attended ? 'text-success' : 'text-destructive'}>
                      {attended ? '✅' : '❌'}
                    </span>
                    <span className="font-medium text-foreground">{s.courseCode}</span>
                    <span className="text-muted-foreground truncate">{s.courseName}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{time}</span>
                    {s.status === 'late' && (
                      <span className="text-warning text-[10px] font-medium">late</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{n.body}</p>
        )}
      </div>
    </div>
  );
}
