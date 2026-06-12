/**
 * Professor Reports — lecture-wise, subject summary, defaulters.
 * Exports: CSV (instant) and PDF (jsPDF, client-side).
 */
import { useState, useMemo } from 'react';
import {
  BarChart3, Download, FileText, Table2,
  TrendingUp, TrendingDown, Users, BookOpen,
  AlertTriangle, ChevronDown, Loader2, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFacultyReports } from '../../hooks/useProfessorDashboard';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { FiltersPanel, FilterGroup, FilterInput, FilterSelect } from '../../components/ui/FiltersPanel';
import { PageSection } from '../../components/ui/PageSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { ChartCard } from '../../components/ui/ChartCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { cn, attendanceColor } from '../../lib/utils';
import { exportCSV, exportPDF, fmtDate, fmtDateTime, fmtPct } from '../../lib/exportReport';
import { api } from '../../lib/api';
import type { LectureReport, SubjectSummary } from '../../hooks/useProfessorDashboard';

type ViewTab = 'summary' | 'lectures' | 'defaulters';

// ── Summary stat cards ────────────────────────────────────────────────────────

function SummaryCards({ summary, loading }: { summary: SubjectSummary[]; loading: boolean }) {
  const totals = useMemo(() => {
    const sessions  = summary.reduce((a, s) => a + parseInt(String(s.total_sessions), 10), 0);
    const expected  = summary.reduce((a, s) => a + parseInt(String(s.total_expected), 10), 0);
    const present   = summary.reduce((a, s) => a + parseInt(String(s.total_present), 10), 0);
    const absent    = summary.reduce((a, s) => a + parseInt(String(s.total_absent), 10), 0);
    const pct       = expected > 0 ? Math.round((present / expected) * 100) : 0;
    return { sessions, expected, present, absent, pct };
  }, [summary]);

  const cards = [
    { label: 'Total Sessions',   value: loading ? '—' : String(totals.sessions),  icon: BookOpen,      iconBg: 'bg-primary/10',     iconColor: 'text-primary' },
    { label: 'Avg Attendance',   value: loading ? '—' : `${totals.pct}%`,          icon: TrendingUp,    iconBg: totals.pct >= 75 ? 'bg-success/10' : 'bg-warning/10', iconColor: totals.pct >= 75 ? 'text-success' : 'text-warning' },
    { label: 'Total Present',    value: loading ? '—' : String(totals.present),    icon: Users,         iconBg: 'bg-success/10',     iconColor: 'text-success' },
    { label: 'Total Absent',     value: loading ? '—' : String(totals.absent),     icon: TrendingDown,  iconBg: 'bg-destructive/10', iconColor: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', c.iconBg)}>
              <c.icon className={cn('h-4 w-4', c.iconColor)} />
            </div>
          </div>
          {loading
            ? <Skeleton className="h-8 w-20 mt-2" />
            : <p className="text-3xl font-bold text-foreground tabular mt-2">{c.value}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Subject summary cards ─────────────────────────────────────────────────────

function SubjectCards({ summary, loading }: { summary: SubjectSummary[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="stat-card space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4].map(j => <Skeleton key={j} className="h-10 rounded-md" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (summary.length === 0) return <EmptyState icon={BarChart3} title="No data" description="Try adjusting your filters." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {summary.map(s => {
        const pct = parseFloat(String(s.avg_pct ?? '0'));
        return (
          <div key={s.course_code} className="stat-card space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{s.course_code}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.course_name}</p>
              </div>
              <span className={cn('text-2xl font-bold tabular', attendanceColor(pct))}>
                {pct > 0 ? `${pct}%` : '—'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500',
                  pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive')}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: 'Sessions', value: s.total_sessions },
                { label: 'Present',  value: s.total_present,  color: 'text-success' },
                { label: 'Late',     value: s.total_late,     color: 'text-warning' },
                { label: 'Absent',   value: s.total_absent,   color: 'text-destructive' },
              ].map(stat => (
                <div key={stat.label} className="rounded-md bg-muted/50 py-2">
                  <p className={cn('font-bold text-sm', stat.color ?? 'text-foreground')}>{stat.value}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Export dropdown ───────────────────────────────────────────────────────────

interface ExportMenuProps {
  onCSV: () => void;
  onPDF: () => void;
  loading: boolean;
  disabled?: boolean;
}

function ExportMenu({ onCSV, onPDF, loading, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={onCSV}
          disabled={disabled || loading}
          className="flex items-center gap-2 h-9 px-3 bg-primary text-primary-foreground rounded-l-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          disabled={disabled || loading}
          className="flex items-center px-2 h-9 bg-primary text-primary-foreground rounded-r-lg border-l border-primary-foreground/20 hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-card shadow-elevated overflow-hidden animate-slide-up">
            <button onClick={() => { onCSV(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors">
              <Table2 className="h-4 w-4 text-success" /> Export as CSV
            </button>
            <button onClick={() => { onPDF(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors border-t border-border">
              <FileText className="h-4 w-4 text-destructive" /> Export as PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfessorReports() {
  const { user } = useAuthStore();
  const [tab, setTab]             = useState<ViewTab>('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = {
    startDate:  startDate  || undefined,
    endDate:    endDate    || undefined,
    courseCode: courseCode || undefined,
  };

  const { data, isLoading, error, refetch, isFetching } = useFacultyReports(user?.id, filters);

  const lectures  = data?.lectures  ?? [];
  const summary   = data?.summary   ?? [];
  const courses   = data?.courses   ?? [];
  const defaulters = useMemo(() =>
    (data as unknown as { defaulters?: unknown[] } | undefined)?.defaulters ?? [],
  [data]);

  // ── Export handlers ─────────────────────────────────────────────────────────

  const LECTURE_COLS = [
    { header: 'Course',    key: 'course_code' },
    { header: 'Name',      key: 'course_name' },
    { header: 'Type',      key: 'session_type' },
    { header: 'Date',      key: 'scheduled_start', format: (v: unknown) => fmtDate(String(v)) },
    { header: 'Time',      key: 'scheduled_start', format: (v: unknown) => new Date(String(v)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
    { header: 'Location',  key: 'location' },
    { header: 'Expected',  key: 'expected_count' },
    { header: 'Present',   key: 'present_count' },
    { header: 'Late',      key: 'late_count' },
    { header: 'Absent',    key: 'absent_count' },
    { header: 'Att %',     key: 'attendance_pct', format: fmtPct },
    { header: 'Status',    key: 'status' },
  ];

  const SUMMARY_COLS = [
    { header: 'Course',    key: 'course_code' },
    { header: 'Name',      key: 'course_name' },
    { header: 'Sessions',  key: 'total_sessions' },
    { header: 'Expected',  key: 'total_expected' },
    { header: 'Present',   key: 'total_present' },
    { header: 'Late',      key: 'total_late' },
    { header: 'Absent',    key: 'total_absent' },
    { header: 'Avg %',     key: 'avg_pct', format: fmtPct },
  ];

  const DEFAULTER_COLS = [
    { header: 'Name',      key: 'first_name', format: (_: unknown, row?: Record<string, unknown>) => `${row?.first_name} ${row?.last_name}` },
    { header: 'Roll No',   key: 'roll_number' },
    { header: 'Email',     key: 'email' },
    { header: 'Course',    key: 'course_code' },
    { header: 'Total',     key: 'total' },
    { header: 'Attended',  key: 'attended' },
    { header: 'Absent',    key: 'absent' },
    { header: 'Att %',     key: 'pct', format: fmtPct },
  ];

  const metaFilters = {
    'From':    startDate  || undefined,
    'To':      endDate    || undefined,
    'Course':  courseCode || undefined,
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const r = await api.getFacultyReportsExport(user!.id, filters);
      const d = r.data;
      if (tab === 'lectures')   exportCSV(d.lectures,  LECTURE_COLS,  `lecture-report-${user?.lastName ?? ''}`);
      if (tab === 'summary')    exportCSV(d.summary,   SUMMARY_COLS,  `summary-report-${user?.lastName ?? ''}`);
      if (tab === 'defaulters') exportCSV(d.defaulters, DEFAULTER_COLS.map(c => ({ ...c, format: c.key === 'first_name' ? (v: unknown, row?: Record<string, unknown>) => `${row?.first_name ?? v} ${row?.last_name ?? ''}` : c.format })), `defaulters-${user?.lastName ?? ''}`);
    } finally { setExporting(false); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const r = await api.getFacultyReportsExport(user!.id, filters);
      const d = r.data;
      const meta = {
        title: 'Faculty Attendance Report',
        subtitle: `${d.meta?.faculty_name ?? ''} · SmartAttend`,
        generatedBy: d.meta?.faculty_name,
        filters: metaFilters,
      };
      exportPDF([
        { title: 'Subject Summary',  columns: SUMMARY_COLS,   rows: d.summary },
        { title: 'Lecture-wise Data', columns: LECTURE_COLS,  rows: d.lectures },
        { title: 'Defaulters (< 75%)', columns: DEFAULTER_COLS.map(c => ({ ...c, format: c.key === 'first_name' ? (v: unknown, row?: Record<string, unknown>) => `${row?.first_name ?? v} ${row?.last_name ?? ''}` : c.format })), rows: d.defaulters },
      ], meta, `faculty-report-${user?.lastName ?? ''}`);
    } finally { setExporting(false); }
  };

  const tabs: { key: ViewTab; label: string; count?: number }[] = [
    { key: 'summary',    label: 'Subject Summary',  count: summary.length },
    { key: 'lectures',   label: 'Lecture-wise',      count: lectures.length },
    { key: 'defaulters', label: 'Defaulters',        count: (defaulters as unknown[]).length },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Reports"
        subtitle="Lecture-wise attendance data, subject summaries, and defaulter analysis"
        action={
          <ExportMenu
            onCSV={handleExportCSV}
            onPDF={handleExportPDF}
            loading={exporting}
            disabled={isLoading}
          />
        }
      />

      {error && <Alert variant="destructive">Failed to load reports. Please try again.</Alert>}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <FiltersPanel
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        <FilterGroup label="From Date">
          <FilterInput type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
        </FilterGroup>
        <FilterGroup label="To Date">
          <FilterInput type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
        </FilterGroup>
        <FilterGroup label="Course">
          <FilterSelect value={courseCode} onChange={e => setCourseCode(e.target.value)} className="w-52">
            <option value="">All courses</option>
            {courses.map(c => (
              <option key={c.course_code} value={c.course_code}>{c.course_code} — {c.course_name}</option>
            ))}
          </FilterSelect>
        </FilterGroup>
      </FiltersPanel>

      {/* ── Summary stat cards ───────────────────────────────────────────── */}
      <SummaryCards summary={summary} loading={isLoading} />

      {/* ── Defaulter warning ────────────────────────────────────────────── */}
      {!isLoading && (defaulters as unknown[]).length > 0 && (
        <AlertBanner
          variant="warning"
          title={`${(defaulters as unknown[]).length} student${(defaulters as unknown[]).length !== 1 ? 's' : ''} below 75% attendance`}
          description="Review the Defaulters tab and consider notifying students or parents."
        />
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex rounded-lg border border-border p-0.5 gap-0.5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}>
            {t.label}
            {t.count !== undefined && (
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-bold',
                tab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {tab === 'summary' && (
        <PageSection>
          <SubjectCards summary={summary} loading={isLoading} />
        </PageSection>
      )}

      {tab === 'lectures' && (
        <PageSection>
          <ChartCard title="Lecture-wise Attendance" subtitle={`${lectures.length} sessions`} loading={isLoading} bodyClassName="p-0">
            {lectures.length === 0 ? (
              <div className="p-6"><EmptyState icon={BarChart3} title="No lectures found" description="Try adjusting your filters." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th className="hidden md:table-cell">Date & Time</th>
                        <th className="hidden lg:table-cell">Location</th>
                        <th className="text-center">Present / Expected</th>
                        <th className="text-center">Att %</th>
                        <th className="text-center hidden md:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lectures.map((l: LectureReport) => {
                        const pct = parseFloat(String(l.attendance_pct ?? '0'));
                        return (
                          <tr key={l.session_id}>
                            <td>
                              <p className="font-medium text-foreground">{l.course_code}</p>
                              <p className="text-xs text-muted-foreground capitalize">{l.session_type}</p>
                            </td>
                            <td className="hidden md:table-cell">
                              <p className="text-sm">{fmtDate(l.scheduled_start)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(l.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </td>
                            <td className="hidden lg:table-cell truncate-cell text-muted-foreground">{l.location || '—'}</td>
                            <td className="text-center tabular">
                              <span className="font-medium">{l.present_count}</span>
                              <span className="text-muted-foreground">/{l.expected_count}</span>
                            </td>
                            <td className="text-center">
                              <span className={cn('font-bold text-sm', attendanceColor(pct))}>
                                {pct > 0 ? `${pct}%` : '—'}
                              </span>
                            </td>
                            <td className="text-center hidden md:table-cell">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                                l.status === 'active'    ? 'bg-success/10 text-success' :
                                l.status === 'completed' ? 'bg-muted text-muted-foreground' :
                                                           'bg-info/10 text-info',
                              )}>{l.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span>{lectures.length} lecture{lectures.length !== 1 ? 's' : ''}</span>
                  <span className="hidden sm:block">
                    {fmtDateTime(lectures[lectures.length - 1]?.scheduled_start)} – {fmtDateTime(lectures[0]?.scheduled_start)}
                  </span>
                </div>
              </>
            )}
          </ChartCard>
        </PageSection>
      )}

      {tab === 'defaulters' && (
        <PageSection>
          <ChartCard title="Defaulters (below 75%)" subtitle={`${(defaulters as unknown[]).length} students`} loading={isLoading} bodyClassName="p-0">
            {(defaulters as unknown[]).length === 0 ? (
              <div className="p-6"><EmptyState icon={Users} title="No defaulters" description="All students are above the 75% threshold." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th className="hidden md:table-cell">Course</th>
                        <th className="text-center">Attended / Total</th>
                        <th className="text-center">Att %</th>
                        <th className="text-center hidden lg:table-cell">Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(defaulters as Record<string, unknown>[]).map((d, i) => {
                        const pct = parseFloat(String(d.pct ?? '0'));
                        return (
                          <tr key={String(d.id ?? i)}>
                            <td>
                              <p className="font-medium text-foreground">{String(d.first_name)} {String(d.last_name)}</p>
                              <p className="text-xs text-muted-foreground">{String(d.roll_number ?? d.email ?? '')}</p>
                            </td>
                            <td className="hidden md:table-cell">
                              <p className="text-sm font-medium">{String(d.course_code ?? '')}</p>
                              <p className="text-xs text-muted-foreground">{String(d.course_name ?? '')}</p>
                            </td>
                            <td className="text-center tabular text-sm">
                              <span className="font-medium text-success">{String(d.attended ?? '0')}</span>
                              <span className="text-muted-foreground">/{String(d.total ?? '0')}</span>
                            </td>
                            <td className="text-center">
                              <span className={cn('font-bold text-sm', attendanceColor(pct))}>{pct}%</span>
                            </td>
                            <td className="text-center hidden lg:table-cell text-destructive font-medium tabular">
                              {String(d.absent ?? '0')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span className="flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {(defaulters as unknown[]).length} student{(defaulters as unknown[]).length !== 1 ? 's' : ''} at risk
                  </span>
                </div>
              </>
            )}
          </ChartCard>
        </PageSection>
      )}
    </div>
  );
}
