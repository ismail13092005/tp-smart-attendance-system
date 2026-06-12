// AttendanceSheet

/**
 * AttendanceSheet — operational faculty page for daily attendance management.
 *
 * Features:
 *  - Session selector with session info header
 *  - Summary bar (present / late / absent / not-marked counts)
 *  - Sticky toolbar: search + status filter pills + bulk-mark + export
 *  - Searchable, sortable table with status pills and verification badges
 *  - Row-level manual edit (OverrideModal) — requires reason, writes audit log
 *  - Bulk mark with policy guard (only when session is active/completed)
 *  - CSV export
 *  - Full loading / error / empty states
 */
import { useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, QrCode, Camera, MapPin, Edit2, Download,
  CheckCircle2, XCircle, Clock, HelpCircle, RefreshCw,
  ChevronDown, Users, AlertTriangle, CheckSquare, Square,
  ArrowUpDown, Info,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSessions, useSessionSheet, useBulkMark } from '../../hooks/useProfessorDashboard';
import { OverrideModal } from '../../components/professor/OverrideModal';
import { downloadCSV } from '../../components/professor/ExportButton';
import { exportSessionSheetPDF } from '../../lib/pdf-export';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/utils';
import type { SheetRow, ProfSession } from '../../hooks/useProfessorDashboard';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'present' | 'late' | 'absent' | 'not_marked';
type SortKey = 'name' | 'roll' | 'status' | 'marked_at';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusIcon(status: string | null) {
  if (status === 'present') return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === 'late')    return <Clock        className="h-4 w-4 text-warning" />;
  if (status === 'absent')  return <XCircle      className="h-4 w-4 text-destructive" />;
  if (status === 'excused') return <Info         className="h-4 w-4 text-info" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
}

function statusVariant(status: string | null): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  if (status === 'present') return 'success';
  if (status === 'late')    return 'warning';
  if (status === 'absent')  return 'destructive';
  if (status === 'excused') return 'info';
  return 'secondary';
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function attendancePct(present: number, late: number, total: number) {
  if (!total) return 0;
  return Math.round(((present + late) / total) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerifBadge({ icon: Icon, ok, label }: { icon: React.ElementType; ok: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${ok ? 'verified' : 'not verified'}`}
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold',
        ok ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground/60',
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {ok ? '✓' : '—'}
    </span>
  );
}

interface SummaryBarProps {
  total: number;
  present: number;
  late: number;
  absent: number;
  notMarked: number;
  activeFilter: StatusFilter;
  onFilter: (f: StatusFilter) => void;
}

function SummaryBar({ total, present, late, absent, notMarked, activeFilter, onFilter }: SummaryBarProps) {
  const pct = attendancePct(present, late, total);

  const pills: { key: StatusFilter; label: string; count: number; color: string; active: string }[] = [
    { key: 'all',        label: 'All',        count: total,     color: 'text-foreground border-border',                                active: 'bg-foreground/10 border-foreground/30 ring-2 ring-foreground/10' },
    { key: 'present',    label: 'Present',    count: present,   color: 'text-success border-success/30',                              active: 'bg-success/10 border-success/40 ring-2 ring-success/20' },
    { key: 'late',       label: 'Late',       count: late,      color: 'text-warning border-warning/30',                              active: 'bg-warning/10 border-warning/40 ring-2 ring-warning/20' },
    { key: 'absent',     label: 'Absent',     count: absent,    color: 'text-destructive border-destructive/30',                      active: 'bg-destructive/10 border-destructive/40 ring-2 ring-destructive/20' },
    { key: 'not_marked', label: 'Not Marked', count: notMarked, color: 'text-muted-foreground border-border',                         active: 'bg-muted border-border ring-2 ring-border' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span className="font-medium text-foreground">{total} students enrolled</span>
        <span className={cn('font-semibold tabular', pct >= 75 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive')}>
          {pct}% attendance
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        {total > 0 && (
          <>
            <div className="bg-success transition-all duration-500" style={{ width: `${(present / total) * 100}%` }} />
            <div className="bg-warning transition-all duration-500" style={{ width: `${(late / total) * 100}%` }} />
            <div className="bg-destructive transition-all duration-500" style={{ width: `${(absent / total) * 100}%` }} />
          </>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map(p => (
          <button
            key={p.key}
            onClick={() => onFilter(p.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
              activeFilter === p.key ? p.active : `bg-card ${p.color} hover:bg-muted/40`,
            )}
          >
            {p.label}
            <span className="font-bold">{p.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Session info header ───────────────────────────────────────────────────────

function SessionInfoBanner({ session }: { session: ProfSession }) {
  const statusColor =
    session.status === 'active'    ? 'text-success bg-success/10 border-success/30' :
    session.status === 'completed' ? 'text-muted-foreground bg-muted border-border' :
    session.status === 'scheduled' ? 'text-info bg-info/10 border-info/30' :
                                     'text-destructive bg-destructive/10 border-destructive/30';
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Course</p>
        <p className="font-semibold text-foreground">{session.course_code} — {session.course_name}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Type</p>
        <p className="font-medium capitalize">{session.session_type}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Time</p>
        <p className="font-medium tabular">
          {fmtDateTime(session.scheduled_start)} – {fmtTime(session.scheduled_end)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Location</p>
        <p className="font-medium">{session.location || '—'}</p>
      </div>
      <div className="ml-auto">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize', statusColor)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', {
            'bg-success': session.status === 'active',
            'bg-muted-foreground': session.status === 'completed',
            'bg-info': session.status === 'scheduled',
            'bg-destructive': session.status === 'cancelled',
          })} />
          {session.status}
        </span>
      </div>
    </div>
  );
}

// ── Bulk mark modal ───────────────────────────────────────────────────────────

interface BulkMarkModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  selectedIds: string[];
  onSuccess: () => void;
}

const BULK_STATUSES = [
  { value: 'present', label: 'Present', color: 'text-success', dot: 'bg-success' },
  { value: 'absent',  label: 'Absent',  color: 'text-destructive', dot: 'bg-destructive' },
  { value: 'late',    label: 'Late',    color: 'text-warning', dot: 'bg-warning' },
  { value: 'excused', label: 'Excused', color: 'text-info', dot: 'bg-info' },
];

function BulkMarkModal({ open, onClose, sessionId, selectedIds, onSuccess }: BulkMarkModalProps) {
  const [status, setStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const bulk = useBulkMark();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required for audit trail'); return; }
    setError('');
    try {
      await bulk.mutateAsync({ sessionId, studentIds: selectedIds, status, reason });
      onSuccess();
      onClose();
      setReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk mark failed');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bulk Mark Attendance" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Audited bulk action</p>
            <p className="text-xs mt-0.5 opacity-80">
              Marking <strong>{selectedIds.length}</strong> student{selectedIds.length !== 1 ? 's' : ''}. All changes are logged.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mark all as</label>
            <div className="grid grid-cols-2 gap-2">
              {BULK_STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all',
                    status === s.value
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
                  )}>
                  <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Lab cancelled — all students marked absent"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={bulk.isPending || !reason.trim()}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {bulk.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              Apply to {selectedIds.length}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendanceSheet() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get('session') ?? '';

  // Filters & UI state
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [sortKey, setSortKey]             = useState<SortKey>('name');
  const [sortDir, setSortDir]             = useState<SortDir>('asc');
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [overrideTarget, setOverrideTarget] = useState<SheetRow | null>(null);
  const [bulkOpen, setBulkOpen]           = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Data
  const { data: sessions, isLoading: sessionsLoading } = useSessions(user?.id);
  const {
    data: sheet,
    isLoading: sheetLoading,
    error,
    refetch,
    isFetching,
  } = useSessionSheet(user?.id, selectedSessionId || undefined);

  const selectedSession = sessions?.find(s => s.id === selectedSessionId);

  // Policy: bulk mark only allowed for active or completed sessions
  const bulkAllowed = selectedSession?.status === 'active' || selectedSession?.status === 'completed';

  // Counts
  const counts = useMemo(() => ({
    present:    sheet?.filter(r => r.status === 'present').length ?? 0,
    late:       sheet?.filter(r => r.status === 'late').length    ?? 0,
    absent:     sheet?.filter(r => r.status === 'absent').length  ?? 0,
    notMarked:  sheet?.filter(r => !r.status).length              ?? 0,
    total:      sheet?.length ?? 0,
  }), [sheet]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    if (!sheet) return [];
    let rows = sheet.filter(row => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        `${row.first_name} ${row.last_name}`.toLowerCase().includes(q) ||
        (row.roll_number ?? '').toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'all'        ? true :
        statusFilter === 'not_marked' ? !row.status :
        row.status === statusFilter;
      return matchSearch && matchStatus;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')      cmp = `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`);
      if (sortKey === 'roll')      cmp = (a.roll_number ?? '').localeCompare(b.roll_number ?? '');
      if (sortKey === 'status')    cmp = (a.status ?? 'zzz').localeCompare(b.status ?? 'zzz');
      if (sortKey === 'marked_at') cmp = (a.marked_at ?? '').localeCompare(b.marked_at ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [sheet, search, statusFilter, sortKey, sortDir]);

  // Selection helpers
  const allFilteredIds = filtered.map(r => r.student_id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected   = allFilteredIds.some(id => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) allFilteredIds.forEach(id => next.delete(id));
      else             allFilteredIds.forEach(id => next.add(id));
      return next;
    });
  }, [allSelected, allFilteredIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  // Sort toggle
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // CSV export
  const handleExportCSV = () => {
    if (!sheet) return;
    downloadCSV(sheet.map(r => ({
      'Roll No':   r.roll_number ?? '',
      'Name':      `${r.first_name} ${r.last_name}`,
      'Email':     r.email,
      'Status':    r.status ?? 'not_marked',
      'Marked At': r.marked_at ? new Date(r.marked_at).toLocaleString() : '',
      'QR':        r.qr_verified   ? 'Yes' : 'No',
      'Face':      r.face_verified  ? 'Yes' : 'No',
      'Geo':       r.geo_verified   ? 'Yes' : 'No',
      'Override':  r.is_manual_override ? 'Yes' : 'No',
      'Reason':    r.override_reason ?? '',
    })), `attendance-${selectedSession?.course_code ?? 'sheet'}`);
  };

  // PDF export
  const handleExportPDF = () => {
    if (!sheet || !selectedSession) return;
    exportSessionSheetPDF(selectedSession, sheet);
  };

  const selectedCount = [...selected].filter(id => allFilteredIds.includes(id)).length;

  return (
    <div className="page-container">
      {/* Page header */}
      <PageHeader
        title="Attendance Sheet"
        subtitle="View, verify, and manage student attendance per session"
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/professor/generate-qr"
              className="flex items-center gap-2 border border-border bg-card px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <QrCode className="h-4 w-4" /> New Session
            </Link>
          </div>
        }
      />

      {error && <Alert variant="destructive">Failed to load attendance sheet. Please try again.</Alert>}

      {/* ── Session selector ─────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Select Session</label>
        {sessionsLoading ? (
          <Skeleton className="h-9 w-full rounded-lg" />
        ) : (
          <select
            value={selectedSessionId}
            onChange={e => { setSearchParams({ session: e.target.value }); clearSelection(); }}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— Select a session —</option>
            {sessions?.map(s => (
              <option key={s.id} value={s.id}>
                {s.course_code} · {fmtDateTime(s.scheduled_start)} · {s.status}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Empty state: no session selected ────────────────────────────── */}
      {!selectedSessionId && (
        <div className="empty-state mt-4">
          <div className="empty-state-icon">
            <QrCode className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="empty-state-title">No session selected</p>
          <p className="empty-state-desc">
            Choose a session above to view and manage attendance.
          </p>
        </div>
      )}

      {selectedSessionId && (
        <>
          {/* ── Session info banner ──────────────────────────────────────── */}
          {selectedSession && <SessionInfoBanner session={selectedSession} />}

          {/* ── Summary bar ─────────────────────────────────────────────── */}
          {sheetLoading ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : (
            <SummaryBar
              total={counts.total}
              present={counts.present}
              late={counts.late}
              absent={counts.absent}
              notMarked={counts.notMarked}
              activeFilter={statusFilter}
              onFilter={f => { setStatusFilter(f); clearSelection(); }}
            />
          )}

          {/* ── Sticky toolbar ───────────────────────────────────────────── */}
          <div
            ref={toolbarRef}
            className="sticky top-0 z-10 rounded-xl border border-border bg-card/95 backdrop-blur-sm px-4 py-3 flex flex-wrap items-center gap-3"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, roll, email…"
                className="filter-input pl-9 w-full"
              />
            </div>

            {/* Selection info + bulk actions */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  <strong>{selectedCount}</strong> selected
                </span>
                {bulkAllowed ? (
                  <button
                    onClick={() => setBulkOpen(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Bulk Mark
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground italic" title="Bulk mark only available for active/completed sessions">
                    Bulk mark unavailable
                  </span>
                )}
                <button
                  onClick={clearSelection}
                  className="h-8 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Refresh + Export */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              {sheet && sheet.length > 0 && (
                <>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────────────────── */}
          {sheetLoading ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {['', 'Student', 'Roll No', 'Verification', 'Status', 'Marked At', ''].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton className="h-4 w-4 rounded" /></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </td>
                      <td><Skeleton className="h-4 w-16" /></td>
                      <td><Skeleton className="h-5 w-24 rounded-full" /></td>
                      <td><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td><Skeleton className="h-4 w-14" /></td>
                      <td><Skeleton className="h-7 w-7 rounded-md" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="empty-state-title">
                {search || statusFilter !== 'all' ? 'No students match your filters' : 'No students enrolled'}
              </p>
              <p className="empty-state-desc">
                {search || statusFilter !== 'all'
                  ? 'Try clearing the search or changing the status filter.'
                  : 'Students must be enrolled in this class to appear here.'}
              </p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {/* Select all */}
                    <th className="w-10">
                      <button
                        onClick={toggleAll}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                        aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allSelected
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : someSelected
                          ? <ChevronDown className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>

                    {/* Student */}
                    <th>
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Student
                        <ArrowUpDown className={cn('h-3 w-3', sortKey === 'name' ? 'text-primary' : 'opacity-40')} />
                      </button>
                    </th>

                    {/* Roll */}
                    <th className="hidden md:table-cell">
                      <button
                        onClick={() => handleSort('roll')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Roll No
                        <ArrowUpDown className={cn('h-3 w-3', sortKey === 'roll' ? 'text-primary' : 'opacity-40')} />
                      </button>
                    </th>

                    {/* Verification */}
                    <th className="hidden lg:table-cell text-center">Verification</th>

                    {/* Status */}
                    <th className="text-center">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                      >
                        Status
                        <ArrowUpDown className={cn('h-3 w-3', sortKey === 'status' ? 'text-primary' : 'opacity-40')} />
                      </button>
                    </th>

                    {/* Marked at */}
                    <th className="hidden md:table-cell">
                      <button
                        onClick={() => handleSort('marked_at')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Marked At
                        <ArrowUpDown className={cn('h-3 w-3', sortKey === 'marked_at' ? 'text-primary' : 'opacity-40')} />
                      </button>
                    </th>

                    {/* Edit */}
                    <th className="text-center w-12">Edit</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(row => {
                    const isSelected = selected.has(row.student_id);
                    return (
                      <tr
                        key={row.student_id}
                        className={cn(
                          isSelected && 'bg-primary/5',
                          !row.status && 'opacity-70',
                        )}
                      >
                        {/* Checkbox */}
                        <td>
                          <button
                            onClick={() => toggleOne(row.student_id)}
                            className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                            aria-label={isSelected ? 'Deselect' : 'Select'}
                          >
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-primary" />
                              : <Square className="h-4 w-4" />}
                          </button>
                        </td>

                        {/* Student */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                              {row.first_name[0]}{row.last_name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {row.first_name} {row.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Roll */}
                        <td className="hidden md:table-cell text-sm text-muted-foreground tabular">
                          {row.roll_number ?? '—'}
                        </td>

                        {/* Verification */}
                        <td className="hidden lg:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <VerifBadge icon={QrCode}  ok={row.qr_verified}   label="QR" />
                            <VerifBadge icon={Camera}  ok={row.face_verified} label="Face" />
                            <VerifBadge icon={MapPin}  ok={row.geo_verified}  label="Geo" />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="text-center">
                          {row.status ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {statusIcon(row.status)}
                                <Badge variant={statusVariant(row.status)} className="capitalize">
                                  {row.status}
                                </Badge>
                              </div>
                              {row.is_manual_override && (
                                <span className="text-[10px] text-warning font-medium">override</span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                              <HelpCircle className="h-3.5 w-3.5" />
                              not marked
                            </span>
                          )}
                        </td>

                        {/* Marked at */}
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-foreground tabular">{fmtTime(row.marked_at)}</p>
                          {row.face_confidence != null && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Face {Math.round(row.face_confidence * 100)}%
                            </p>
                          )}
                        </td>

                        {/* Edit */}
                        <td className="text-center">
                          <button
                            onClick={() => setOverrideTarget(row)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Manual override"
                            aria-label={`Edit attendance for ${row.first_name} ${row.last_name}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table footer */}
              <div className="table-footer">
                <span>
                  Showing <strong>{filtered.length}</strong> of <strong>{counts.total}</strong> students
                </span>
                <span className="hidden sm:block">
                  {counts.present + counts.late} present · {counts.absent} absent · {counts.notMarked} not marked
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Override modal ───────────────────────────────────────────────── */}
      {overrideTarget && selectedSessionId && (
        <OverrideModal
          open={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          sessionId={selectedSessionId}
          student={{
            id:            overrideTarget.student_id,
            name:          `${overrideTarget.first_name} ${overrideTarget.last_name}`,
            currentStatus: overrideTarget.status,
          }}
        />
      )}

      {/* ── Bulk mark modal ──────────────────────────────────────────────── */}
      {bulkOpen && selectedSessionId && (
        <BulkMarkModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          sessionId={selectedSessionId}
          selectedIds={[...selected].filter(id => allFilteredIds.includes(id))}
          onSuccess={clearSelection}
        />
      )}
    </div>
  );
}
