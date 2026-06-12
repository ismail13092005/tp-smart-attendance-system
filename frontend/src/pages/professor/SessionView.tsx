/**
 * SessionView — QR display + live attendance monitor for an active session.
 * Route: /professor/session/:id
 * Uses /dashboard/faculty/:id/session/:id/live (polls every 15s when active).
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { RefreshCw, Users, Clock, QrCode, Square, Loader2, ArrowLeft, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useFacultySessionLive } from '../../hooks/useAdminDashboard';
import { api, getErrorMessage } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';

export default function SessionView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [session, setSession]       = useState<Record<string, unknown> | null>(null);
  const [qrCode, setQrCode]         = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ending, setEnding]         = useState(false);
  const [error, setError]           = useState('');

  const isActive = session?.status === 'active';

  // Live attendance — polls every 15s when session is active
  const { data: liveData } = useFacultySessionLive(user?.id, id, isActive);

  useEffect(() => {
    if (!id) return;
    api.getSession(id)
      .then(r => setSession(r.data.session))
      .catch(() => setError('Session not found'))
      .finally(() => setLoading(false));
  }, [id]);

  // QR countdown
  useEffect(() => {
    if (!qrExpiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((qrExpiresAt.getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qrExpiresAt]);

  const handleStart = async () => {
    try {
      const res = await api.startSession(id!);
      setSession(res.data.session);
      setQrCode(res.data.qrCode?.qrCodeDataURL ?? null);
      setQrExpiresAt(res.data.qrCode?.expiresAt ? new Date(res.data.qrCode.expiresAt) : null);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const handleRefreshQR = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await api.refreshQR(id!);
      setQrCode(res.data.qrCode?.qrCodeDataURL ?? null);
      setQrExpiresAt(res.data.qrCode?.expiresAt ? new Date(res.data.qrCode.expiresAt) : null);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setRefreshing(false); }
  }, [id, refreshing]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await api.endSession(id!);
      navigate(`/professor/attendance-sheet?session=${id}`);
    } catch (err) { setError(getErrorMessage(err)); setEnding(false); }
  };

  if (loading) return (
    <div className="page-container flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!session) return (
    <div className="page-container">
      <Alert variant="destructive">Session not found.</Alert>
      <Link to="/professor/home" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
    </div>
  );

  const pct       = secondsLeft > 0 ? (secondsLeft / 300) * 100 : 0;
  const isUrgent  = secondsLeft > 0 && secondsLeft <= 30;
  const presentCount = liveData?.session?.present_count ?? (session.present_count as number) ?? 0;
  const lateCount    = liveData?.session?.late_count    ?? (session.late_count    as number) ?? 0;
  const absentCount  = liveData?.session?.absent_count  ?? (session.absent_count  as number) ?? 0;
  const expected     = liveData?.session?.expected_count ?? (session.expected_count as number) ?? 0;
  const liveRecords  = liveData?.records ?? [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link to="/professor/home"
            className="mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
            aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {session.course_code as string} — {session.course_name as string}
            </h1>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">
              {session.session_type as string} · {session.location as string}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`/professor/attendance-sheet?session=${id}`}
            className="flex items-center gap-2 border border-border bg-card px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <ClipboardList className="h-4 w-4" /> Sheet
          </Link>
          {isActive && (
            <button onClick={handleEnd} disabled={ending}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              End Session
            </button>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive" onDismiss={() => setError('')}>{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: session info + QR */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Session Info</h2>
              <Badge variant={
                session.status === 'active' ? 'success' :
                session.status === 'completed' ? 'secondary' : 'info'
              } dot>{session.status as string}</Badge>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['Course',   `${session.course_code as string} — ${session.course_name as string}`],
                ['Type',     String(session.session_type ?? '').toUpperCase()],
                ['Location', String(session.location ?? '')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium capitalize text-right truncate max-w-[200px]">{v}</dd>
                </div>
              ))}
            </dl>
            {session.status === 'scheduled' && (
              <button onClick={handleStart}
                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Start Session & Generate QR
              </button>
            )}
          </div>

          {/* QR code */}
          {qrCode && (
            <div className="rounded-xl border border-success/30 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-success" />
                  <h2 className="font-semibold text-foreground">QR Code</h2>
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                </div>
                <button onClick={handleRefreshQR} disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                  Refresh
                </button>
              </div>
              <div className={cn('relative', refreshing && 'opacity-50')}>
                <img src={qrCode} alt="Session QR Code" className="w-full rounded-lg" />
              </div>
              {secondsLeft > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Expires in
                    </span>
                    <span className={cn('font-mono font-bold', isUrgent ? 'text-destructive' : 'text-foreground')}>
                      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-1000', isUrgent ? 'bg-destructive' : 'bg-success')}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {isUrgent && <p className="text-xs text-destructive text-center animate-pulse">Expiring soon — will auto-refresh</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: live attendance */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', value: presentCount, color: 'text-success',     bg: 'bg-success/10' },
              { label: 'Late',    value: lateCount,    color: 'text-warning',     bg: 'bg-warning/10' },
              { label: 'Absent',  value: absentCount,  color: 'text-destructive', bg: 'bg-destructive/10' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-xl border border-border p-3 text-center', s.bg)}>
                <p className={cn('text-2xl font-bold tabular', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Live Attendance
                {isActive && <span className="h-2 w-2 rounded-full bg-success animate-pulse" />}
              </h2>
              <span className="text-xs text-muted-foreground tabular">{liveRecords.length}/{expected}</span>
            </div>
            {liveRecords.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {isActive ? 'Waiting for students to mark attendance…' : 'No attendance records yet'}
              </div>
            ) : (
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {liveRecords.map(r => (
                  <div key={r.student_id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                      {r.first_name[0]}{r.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-muted-foreground">{r.roll_number ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="hidden sm:flex items-center gap-1">
                        {[
                          { ok: r.qr_verified,   label: 'QR' },
                          { ok: r.face_verified, label: 'Face' },
                          { ok: r.geo_verified,  label: 'Geo' },
                        ].map(v => (
                          <span key={v.label} className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            v.ok ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                          )}>{v.label}</span>
                        ))}
                      </div>
                      <Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : 'destructive'} dot>
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
