/**
 * Student Home Dashboard
 * - Today's lectures
 * - Scan QR button
 * - Attendance summary cards
 * - Current attendance percentage
 * - Low attendance warning if below 75%
 */
import { Link } from 'react-router-dom';
import { QrCode, BookOpen, Bell, ChevronRight, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';
import { useFaceEnrollmentStatus } from '../../hooks/useStudentDashboard';
import { AttendanceSummaryCards } from '../../components/student/AttendanceSummaryCards';
import { DefaulterBanner } from '../../components/student/DefaulterBanner';
import { TodaySessionCard } from '../../components/student/TodaySessionCard';
import { SubjectAttendanceRow } from '../../components/student/SubjectAttendanceRow';
import { NotificationItem } from '../../components/student/NotificationItem';
import { EmptyState } from '../../components/student/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';

export default function StudentHome() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useStudentDashboard(user?.id);
  const { data: enrollmentStatus } = useFaceEnrollmentStatus();

  const pct     = parseFloat(data?.summary?.overall_pct ?? '0');
  const total   = parseInt(data?.summary?.total ?? '0', 10);
  const attended= parseInt(data?.summary?.attended ?? '0', 10);
  const unreadNotifs = data?.notifications?.filter(n => n.status !== 'read') ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Good {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          to="/student/scan-attendance"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm flex-shrink-0"
        >
          <QrCode className="h-4 w-4" />
          Scan QR
        </Link>
      </div>

      {/* Face enrollment nudge */}
      {enrollmentStatus && !enrollmentStatus.hasEnrollment && (
        <Alert variant="warning" title="Face not enrolled">
          You need to enroll your face before you can mark attendance.{' '}
          <Link to="/student/face-enrollment" className="underline font-medium">Enroll now →</Link>
        </Alert>
      )}

      {/* Error */}
      {error && <Alert variant="destructive">Failed to load dashboard data. Please refresh.</Alert>}

      {/* Defaulter banner */}
      {!isLoading && total > 0 && (
        <DefaulterBanner pct={pct} total={total} attended={attended} />
      )}

      {/* Summary cards */}
      <AttendanceSummaryCards
        total={total}
        attended={attended}
        pct={pct}
        loading={isLoading}
      />

      {/* Today's schedule */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Today's Schedule
          </h2>
          <Link to="/student/history" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (data?.todaySessions?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Clock}
            title="No classes today"
            description="Enjoy your free day! Check your history for past attendance."
          />
        ) : (
          <div className="space-y-3">
            {data!.todaySessions.map(s => (
              <TodaySessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>

      {/* Subject-wise attendance (compact) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Subject Attendance
          </h2>
          <Link to="/student/my-attendance" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Full view <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : (data?.subjects?.length ?? 0) === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No attendance records yet"
            description="Your subject-wise attendance will appear here after your first class."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card px-4 py-3 divide-y divide-border">
            {data!.subjects.slice(0, 5).map(s => (
              <SubjectAttendanceRow
                key={s.course_code}
                courseCode={s.course_code}
                courseName={s.course_name}
                total={parseInt(s.total_classes, 10)}
                attended={parseInt(s.attended, 10)}
                pct={parseFloat(s.pct ?? '0')}
                compact
              />
            ))}
            {(data?.subjects?.length ?? 0) > 5 && (
              <div className="pt-3">
                <Link to="/student/my-attendance" className="text-xs text-primary hover:underline">
                  +{data!.subjects.length - 5} more subjects →
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent notifications */}
      {(data?.notifications?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notifications
              {unreadNotifs.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadNotifs.length}
                </span>
              )}
            </h2>
            <Link to="/student/notifications" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {data!.notifications.slice(0, 3).map(n => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
