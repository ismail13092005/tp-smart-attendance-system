/**
 * Admin Reports — attendance trend (daily/weekly/monthly), department summary,
 * defaulter list. Full PDF + CSV export with filters.
 */
import { useState, useMemo } from 'react';
import {
  BarChart3, Download, FileText, Table2,
  TrendingUp, TrendingDown, Users, Building2,
  AlertTriangle, ChevronDown, Loader2, RefreshCw,
} from 'lucide-react';
import { useAdminReports } from '../../hooks/useAdminDashboard';
import { AttendanceTrendChart } from '../../components/admin/AttendanceTrendChart';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { FiltersPanel, FilterGroup, FilterSelect } from '../../components/ui/FiltersPanel';
import { PageSection } from '../../components/ui/PageSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { ChartCard } from '../../components/ui/ChartCard';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { cn, attendanceColor } from '../../lib/utils';
import { exportCSV, exportPDF, fmtDate, fmtPct } from '../../lib/exportReport';
import { api } from '../../lib/api';
import type { TrendPoint, ReportTrendPoint } from '../../hooks/useAdminDashboard';

type Period = 'daily' | 'weekly' | 'monthly';
type ViewTab = 'trend' | 'departments' | 'defaulters';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'Daily',   value: 'daily' },
  { label: 'Weekly',  value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

// ── KPI summary cards ─────────────────────────────────────────────────────────

function AdminSummaryCards({ trend, loading }: { trend: ReportTrendPoint[]; loading: boolean }) {
  const totals = useMemo(() => {
    const sessions  = trend.reduce((a, t) => a + parseInt(String(t.sessions), 10), 0);
    const total     = trend.reduce((a, t) => a + parseInt(String(t.total_records), 10), 0);
    const attended  = trend.reduce((a, t) => a + parseInt(String(t.attended), 10), 0);
    const absent    = trend.reduce((a, t) => a + parseInt(String(t.absent), 10), 0);
    const pct       = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { sessions, total, attended, absent, pct };
  }, [trend]);

  const cards = [
    { label: 'Total Sessions',  value: loading ? '—' : String(totals.sessions),  icon: BarChart3,     iconBg: 'bg-primary/10',     iconColor: 'text-primary' },
    { label: 'Avg Attendance',  value: loading ? '—' : `${totals.pct}%`,          icon: TrendingUp,    iconBg: totals.pct >= 75 ? 'bg-success/10' : 'bg-warning/10', iconColor: totals.pct >= 75 ? 'text-success' : 'text-warning' },
    { label: 'Total Attended',  value: loading ? '—' : String(totals.attended),   icon: Users,         iconBg: 'bg-success/10',     iconColor: 'text-success' },
    { label: 'Total Absent',    value: loading ? '—' : String(totals.absent),     icon: TrendingDown,  iconBg: 'bg-destructive/10', iconColor: 'text-destructive' },
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
        <button onClick={onCSV} disabled={disabled || loading}
          className="flex items-center gap-2 h-9 px-3 bg-primary text-primary-foreground rounded-l-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
        <button onClick={() => setOpen(v => !v)} disabled={disabled || loading}
          className="flex items-center px-2 h-9 bg-primary text-primary-foreground rounded-r-lg border-l border-primary-foreground/20 hover:bg-primary/90 disabled:opacity-50 transition-colors">
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

export default function AdminReports() {
  const [tab, setTab]             = useState<ViewTab>('trend');
  const [period, setPeriod]       = useState<Period>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [deptId, setDeptId]       = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = {
    period,
    startDate:    startDate || undefined,
    endDate:      endDate   || undefined,
    departmentId: deptId    || undefined,
  };

  const { data, isLoading, error, refetch, isFetching } = useAdminReports(filters);

  const trend      = data?.trend      ?? [];
  const defaulters = data?.defaulters ?? [];
  const depts      = data?.departments ?? [];

  // Chart data shape
  const chartData: TrendPoint[] = trend.map(t => ({
    date:     String(t.period).slice(0, 10),
    sessions: t.sessions,
    expected: t.total_records,
    attended: t.attended,
    pct:      t.pct,
  }));

  // ── Column definitions ──────────────────────────────────────────────────────

  const TREND_COLS = [
    { header: 'Period',    key: 'period',       format: (v: unknown) => String(v).slice(0, 10) },
    { header: 'Sessions',  key: 'sessions' },
    { header: 'Total',     key: 'total_records' },
    { header: 'Attended',  key: 'attended' },
    { header: 'Absent',    key: 'absent' },
    { header: 'Att %',     key: 'pct', format: fmtPct },
  ];

  const DEPT_COLS = [
    { header: 'Department', key: 'department' },
    { header: 'Students',   key: 'students' },
    { header: 'Total',      key: 'total_records' },
    { header: 'Attended',   key: 'attended' },
    { header: 'Att %',      key: 'pct', format: fmtPct },
  ];

  const DEFAULTER_COLS = [
    { header: 'Name',       key: 'first_name', format: (_: unknown, row?: Record<string, unknown>) => `${row?.first_name} ${row?.last_name}` },
    { header: 'Roll No',    key: 'roll_number' },
    { header: 'Email',      key: 'email' },
    { header: 'Department', key: 'department' },
    { header: 'Total',      key: 'total' },
    { header: 'Attended',   key: 'attended' },
    { header: 'Att %',      key: 'pct', format: fmtPct },
  ];

  const metaFilters = {
    Period:     period,
    From:       startDate || undefined,
    To:         endDate   || undefined,
    Department: deptId    || undefined,
  };

  // ── Export handlers ─────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const r = await api.getAdminReportsExport(filters);
      const d = r.data;
      if (tab === 'trend')       exportCSV(d.trend,       TREND_COLS,     `attendance-${period}-report`);
      if (tab === 'departments') exportCSV(d.deptSummary, DEPT_COLS,      'department-summary');
      if (tab === 'defaulters')  exportCSV(d.defaulters,  DEFAULTER_COLS.map(c => ({ ...c, format: c.key === 'first_name' ? (_: unknown, row?: Record<string, unknown>) => `${row?.first_name} ${row?.last_name}` : c.format })), 'defaulters-report');
    } finally { setExporting(false); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const r = await api.getAdminReportsExport(filters);
      const d = r.data;
      exportPDF([
        { title: `Attendance Trend (${period})`, columns: TREND_COLS,     rows: d.trend },
        { title: 'Department Summary',           columns: DEPT_COLS,      rows: d.deptSummary },
        { title: 'Defaulters (< 75%)',           columns: DEFAULTER_COLS.map(c => ({ ...c, format: c.key === 'first_name' ? (_: unknown, row?: Record<string, unknown>) => `${row?.first_name} ${row?.last_name}` : c.format })), rows: d.defaulters },
      ], {
        title: 'Admin Attendance Report',
        subtitle: 'SmartAttend — Greenfield University',
        filters: metaFilters,
      }, `admin-report-${period}`);
    } finally { setExporting(false); }
  };

  const tabs: { key: ViewTab; label: string; count?: number }[] = [
    { key: 'trend',       label: 'Attendance Trend' },
    { key: 'departments', label: 'By Department' },
    { key: 'defaulters',  label: 'Defaulters', count: defaulters.length },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Reports"
        subtitle="Attendance reports by period, department, and defaulter analysis"
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
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        <FilterGroup label="Date Range">
          <DateRangeFilter
            label=""
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </FilterGroup>
        <FilterGroup label="Department">
          <FilterSelect value={deptId} onChange={e => setDeptId(e.target.value)} className="w-48">
            <option value="">All departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FilterSelect>
        </FilterGroup>
      </FiltersPanel>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <AdminSummaryCards trend={trend} loading={isLoading} />

      {/* ── Defaulter warning ────────────────────────────────────────────── */}
      {!isLoading && defaulters.length > 0 && (
        <AlertBanner
          variant="warning"
          title={`${defaulters.length} student${defaulters.length !== 1 ? 's' : ''} below 75% attendance`}
          description="Switch to the Defaulters tab to review and export the list."
        />
      )}

      {/* ── Tab bar + period toggle ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5 gap-0.5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-bold',
                  tab === t.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-destructive/10 text-destructive',
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'trend' && (
          <div className="flex rounded-lg border border-border p-0.5 gap-0.5">
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  period === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Trend tab ───────────────────────────────────────────────────── */}
      {tab === 'trend' && (
        <PageSection>
          <ChartCard
            title={`${period.charAt(0).toUpperCase() + period.slice(1)} Attendance Trend`}
            subtitle={`${trend.length} data points`}
            loading={isLoading}
          >
            <AttendanceTrendChart data={chartData} height={240} />
          </ChartCard>

          <ChartCard title="Trend Data" loading={isLoading} bodyClassName="p-0">
            {trend.length === 0 ? (
              <div className="p-6"><EmptyState icon={BarChart3} title="No data" description="Try adjusting your filters." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th className="text-center">Sessions</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">Attended</th>
                        <th className="text-center">Absent</th>
                        <th className="text-center">Att %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading
                        ? Array.from({ length: 7 }).map((_, i) => (
                            <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                          ))
                        : trend.map((t, i) => {
                            const pct = parseFloat(String(t.pct ?? '0'));
                            return (
                              <tr key={i}>
                                <td className="font-medium">{String(t.period).slice(0, 10)}</td>
                                <td className="text-center text-muted-foreground tabular">{t.sessions}</td>
                                <td className="text-center text-muted-foreground tabular">{t.total_records}</td>
                                <td className="text-center text-success font-medium tabular">{t.attended}</td>
                                <td className="text-center text-destructive font-medium tabular">{t.absent}</td>
                                <td className="text-center">
                                  <span className={cn('font-bold', attendanceColor(pct))}>{pct > 0 ? `${pct}%` : '—'}</span>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span>{trend.length} {period} records</span>
                  {trend.length > 0 && (
                    <span className="hidden sm:block">
                      {fmtDate(String(trend[trend.length - 1]?.period))} – {fmtDate(String(trend[0]?.period))}
                    </span>
                  )}
                </div>
              </>
            )}
          </ChartCard>
        </PageSection>
      )}

      {/* ── Departments tab ─────────────────────────────────────────────── */}
      {tab === 'departments' && (
        <PageSection>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="stat-card space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-16" /><Skeleton className="h-2 w-full rounded-full" /></div>)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data as unknown as { deptSummary?: Record<string, unknown>[] } | undefined)?.deptSummary?.map((d: Record<string, unknown>) => {
                  const pct = parseFloat(String(d.pct ?? '0'));
                  return (
                    <div key={String(d.department)} className="stat-card space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {String(d.department ?? '—')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{String(d.students ?? '0')} students</p>
                        </div>
                        <span className={cn('text-xl font-bold tabular', attendanceColor(pct))}>{pct > 0 ? `${pct}%` : '—'}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-500',
                          pct >= 75 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-destructive')}
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Attended: <strong className="text-success">{String(d.attended ?? '0')}</strong></span>
                        <span>Total: <strong>{String(d.total_records ?? '0')}</strong></span>
                      </div>
                    </div>
                  );
                }) ?? <EmptyState icon={Building2} title="No department data" />}
              </div>
            </>
          )}
        </PageSection>
      )}

      {/* ── Defaulters tab ──────────────────────────────────────────────── */}
      {tab === 'defaulters' && (
        <PageSection>
          <ChartCard title="Defaulters (below 75%)" subtitle={`${defaulters.length} students`} loading={isLoading} bodyClassName="p-0">
            {defaulters.length === 0 ? (
              <div className="p-6"><EmptyState icon={Users} title="No defaulters" description="All students are above the 75% threshold." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th className="hidden md:table-cell">Department</th>
                        <th className="text-center">Attended / Total</th>
                        <th className="text-center">Att %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defaulters.map(d => {
                        const pct = parseFloat(String(d.pct ?? '0'));
                        return (
                          <tr key={d.id}>
                            <td>
                              <p className="font-medium text-foreground">{d.first_name} {d.last_name}</p>
                              <p className="text-xs text-muted-foreground">{d.roll_number ?? d.email}</p>
                            </td>
                            <td className="hidden md:table-cell text-muted-foreground">{d.department ?? '—'}</td>
                            <td className="text-center tabular text-sm">
                              <span className="font-medium text-success">{d.attended}</span>
                              <span className="text-muted-foreground">/{d.total}</span>
                            </td>
                            <td className="text-center">
                              <span className={cn('font-bold text-sm', attendanceColor(pct))}>{pct}%</span>
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
                    {defaulters.length} student{defaulters.length !== 1 ? 's' : ''} at risk
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
