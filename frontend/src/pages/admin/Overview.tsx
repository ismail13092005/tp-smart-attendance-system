/**
 * Admin Overview — KPI cards, today's stats, trend chart, live sessions
 */
import { useState } from 'react';
import { Users, BookOpen, Activity, TrendingUp, RefreshCw, Clock } from 'lucide-react';
import { useAdminOverview, useAdminToday, useAdminTrend } from '../../hooks/useAdminDashboard';
import { KpiCard } from '../../components/admin/KpiCard';
import { AttendanceTrendChart } from '../../components/admin/AttendanceTrendChart';
import { Alert } from '../../components/ui/Alert';
import { cn, attendanceColor } from '../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';

const TREND_OPTIONS = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export default function AdminOverview() {
  const [trendDays, setTrendDays] = useState(30);
  const qc = useQueryClient();

  const { data: overview, isLoading: ovLoading, error: ovError } = useAdminOverview();
  const { data: today,    isLoading: todayLoading }               = useAdminToday();
  const { data: trend,    isLoading: trendLoading }               = useAdminTrend(trendDays);

  const ov = overview?.overview;
  const todayPct = parseFloat(today?.today_pct ?? '0');

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
    qc.invalidateQueries({ queryKey: ['admin-today'] });
    qc.invalidateQueries({ queryKey: ['admin-trend'] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {ovError && <Alert variant="destructive">Failed to load dashboard data.</Alert>}

      {/* Top KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Students"
          value={ov?.total_students ?? '—'}
          icon={Users}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          loading={ovLoading}
        />
        <KpiCard
          label="Total Faculty"
          value={ov?.total_faculty ?? '—'}
          icon={BookOpen}
          iconBg="bg-violet-500/10"
          iconColor="text-violet-500"
          loading={ovLoading}
        />
        <KpiCard
          label="Active Sessions"
          value={ov?.active_sessions ?? '—'}
          icon={Activity}
          iconBg="bg-success/10"
          iconColor="text-success"
          highlight={parseInt(ov?.active_sessions ?? '0') > 0}
          loading={ovLoading}
        />
        <KpiCard
          label="Avg Attendance"
          value={ov?.avg_attendance_pct ? `${ov.avg_attendance_pct}%` : '—'}
          icon={TrendingUp}
          iconBg={parseFloat(ov?.avg_attendance_pct ?? '0') >= 75 ? 'bg-success/10' : 'bg-warning/10'}
          iconColor={parseFloat(ov?.avg_attendance_pct ?? '0') >= 75 ? 'text-success' : 'text-warning'}
          loading={ovLoading}
        />
      </div>

      {/* Today's stats */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Today's Attendance
          </h2>
          <span className={cn('text-2xl font-bold', attendanceColor(todayPct))}>
            {todayPct > 0 ? `${todayPct}%` : '—'}
          </span>
        </div>

        {todayLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="rounded-lg bg-muted h-16 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Sessions',   value: today?.total_sessions ?? '0',   color: 'text-foreground' },
              { label: 'Active',     value: today?.active_sessions ?? '0',  color: 'text-success' },
              { label: 'Completed',  value: today?.completed_sessions ?? '0', color: 'text-muted-foreground' },
              { label: 'Expected',   value: today?.total_expected ?? '0',   color: 'text-foreground' },
              { label: 'Present',    value: today?.total_present ?? '0',    color: 'text-success' },
              { label: 'Absent',     value: today?.total_absent ?? '0',     color: 'text-destructive' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-muted/40 p-3 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Attendance Trend</h2>
          <div className="flex rounded-lg border border-border p-0.5 gap-0.5">
            {TREND_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setTrendDays(o.value)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  trendDays === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="h-[220px] bg-muted/30 rounded-lg animate-pulse" />
        ) : (
          <>
            <AttendanceTrendChart data={trend ?? []} height={220} />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Dashed line = 75% threshold
            </p>
          </>
        )}
      </div>

      {/* Live sessions + dept breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live sessions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            Live Sessions ({overview?.activeSessions?.length ?? 0})
          </h2>
          {ovLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />)}</div>
          ) : (overview?.activeSessions?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No active sessions</div>
          ) : (
            <div className="space-y-2">
              {overview!.activeSessions.map(s => {
                const pct = s.expected_count > 0 ? Math.round((s.present_count / s.expected_count) * 100) : 0;
                return (
                  <div key={s.id} className="rounded-lg border border-success/20 bg-success/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{s.course_code} — {s.course_name}</p>
                        <p className="text-xs text-muted-foreground">{s.faculty_name} · {s.location}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-success">{s.present_count}/{s.expected_count}</p>
                        <p className={cn('text-xs font-medium', attendanceColor(pct))}>{pct}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Department summary */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Department Summary</h2>
          {ovLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {(overview?.departments ?? []).map(d => {
                const pct = parseFloat(d.pct ?? '0');
                return (
                  <div key={d.department} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{d.department}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{d.students} students</span>
                        <span className={cn('font-bold', attendanceColor(pct))}>
                          {pct > 0 ? `${pct}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
