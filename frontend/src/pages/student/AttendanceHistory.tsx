/**
 * Attendance History — date-wise logs with filters
 * - Filter by date range
 * - Filter by subject
 * - Filter by status
 * - Shows: subject, lecture time, location, status, face confidence
 */
import { useState } from 'react';
import { Calendar, Filter, X, CheckCircle2, XCircle, Clock, AlertTriangle, Download } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useStudentHistory } from '../../hooks/useStudentDashboard';
import { EmptyState } from '../../components/student/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/layout/PageHeader';
import { downloadCSV } from '../../components/professor/ExportButton';
import { exportStudentAttendancePDF } from '../../lib/pdf-export';
import { cn } from '../../lib/utils';

type StatusFilter = 'all' | 'present' | 'late' | 'absent' | 'excused';

const STATUS_ICON = {
  present: CheckCircle2,
  late:    Clock,
  absent:  XCircle,
  excused: AlertTriangle,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function AttendanceHistory() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error } = useStudentHistory(user?.id, {
    startDate: startDate || undefined,
    endDate:   endDate   || undefined,
    courseCode: courseCode || undefined,
  });

  const records = data?.records ?? [];
  const subjects = data?.subjects ?? [];

  const filtered = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter);

  const counts = {
    present: records.filter(r => r.status === 'present').length,
    late:    records.filter(r => r.status === 'late').length,
    absent:  records.filter(r => r.status === 'absent').length,
    excused: records.filter(r => r.status === 'excused').length,
  };

  const hasActiveFilters = startDate || endDate || courseCode;

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCourseCode('');
  };

  const handleExportCSV = () => {
    if (!filtered.length) return;
    downloadCSV(filtered.map(r => ({
      'Date':     new Date(r.scheduled_start).toLocaleDateString(),
      'Course':   `${r.course_code} — ${r.course_name}`,
      'Type':     r.session_type,
      'Faculty':  r.faculty_name,
      'Location': r.location,
      'Status':   r.status,
      'Marked At': r.marked_at ? new Date(r.marked_at).toLocaleString() : '',
    })), `my-attendance-${user?.lastName ?? 'student'}`);
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    const total    = records.length;
    const attended = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const pct      = total > 0 ? (attended / total) * 100 : 0;
    exportStudentAttendancePDF(
      `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      filtered,
      { total, attended, pct },
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <PageHeader
        title="Attendance History"
        subtitle="Date-wise attendance logs"
        action={
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
              </>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                showFilters || hasActiveFilters
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  !
                </span>
              )}
            </button>
          </div>
        }
      />

      {error && <Alert variant="destructive">Failed to load attendance history.</Alert>}

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Filter Records</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-destructive hover:underline">
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <select
                value={courseCode}
                onChange={e => setCourseCode(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All subjects</option>
                {subjects.map(s => (
                  <option key={s.course_code} value={s.course_code}>
                    {s.course_code} — {s.course_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',     label: 'All',     count: records.length },
          { key: 'present', label: 'Present', count: counts.present },
          { key: 'late',    label: 'Late',    count: counts.late },
          { key: 'absent',  label: 'Absent',  count: counts.absent },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              statusFilter === f.key
                ? f.key === 'present' ? 'bg-success/15 text-success border-success/40 ring-2 ring-success/20'
                : f.key === 'late'    ? 'bg-warning/15 text-warning border-warning/40 ring-2 ring-warning/20'
                : f.key === 'absent'  ? 'bg-destructive/15 text-destructive border-destructive/40 ring-2 ring-destructive/20'
                : 'bg-primary/10 text-primary border-primary/30 ring-2 ring-primary/20'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
            )}
          >
            {f.label}
            <span className="font-bold">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={hasActiveFilters ? 'No records match your filters' : 'No attendance records yet'}
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Your attendance history will appear here.'}
          action={hasActiveFilters ? (
            <button onClick={clearFilters} className="text-sm text-primary hover:underline">
              Clear filters
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const StatusIcon = STATUS_ICON[r.status as keyof typeof STATUS_ICON] ?? Calendar;
            return (
              <div
                key={r.id}
                className={cn(
                  'rounded-xl border bg-card p-4 flex items-start gap-3 transition-colors hover:bg-muted/20',
                  r.status === 'absent' ? 'border-destructive/20' :
                  r.status === 'late'   ? 'border-warning/20' :
                  'border-border',
                )}
              >
                {/* Status icon */}
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                  r.status === 'present' ? 'bg-success/10' :
                  r.status === 'late'    ? 'bg-warning/10' :
                  r.status === 'absent'  ? 'bg-destructive/10' : 'bg-muted',
                )}>
                  <StatusIcon className={cn(
                    'h-5 w-5',
                    r.status === 'present' ? 'text-success' :
                    r.status === 'late'    ? 'text-warning' :
                    r.status === 'absent'  ? 'text-destructive' : 'text-muted-foreground',
                  )} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{r.course_code}</p>
                      <p className="text-xs text-muted-foreground">{r.course_name}</p>
                    </div>
                    <Badge
                      variant={
                        r.status === 'present' ? 'success' :
                        r.status === 'late'    ? 'warning' :
                        r.status === 'excused' ? 'info'    : 'destructive'
                      }
                      dot
                    >
                      {r.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.scheduled_start)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(r.scheduled_start)} – {formatTime(r.scheduled_end)}
                    </span>
                    {r.location && (
                      <span className="truncate max-w-[140px]">{r.location}</span>
                    )}
                    <span className="capitalize">{r.session_type}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{r.faculty_name}</span>
                    {r.face_confidence != null && (
                      <span className="font-mono">Face: {Math.round(r.face_confidence * 100)}%</span>
                    )}
                    {r.is_manual_override && (
                      <span className="text-warning font-medium">Manual override</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filtered.length} of {records.length} records
        </p>
      )}
    </div>
  );
}
