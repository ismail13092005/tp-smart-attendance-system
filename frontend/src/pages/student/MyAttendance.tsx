/**
 * My Attendance — subject-wise breakdown with progress bars
 * - Overall attendance percentage with circular indicator
 * - Per-subject progress bars
 * - Defaulter alert
 */
import { BookOpen } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';
import { AttendanceSummaryCards } from '../../components/student/AttendanceSummaryCards';
import { DefaulterBanner } from '../../components/student/DefaulterBanner';
import { SubjectAttendanceRow } from '../../components/student/SubjectAttendanceRow';
import { EmptyState } from '../../components/student/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/layout/PageHeader';
import { cn, attendanceColor } from '../../lib/utils';

export default function MyAttendance() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useStudentDashboard(user?.id);

  const pct      = parseFloat(data?.summary?.overall_pct ?? '0');
  const total    = parseInt(data?.summary?.total ?? '0', 10);
  const attended = parseInt(data?.summary?.attended ?? '0', 10);

  // Separate defaulters from healthy subjects
  const subjects = data?.subjects ?? [];
  const defaulterSubjects = subjects.filter(s => parseFloat(s.pct ?? '0') > 0 && parseFloat(s.pct ?? '0') < 75);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="My Attendance"
        subtitle="Subject-wise breakdown and overall percentage"
      />

      {error && <Alert variant="destructive">Failed to load attendance data.</Alert>}

      {/* Summary cards */}
      <AttendanceSummaryCards
        total={total}
        attended={attended}
        pct={pct}
        loading={isLoading}
      />

      {/* Overall percentage — circular gauge */}
      {!isLoading && total > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
          <CircularGauge pct={pct} />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Overall Attendance</p>
            <p className={cn('text-3xl font-bold mt-0.5', attendanceColor(pct))}>
              {pct}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {attended} of {total} classes attended
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className={cn(
                'px-2 py-0.5 rounded-full font-medium',
                pct >= 75 ? 'bg-success/10 text-success' :
                pct >= 60 ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive',
              )}>
                {pct >= 75 ? '✓ Above threshold' : pct >= 60 ? '⚠ Near threshold' : '✗ Below threshold'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Defaulter banner */}
      {!isLoading && total > 0 && (
        <DefaulterBanner pct={pct} total={total} attended={attended} />
      )}

      {/* Subjects at risk */}
      {!isLoading && defaulterSubjects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            Subjects Below 75% ({defaulterSubjects.length})
          </h2>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 divide-y divide-destructive/10">
            {defaulterSubjects.map(s => (
              <SubjectAttendanceRow
                key={s.course_code}
                courseCode={s.course_code}
                courseName={s.course_name}
                total={parseInt(s.total_classes, 10)}
                attended={parseInt(s.attended, 10)}
                pct={parseFloat(s.pct ?? '0')}
              />
            ))}
          </div>
        </section>
      )}

      {/* All subjects */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          All Subjects
        </h2>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No attendance records yet"
            description="Your subject-wise attendance will appear here after your first class."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card px-4 py-3 divide-y divide-border">
            {subjects.map(s => (
              <SubjectAttendanceRow
                key={s.course_code}
                courseCode={s.course_code}
                courseName={s.course_name}
                total={parseInt(s.total_classes, 10)}
                attended={parseInt(s.attended, 10)}
                pct={parseFloat(s.pct ?? '0')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Circular gauge ────────────────────────────────────────────────────────────

function CircularGauge({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex-shrink-0">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}
