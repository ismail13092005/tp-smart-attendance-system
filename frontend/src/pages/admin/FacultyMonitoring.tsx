/**
 * Faculty Monitoring — activity table with filters, pagination, consistency indicators
 */
import { useState } from 'react';
import { Users, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { useAdminFacultyMonitoring } from '../../hooks/useAdminDashboard';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { Pagination } from '../../components/admin/Pagination';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn, attendanceColor } from '../../lib/utils';

const PAGE_SIZE = 15;

export default function FacultyMonitoring() {
  const [page, setPage]           = useState(1);
  const [deptId, setDeptId]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');

  const { data, isLoading, error } = useAdminFacultyMonitoring({
    departmentId: deptId || undefined,
    startDate:    startDate || undefined,
    endDate:      endDate   || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const faculty = data?.faculty ?? [];
  const depts   = data?.departments ?? [];
  const total   = data?.total ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Faculty Monitoring"
        subtitle="Teaching activity, session consistency, and attendance performance"
      />

      {error && <Alert variant="destructive">Failed to load faculty data.</Alert>}

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-primary" /> Filters
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Department</label>
            <select
              value={deptId}
              onChange={e => { setDeptId(e.target.value); setPage(1); }}
              className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <DateRangeFilter
            label="Session period"
            startDate={startDate}
            endDate={endDate}
            onStartChange={v => { setStartDate(v); setPage(1); }}
            onEndChange={v => { setEndDate(v); setPage(1); }}
          />
        </div>
      </div>

      {/* Summary row */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Faculty</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-success">
              {faculty.filter(f => parseInt(f.sessions_total) > 0).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {faculty.filter(f => parseInt(f.sessions_total) === 0).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">No Sessions</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Faculty</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Department</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sessions</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Avg Attendance</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Last Session</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div></div></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                  <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-4 w-12 mx-auto" /></td>
                  <td className="px-4 py-3 text-center hidden md:table-cell"><Skeleton className="h-4 w-20 mx-auto" /></td>
                  <td className="px-4 py-3 text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                </tr>
              ))
            ) : faculty.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No faculty found
                </td>
              </tr>
            ) : (
              faculty.map(f => {
                const sessions = parseInt(f.sessions_total ?? '0');
                const pct = parseFloat(f.avg_attendance_pct ?? '0');
                const isActive = sessions > 0;
                const lastSession = f.last_session_at
                  ? new Date(f.last_session_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '—';

                return (
                  <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold flex-shrink-0',
                          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                        )}>
                          {f.first_name[0]}{f.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{f.first_name} {f.last_name}</p>
                          <p className="text-xs text-muted-foreground">{f.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                      {f.department ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-foreground">{sessions}</span>
                        {parseInt(f.sessions_active ?? '0') > 0 && (
                          <span className="text-[10px] text-success">{f.sessions_active} live</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {pct > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn('font-bold text-sm', attendanceColor(pct))}>{pct}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full', pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive')}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden md:table-cell">
                      {lastSession}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                      )}>
                        {isActive
                          ? <><CheckCircle2 className="h-3 w-3" /> Active</>
                          : <><XCircle className="h-3 w-3" /> Inactive</>
                        }
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
