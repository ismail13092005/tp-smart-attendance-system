/**
 * Parent Home
 * - Child's today attendance status
 * - Absence alerts
 * - Quick attendance summary
 * - Recent notifications
 */
import { useState } from 'react';
import { Bell, AlertTriangle, ChevronRight, User, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useParentDashboard, useChildToday } from '../../hooks/useParentDashboard';
import { ChildSelector } from '../../components/parent/ChildSelector';
import { AttendanceDonut } from '../../components/parent/AttendanceDonut';
import { TodayStatusCard } from '../../components/parent/TodayStatusCard';
import { ParentNotificationItem } from '../../components/parent/ParentNotificationItem';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn } from '../../lib/utils';

export default function ParentHome() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useParentDashboard(user?.id);
  const children = data?.children ?? [];
  const notifications = data?.notifications ?? [];

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const activeChildId = selectedChildId || children[0]?.id;
  const activeChild = children.find(c => c.id === activeChildId);

  const { data: todayData, isLoading: todayLoading } = useChildToday(user?.id, activeChildId);
  const todaySessions = todayData?.today ?? [];

  const pct = parseFloat(activeChild?.overall_pct ?? '0');
  const isDefaulter = pct > 0 && pct < 75;
  const unreadCount = notifications.filter(n => n.status !== 'read').length;

  // Today summary
  const presentToday = todaySessions.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late').length;
  const absentToday  = todaySessions.filter(s => s.attendance_status === 'absent').length;
  const pendingToday = todaySessions.filter(s => !s.attendance_status).length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Good {getGreeting()}, {user?.firstName}!
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {error && <Alert variant="destructive">Failed to load dashboard data.</Alert>}

      {/* No children linked */}
      {!isLoading && children.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-foreground">No linked students</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact the administrator to link your child's account.
          </p>
        </div>
      )}

      {/* Child selector */}
      {children.length > 1 && (
        <ChildSelector
          children={children}
          selectedId={activeChildId}
          onChange={setSelectedChildId}
        />
      )}

      {/* Active child card */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div>
            <Skeleton className="h-20 w-20 rounded-full" />
          </div>
        </div>
      ) : activeChild && (
        <div className={cn(
          'rounded-xl border bg-card p-5',
          isDefaulter ? 'border-destructive/30' : 'border-border',
        )}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl flex-shrink-0">
              {activeChild.first_name[0]}{activeChild.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-lg leading-tight">
                {activeChild.first_name} {activeChild.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{activeChild.program}</p>
              <p className="text-xs text-muted-foreground">Semester {activeChild.current_semester} · ID: {activeChild.student_id}</p>
            </div>
            <AttendanceDonut pct={pct} size={80} strokeWidth={8} label="Overall" />
          </div>

          {isDefaulter && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Attendance is {pct}% — below the required 75% threshold.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div className="rounded-lg bg-muted/50 py-3">
              <p className="text-xl font-bold text-foreground">{activeChild.total_classes}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg bg-success/10 py-3">
              <p className="text-xl font-bold text-success">{activeChild.attended}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
            <div className="rounded-lg bg-destructive/10 py-3">
              <p className="text-xl font-bold text-destructive">
                {Math.max(0, parseInt(activeChild.total_classes) - parseInt(activeChild.attended))}
              </p>
              <p className="text-xs text-muted-foreground">Missed</p>
            </div>
          </div>

          <Link
            to="/parent/child-attendance"
            className="flex items-center justify-center gap-1.5 mt-4 text-sm text-primary hover:underline"
          >
            View full attendance report <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Today's status */}
      {activeChild && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Today's Schedule
            </h2>
            {todaySessions.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {presentToday > 0 && <span className="text-success font-medium">{presentToday} present</span>}
                {absentToday > 0  && <span className="text-destructive font-medium">{absentToday} absent</span>}
                {pendingToday > 0 && <span className="text-muted-foreground">{pendingToday} pending</span>}
              </div>
            )}
          </div>

          {todayLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>)}
            </div>
          ) : todaySessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
              <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No classes scheduled today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySessions.map(s => <TodayStatusCard key={s.session_id} session={s} />)}
            </div>
          )}
        </section>
      )}

      {/* Recent notifications */}
      {notifications.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </h2>
            <Link to="/parent/notifications" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 3).map(n => (
              <ParentNotificationItem key={n.id} notification={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
