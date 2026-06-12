/**
 * Student Notifications
 * - Absence alerts
 * - Low attendance alerts
 * - Attendance-related notices
 * - Unread count badge
 * - Type-aware icons and colours
 */
import { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStudentDashboard, useMarkStudentNotificationsRead } from '../../hooks/useStudentDashboard';
import { NotificationItem } from '../../components/student/NotificationItem';
import { EmptyState } from '../../components/student/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/layout/PageHeader';
import { cn } from '../../lib/utils';

type NotifFilter = 'all' | 'absence_alert' | 'low_attendance' | 'session_started';

const FILTER_LABELS: Record<NotifFilter, string> = {
  all:             'All',
  absence_alert:   'Absences',
  low_attendance:  'Low Attendance',
  session_started: 'Sessions',
};

export default function StudentNotifications() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useStudentDashboard(user?.id);
  const markRead = useMarkStudentNotificationsRead(user?.id);
  const [filter, setFilter] = useState<NotifFilter>('all');

  const notifications = data?.notifications ?? [];
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => n.status !== 'read').length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={unreadCount > 0 ? (
          <button
            onClick={() => markRead.mutate(undefined)}
            disabled={markRead.isPending}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Mark all read
          </button>
        ) : undefined}
      />

      {error && <Alert variant="destructive">Failed to load notifications.</Alert>}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as NotifFilter[]).map(f => {
          const count = f === 'all'
            ? notifications.length
            : notifications.filter(n => n.type === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                filter === f
                  ? 'bg-primary/10 text-primary border-primary/30 ring-2 ring-primary/20'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
              )}
            >
              {FILTER_LABELS[f]}
              {count > 0 && <span className="font-bold">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'all' ? 'No notifications yet' : `No ${FILTER_LABELS[filter].toLowerCase()} notifications`}
          description="You'll be notified about absences, low attendance, and session updates here."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

      {/* All-clear state */}
      {!isLoading && notifications.length > 0 && unreadCount === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          All notifications read
        </div>
      )}
    </div>
  );
}
    