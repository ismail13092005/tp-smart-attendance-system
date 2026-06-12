/**
 * Admin Search — global lookup across students and faculty
 * with attendance profile, pagination, and quick actions
 */
import { useState, useEffect } from 'react';
import { Search as SearchIcon, User, BookOpen, TrendingUp, ChevronRight } from 'lucide-react';
import { useAdminSearch } from '../../hooks/useAdminDashboard';
import { Pagination } from '../../components/admin/Pagination';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn, attendanceColor, formatDateTime } from '../../lib/utils';
import type { SearchResult } from '../../hooks/useAdminDashboard';

const PAGE_SIZE = 20;

type RoleFilter = '' | 'student' | 'faculty' | 'admin' | 'parent';

export default function AdminSearch() {
  const [query, setQuery]       = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [role, setRole]         = useState<RoleFilter>('');
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(query); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useAdminSearch({
    q:     debouncedQ || undefined,
    role:  role || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const results = data?.users ?? [];
  const total   = data?.total ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <PageHeader
        title="Global Search"
        subtitle="Find any student, faculty, or staff member and access their records"
      />

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, student ID, or faculty ID…"
            className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
            autoFocus
          />
        </div>
        <div className="flex rounded-xl border border-border p-1 gap-0.5 bg-card">
          {([
            { value: '',        label: 'All' },
            { value: 'student', label: 'Students' },
            { value: 'faculty', label: 'Faculty' },
          ] as const).map(r => (
            <button key={r.value} onClick={() => { setRole(r.value); setPage(1); }}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                role === r.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {debouncedQ && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total} result${total !== 1 ? 's' : ''} for "${debouncedQ}"` : `No results for "${debouncedQ}"`}
        </p>
      )}

      {/* Layout: results list + detail panel */}
      <div className="flex gap-5">
        {/* Results list */}
        <div className={cn('flex-1 min-w-0', selected && 'hidden md:block md:w-1/2 md:flex-none')}>
          {!debouncedQ ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
              <SearchIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">Start typing to search</p>
              <p className="text-sm text-muted-foreground mt-1">Search by name, email, or ID</p>
            </div>
          ) : isLoading ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <User className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">No results found</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="divide-y divide-border">
                {results.map(u => {
                  const pct = parseFloat(u.attendance_pct ?? '0');
                  const isSelected = selected?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelected(isSelected ? null : u)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-muted/30',
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold flex-shrink-0',
                        u.role === 'student' ? 'bg-primary/10 text-primary' :
                        u.role === 'faculty' ? 'bg-violet-500/10 text-violet-500' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.roll_number ?? u.faculty_id ?? u.email}
                          {u.department && ` · ${u.department}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {u.role === 'student' && pct > 0 && (
                          <span className={cn('text-xs font-bold', attendanceColor(pct))}>{pct}%</span>
                        )}
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                          u.role === 'student' ? 'bg-primary/10 text-primary' :
                          u.role === 'faculty' ? 'bg-violet-500/10 text-violet-500' :
                          'bg-muted text-muted-foreground',
                        )}>
                          {u.role}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full md:w-80 flex-shrink-0 animate-slide-up">
            <UserDetailPanel user={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────────

function UserDetailPanel({ user: u, onClose }: { user: SearchResult; onClose: () => void }) {
  const pct = parseFloat(u.attendance_pct ?? '0');

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <p className="text-sm font-semibold text-foreground">Profile</p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold flex-shrink-0',
            u.role === 'student' ? 'bg-primary/10 text-primary' :
            u.role === 'faculty' ? 'bg-violet-500/10 text-violet-500' :
            'bg-muted text-muted-foreground',
          )}>
            {u.first_name[0]}{u.last_name[0]}
          </div>
          <div>
            <p className="font-semibold text-foreground">{u.first_name} {u.last_name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
            <span className={cn(
              'inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize',
              u.role === 'student' ? 'bg-primary/10 text-primary' :
              u.role === 'faculty' ? 'bg-violet-500/10 text-violet-500' :
              'bg-muted text-muted-foreground',
            )}>
              {u.role}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          {[
            { label: 'ID',         value: u.roll_number ?? u.faculty_id ?? '—' },
            { label: 'Department', value: u.department ?? '—' },
            { label: 'Status',     value: u.status },
            { label: 'Joined',     value: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—' },
            { label: 'Last Login', value: u.last_login_at ? formatDateTime(u.last_login_at) : 'Never' },
          ].map(row => (
            <div key={row.label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground text-right truncate max-w-[140px]">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Attendance summary (students only) */}
        {u.role === 'student' && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Attendance Summary
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className={cn('text-2xl font-bold', attendanceColor(pct))}>
                  {pct > 0 ? `${pct}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">{u.attended}/{u.total_classes} classes</p>
              </div>
              <div className="w-16 h-16 relative flex-shrink-0">
                <svg viewBox="0 0 36 36" className="-rotate-90 w-full h-full">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none"
                    stroke={pct >= 75 ? 'hsl(var(--success))' : pct >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                    strokeWidth="3"
                    strokeDasharray={`${(pct / 100) * 87.96} 87.96`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            {pct > 0 && pct < 75 && (
              <p className="text-xs text-destructive font-medium">⚠ Below 75% threshold</p>
            )}
          </div>
        )}

        {/* Faculty summary */}
        {u.role === 'faculty' && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-violet-500" />
              Teaching Summary
            </p>
            <p className="text-xs text-muted-foreground">
              {u.total_classes} sessions conducted
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
