/**
 * Defaulters — filterable list with threshold slider and export
 */
import { useState } from 'react';
import { AlertTriangle, Users, Filter } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFacultyDefaulters } from '../../hooks/useProfessorDashboard';
import { ExportButton, downloadCSV } from '../../components/professor/ExportButton';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn } from '../../lib/utils';

export default function Defaulters() {
  const { user } = useAuthStore();
  const [threshold, setThreshold] = useState(75);
  const [courseCode, setCourseCode] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useFacultyDefaulters(user?.id, { threshold, courseCode: courseCode || undefined });

  const defaulters = data?.defaulters ?? [];
  const courses    = data?.courses ?? [];

  const filtered = search
    ? defaulters.filter(d => `${d.first_name} ${d.last_name} ${d.email}`.toLowerCase().includes(search.toLowerCase()))
    : defaulters;

  const handleExport = () => {
    downloadCSV(filtered.map(d => ({
      'Name':       `${d.first_name} ${d.last_name}`,
      'Roll No':    d.roll_number ?? '',
      'Email':      d.email,
      'Course':     d.course_code,
      'Total':      d.total,
      'Attended':   d.attended,
      'Absent':     d.absent,
      'Attendance': `${d.pct}%`,
    })), `defaulters-${threshold}pct`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Defaulters"
        subtitle="Students below attendance threshold"
        action={
          filtered.length > 0
            ? <ExportButton onExportCSV={handleExport} label={`Export (${filtered.length})`} />
            : undefined
        }
      />

      {error && <Alert variant="destructive">Failed to load defaulters.</Alert>}

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Threshold slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-medium text-foreground">Threshold</label>
              <span className={cn('font-bold', threshold <= 60 ? 'text-destructive' : 'text-warning')}>{threshold}%</span>
            </div>
            <input
              type="range" min={50} max={90} step={5} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>50%</span><span>90%</span>
            </div>
          </div>

          {/* Course filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Course</label>
            <select value={courseCode} onChange={e => setCourseCode(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All courses</option>
              {courses.map(c => <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_name}</option>)}
            </select>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Search Student</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name or email…"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className={cn(
          'flex items-center gap-3 rounded-xl border p-4',
          filtered.length === 0 ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5',
        )}>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0',
            filtered.length === 0 ? 'bg-success/15' : 'bg-warning/15',
          )}>
            {filtered.length === 0
              ? <Users className="h-5 w-5 text-success" />
              : <AlertTriangle className="h-5 w-5 text-warning" />
            }
          </div>
          <div>
            <p className={cn('font-semibold text-sm', filtered.length === 0 ? 'text-success' : 'text-warning')}>
              {filtered.length === 0
                ? 'No defaulters at this threshold!'
                : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} below ${threshold}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {filtered.length === 0
                ? 'All students are above the threshold'
                : 'These students need attention'}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Course</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Attended</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Absent</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d, i) => {
                const pct = parseFloat(d.pct ?? '0');
                return (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 text-warning text-xs font-bold flex-shrink-0">
                          {d.first_name[0]}{d.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{d.first_name} {d.last_name}</p>
                          <p className="text-xs text-muted-foreground">{d.roll_number ?? d.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-medium text-foreground">{d.course_code}</p>
                      <p className="text-xs text-muted-foreground">{d.course_name}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{d.attended}/{d.total}</td>
                    <td className="px-4 py-3 text-center text-destructive font-medium">{d.absent}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn('font-bold text-base', pct < 50 ? 'text-destructive' : 'text-warning')}>{pct}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', pct < 50 ? 'bg-destructive' : 'bg-warning')}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
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
