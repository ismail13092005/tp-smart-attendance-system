/**
 * Professor Home
 * - Today's teaching schedule
 * - Quick stats (sessions, students, avg attendance)
 * - Generate QR button
 * - Active session summary
 */
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, Calendar, Users, TrendingUp, Clock, ChevronRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFacultyDashboard } from '../../hooks/useProfessorDashboard';
import { SessionCard } from '../../components/professor/SessionCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn } from '../../lib/utils';

export default function ProfessorHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data, isLoading, error } = useFacultyDashboard(user?.id);

  const activeSessions  = data?.todaySessions?.filter(s => s.status === 'active') ?? [];
  const todaySessions   = data?.todaySessions ?? [];
  const recentSessions  = data?.recentSessions ?? [];
  const defaulterCount  = data?.defaulters?.length ?? 0;

  // Quick stats from recent sessions
  const totalStudents = recentSessions.reduce((s, r) => s + r.expected_count, 0);
  const totalPresent  = recentSessions.reduce((s, r) => s + r.present_count, 0);
  const avgPct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Good {getGreeting()}, Prof. {user?.lastName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          to="/professor/generate-qr"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm flex-shrink-0"
        >
          <QrCode className="h-4 w-4" />
          Generate QR
        </Link>
      </div>

      {error && <Alert variant="destructive">Failed to load dashboard data.</Alert>}

      {/* Quick stats */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-7 w-12" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Calendar} label="Sessions (30d)" value={recentSessions.length} iconBg="bg-primary/10" iconColor="text-primary" />
          <StatCard icon={Users}    label="Total Students" value={totalStudents}          iconBg="bg-success/10"  iconColor="text-success" />
          <StatCard
            icon={TrendingUp}
            label="Avg Attendance"
            value={avgPct > 0 ? `${avgPct}%` : '—'}
            iconBg={avgPct >= 75 ? 'bg-success/10' : avgPct >= 60 ? 'bg-warning/10' : 'bg-destructive/10'}
            iconColor={avgPct >= 75 ? 'text-success' : avgPct >= 60 ? 'text-warning' : 'text-destructive'}
          />
        </div>
      )}

      {/* Active sessions — highlighted */}
      {activeSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live Sessions ({activeSessions.length})
          </h2>
          <div className="space-y-3">
            {activeSessions.map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        </section>
      )}

      {/* Today's schedule */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Today's Schedule
          </h2>
          <Link to="/professor/generate-qr" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>)}</div>
        ) : todaySessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No sessions today</p>
            <Link to="/professor/generate-qr" className="text-xs text-primary hover:underline mt-1 inline-block">
              Schedule one →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySessions.map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </section>

      {/* Recent sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Recent Sessions</h2>
          <Link to="/professor/attendance-sheet" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>)}
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">No sessions in the last 30 days</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Present</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentSessions.slice(0, 8).map(s => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/professor/session/${s.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{s.course_code}</p>
                      <p className="text-xs text-muted-foreground">{s.course_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {new Date(s.scheduled_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="font-medium">{s.present_count}</span>
                      <span className="text-muted-foreground">/{s.expected_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                        s.status === 'active' ? 'bg-success/10 text-success' :
                        s.status === 'completed' ? 'bg-muted text-muted-foreground' :
                        'bg-info/10 text-info',
                      )}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Defaulter alert */}
      {defaulterCount > 0 && (
        <Link to="/professor/defaulters"
          className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/5 p-4 hover:bg-warning/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/15">
              <Users className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warning">{defaulterCount} Defaulter{defaulterCount !== 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">Students below 75% attendance</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-warning" />
        </Link>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: React.ElementType; label: string; value: string | number; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
