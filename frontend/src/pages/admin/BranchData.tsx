/**
 * Branch Data — department + class-level attendance with charts.
 * Uses the new /dashboard/admin/branch-data endpoint.
 */
import { useState } from 'react';
import { Building2, TrendingDown, Award, BookOpen } from 'lucide-react';
import { useAdminBranchData } from '../../hooks/useAdminDashboard';
import { DeptBarChart } from '../../components/admin/DeptBarChart';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn, attendanceColor } from '../../lib/utils';

export default function BranchData() {
  const [deptId, setDeptId]   = useState('');
  const [termId, setTermId]   = useState('');
  const [view, setView]       = useState<'departments' | 'classes'>('departments');

  const { data, isLoading, error } = useAdminBranchData({
    departmentId: deptId || undefined,
    termId:       termId || undefined,
  });

  const depts   = data?.departments ?? [];
  const classes = data?.classes     ?? [];
  const terms   = data?.terms       ?? [];
  const deptList= data?.deptList    ?? [];

  const sorted = [...depts].sort((a, b) => parseFloat(b.pct ?? '0') - parseFloat(a.pct ?? '0'));
  const top    = sorted.slice(0, 3);
  const bottom = [...sorted].reverse().slice(0, 3).filter(d => parseFloat(d.pct ?? '0') > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Branch Data" subtitle="Department and class-level attendance breakdown" />

      {error && <Alert variant="destructive">Failed to load branch data.</Alert>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={deptId} onChange={e => setDeptId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">All departments</option>
          {deptList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={termId} onChange={e => setTermId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">All terms</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_active ? ' (current)' : ''}</option>)}
        </select>
        <div className="flex rounded-lg border border-border p-0.5 gap-0.5 ml-auto">
          {(['departments', 'classes'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Department view */}
      {view === 'departments' && (
        <>
          {/* Bar chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Attendance by Department</h2>
            {isLoading ? <div className="h-[200px] bg-muted/30 rounded-lg animate-pulse" /> : (
              <>
                <DeptBarChart data={depts} height={Math.max(160, depts.length * 40)} />
                <p className="text-xs text-muted-foreground mt-2 text-center">Dashed line = 75% threshold</p>
              </>
            )}
          </div>

          {/* Top / Bottom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-success/30 bg-success/5 p-5">
              <h2 className="text-sm font-semibold text-success mb-4 flex items-center gap-2">
                <Award className="h-4 w-4" /> Top Performing
              </h2>
              {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
                <div className="space-y-3">
                  {top.map((d, i) => (
                    <div key={d.department} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success text-xs font-bold flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.department}</p>
                        <p className="text-xs text-muted-foreground">{d.students} students</p>
                      </div>
                      <span className="text-sm font-bold text-success">{parseFloat(d.pct ?? '0') > 0 ? `${d.pct}%` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
              <h2 className="text-sm font-semibold text-warning mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Needs Attention
              </h2>
              {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : bottom.length === 0 ? (
                <p className="text-sm text-muted-foreground">All departments performing well</p>
              ) : (
                <div className="space-y-3">
                  {bottom.map((d, i) => {
                    const pct = parseFloat(d.pct ?? '0');
                    return (
                      <div key={d.department} className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-warning text-xs font-bold flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{d.department}</p>
                          <p className="text-xs text-muted-foreground">{d.students} students</p>
                        </div>
                        <span className={cn('text-sm font-bold', attendanceColor(pct))}>{pct > 0 ? `${pct}%` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* All dept cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />) : sorted.map(d => {
              const pct = parseFloat(d.pct ?? '0');
              return (
                <div key={d.department} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{d.department}</p>
                      <p className="text-xs text-muted-foreground">{d.students} students</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Avg Attendance</span>
                      <span className={cn('font-bold', attendanceColor(pct))}>{pct > 0 ? `${pct}%` : 'No data'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive')}
                        style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-center">
                    <div className="rounded-md bg-muted/50 py-1.5"><p className="font-bold text-foreground">{d.attended ?? 0}</p><p className="text-muted-foreground">Attended</p></div>
                    <div className="rounded-md bg-muted/50 py-1.5"><p className="font-bold text-foreground">{d.total_records ?? 0}</p><p className="text-muted-foreground">Total</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Class view */}
      {view === 'classes' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Department</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Enrolled</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sessions</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Avg %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
              )) : classes.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />No class data
                </td></tr>
              ) : classes.map(c => {
                const pct = parseFloat(c.avg_pct ?? '0');
                return (
                  <tr key={c.class_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.course_code}</p>
                      <p className="text-xs text-muted-foreground">{c.course_name}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.department}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{c.enrolled}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{c.sessions}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-bold', attendanceColor(pct))}>{pct > 0 ? `${pct}%` : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
