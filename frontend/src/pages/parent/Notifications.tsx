/**
 * Parent Notifications — daily attendance reports + other alerts
 */
import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle2, RefreshCw, Play } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { ParentNotificationItem } from '../../components/parent/ParentNotificationItem';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/utils';

type Filter = 'all' | 'parent_alert' | 'absence_alert' | 'low_attendance';

const FILTER_LABELS: Record<Filter, string> = {
  all:            'All',
  parent_alert:   'Daily Reports',
  absence_alert:  'Absences',
  low_attendance: 'Low Attendance',
};

interface Notification {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export default function ParentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.data?.notifications ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read', read_at: new Date().toISOString() } : n));
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read', read_at: new Date().toISOString() })));
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      await api.triggerDailyReport();
      setTriggerMsg('Report sent! Refreshing…');
      await load();
    } catch (err) {
      setTriggerMsg(getErrorMessage(err));
    } finally {
      setTriggering(false);
    }
  };

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => n.status !== 'read').length;

  const counts: Record<Filter, number> = {
    all:            notifications.length,
    parent_alert:   notifications.filter(n => n.type === 'parent_alert').length,
    absence_alert:  notifications.filter(n => n.type === 'absence_alert').length,
    low_attendance: notifications.filter(n => n.type === 'low_attendance').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        }
      />

      {/* Manual trigger for testing */}
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground">Daily Report (6 PM auto-send)</p>
          <p className="text-xs text-muted-foreground">Manually trigger today's attendance report for testing</p>
          {triggerMsg && <p className="text-xs text-primary mt-1">{triggerMsg}</p>}
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-1.5 shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {triggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Send Now
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => {
          const count = counts[f];
          if (f !== 'all' && count === 0) return null;
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
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-foreground">
            {filter === 'all' ? 'No notifications yet' : `No ${FILTER_LABELS[filter].toLowerCase()} notifications`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Daily attendance reports are sent at 6 PM every day.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <ParentNotificationItem
              key={n.id}
              notification={n as never}
              onRead={() => handleMarkRead(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
