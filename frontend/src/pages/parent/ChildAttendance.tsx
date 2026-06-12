/**
 * Child Attendance — subject-wise breakdown, monthly chart, overall %, low attendance warning
 */
import { useState } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useParentDashboard, useChildSubjects } from '../../hooks/useParentDashboard';
import { ChildSelector } from '../../components/parent/ChildSelector';
import { AttendanceDonut } from '../../components/parent/AttendanceDonut';
import { MonthlyBarChart } from '../../components/parent/MonthlyBarChart';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn, attendanceColor } from '../../lib/utils';

export default function ChildAttendance() {
  const { user } = useAuthStore();
  const { data: parentData, isLoading: parentLoading } = useParentDashboard(user?.id);
  const children = parentData?.children ?? [];

  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || children[0]?.id;
  const activeChild = children.find(c => c.id === activeChildId);

  const { data: subjectData, isLoading: subjectLoading } = useChildSubjects(user?.id, activeChildId);
  const subjects = subjectData?.subjects ?? [];
  const monthly  = subjectData?.monthly  ?? [];

  const pct = parseFloat(activeChild?.overall_pct ?? '0');
  const isDefaulter = pct > 0 && pct < 75;

  const needed = isDefaulter
    ? Math.ceil((0.75 * parseInt(activeChild?.total_classes ?? '0') - parseInt(activeChild?.attended ?? '0')) / 0.25)
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <PageHeader title="Child Attendance" subtitle="Subject-wise breakdown and monthly report" />

      {/* Child selector */}
      {children.length > 1 && (
        <ChildSelector children={children} selectedId={activeChildId} onChange={setSelectedChildId} />
      )}

      {/* Overall summary */}
      {parentLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-6"><Skeleton className="h-24 w-24 rounded-full" /><div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-4 w-32" /></div></div>
        </div>
      ) : activeChild && (
        <div className={cn('rounded-xl border bg-card p-5', isDefaulter ? 'border-destructive/30' : 'border-border')}>
          <div className="flex items-center gap-5">
            <AttendanceDonut pct={pct} size={100} strokeWidth={10} label="Overall" />
            <div className="flex-1">
              <p className="font-bold text-foreground text-lg">{activeChild.first_name} {activeChild.last_name}</p>
              <p className="text-sm text-muted-foreground">{activeChild.program} · Sem {activeChild.current_semester}</p>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                <div className="rounded-lg bg-muted/50 py-2">
                  <p className="font-bold text-foreground">{activeChild.total_classes}</p>
                  <p className="text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg bg-success/10 py-2">
                  <p className="font-bold text-success">{activeChild.attended}</p>
                  <p className="text-muted-foreground">Attended</p>
                </div>
                <div className="rounded-lg bg-destructive/10 py-2">
                  <p className="font-bold text-destructive">
                    {Math.max(0, parseInt(activeChild.total_classes) - parseInt(activeChild.attended))}
                  </p>
                  <p className="text-muted-foreground">Missed</p>
                </div>
              </div>
            </div>
          </div>

          {isDefaulter && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Low Attendance Warning</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Attendance is {pct}% — below the required 75%.
                  {needed > 0 && ` Needs to attend ${needed} more class${needed !== 1 ? 'es' : ''} to reach the threshold.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Monthly Attendance (Last 6 Months)</h2>
        {subjectLoading ? (
          <div className="h-[180px] bg-muted/30 rounded-lg animate-pulse" />
        ) : (
          <>
            <MonthlyBarChart data={monthly} height={180} />
            <p className="text-xs text-muted-foreground mt-2 text-center">Dashed line = 75% threshold</p>
          </>
        )}
      </div>

      {/* Subject breakdown */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Subject-wise Attendance
        </h2>

        {subjectLoading ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No subject data available</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-4 py-3 divide-y divide-border">
            {subjects.map(s => {
              const spct = parseFloat(s.pct ?? '0');
              const isLow = spct > 0 && spct < 75;
              return (
                <div key={s.course_code} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.course_code}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.course_name}</p>
                      </div>
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                      <span>{s.attended}/{s.total_classes}</span>
                      <span className={cn('font-bold text-sm w-12 text-right', attendanceColor(spct))}>
                        {spct > 0 ? `${spct}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        spct >= 75 ? 'bg-success' : spct >= 60 ? 'bg-warning' : 'bg-destructive',
                      )}
                      style={{ width: `${Math.min(spct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
