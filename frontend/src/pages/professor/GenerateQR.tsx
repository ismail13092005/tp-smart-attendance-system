/**
 * Generate QR — create session + live QR display with auto-refresh countdown
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, RefreshCw, Clock, CheckCircle2, Play, Square, Loader2 } from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { cn } from '../../lib/utils';

type Step = 'form' | 'active';

const SESSION_TYPES = ['lecture', 'lab', 'tutorial', 'seminar', 'workshop', 'exam'] as const;

export default function GenerateQR() {
  const navigate = useNavigate();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');

  // Default: start = now rounded to next 5 min (local time), end = start + 1 hour
  const defaultStart = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
    // Format as local datetime-local value
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const defaultEnd = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
    d.setHours(d.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [formData, setFormData] = useState({
    courseCode: '', courseName: '', sessionType: 'lecture' as typeof SESSION_TYPES[number],
    scheduledStartTime: defaultStart(),
    scheduledEndTime: defaultEnd(),
    location: '', geofenceRadius: 100, expectedStudents: 0,
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'ok' | 'error'>('idle');
  const [liveCoords, setLiveCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ── Active session state ────────────────────────────────────────────────────
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [ending, setEnding] = useState(false);
  const refreshingRef = useRef(false);

  // ── Countdown timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!qrExpiresAt) return;
    let autoRefreshFired = false;
    const tick = () => {
      const left = Math.max(0, Math.floor((qrExpiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoRefreshFired) {
        autoRefreshFired = true;
        handleRefreshQR();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qrExpiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create session + start ──────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError('');
    setLocationStatus('fetching');

    // Capture faculty live GPS
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true }),
      );
      coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLiveCoords(coords);
      setLocationStatus('ok');
    } catch {
      setLocationStatus('error');
      setFormError('Could not get your location. Please allow location access and try again.');
      setCreating(false);
      return;
    }

    try {
      const created = await api.createSession({ ...formData, latitude: coords.latitude, longitude: coords.longitude });
      const sessionId = created.data.session.id;
      const started = await api.startSession(sessionId, coords);
      setSession(started.data.session);
      setQrDataUrl(started.data.qrCode?.qrCodeDataURL ?? null);
      setQrToken(started.data.qrCode?.token ?? null);
      setQrExpiresAt(new Date(started.data.qrCode?.expiresAt ?? Date.now() + 180_000));
      setStep('active');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // ── Refresh QR ──────────────────────────────────────────────────────────────
  const handleRefreshQR = useCallback(async () => {
    if (!session?.id || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const r = await api.refreshQR(session.id as string);
      setQrDataUrl(r.data.qrCode?.qrCodeDataURL ?? null);
      setQrToken(r.data.qrCode?.token ?? null);
      setQrExpiresAt(new Date(r.data.qrCode?.expiresAt ?? Date.now() + 180_000));
    } catch { /* silent */ }
    finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [session?.id]);

  // ── End session ─────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!session?.id) return;
    setEnding(true);
    try {
      await api.endSession(session.id as string);
      navigate(`/professor/attendance-sheet?session=${session.id}`);
    } catch { setEnding(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(f => ({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  const pct = secondsLeft > 0 ? (secondsLeft / 180) * 100 : 0;
  const isUrgent = secondsLeft <= 30 && secondsLeft > 0;

  // ── Active QR display ───────────────────────────────────────────────────────
  if (step === 'active') {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        <PageHeader
          title="Session Active"
          subtitle={`${session?.course_code as string} — ${session?.course_name as string}`}
          action={
            <button
              onClick={handleEnd}
              disabled={ending}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              End Session
            </button>
          }
        />

        {/* QR card */}
        <div className="rounded-xl border border-success/30 bg-card overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-success/5 border-b border-success/20">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-semibold text-success">QR Code Active</span>
            </div>
            <button
              onClick={handleRefreshQR}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* QR image */}
          <div className="flex flex-col items-center p-6 gap-4">
            {qrDataUrl ? (
              <div className="relative">
                <img
                  src={qrDataUrl}
                  alt="Session QR Code"
                  className={cn('w-64 h-64 rounded-xl', refreshing && 'opacity-50')}
                />
                {refreshing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-64 h-64 rounded-xl bg-muted flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Countdown */}
            <div className="w-full max-w-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Expires in
                </span>
                <span className={cn('font-mono font-bold', isUrgent ? 'text-destructive' : 'text-foreground')}>
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-1000', isUrgent ? 'bg-destructive' : 'bg-success')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isUrgent && (
                <p className="text-xs text-destructive text-center animate-pulse">
                  QR expiring soon — will auto-refresh
                </p>
              )}
            </div>

            {/* Token display */}
            {qrToken && (
              <div className="w-full max-w-xs space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground text-center">Token Code</p>
                <div className="rounded-lg bg-muted/50 border border-border p-2">
                  <p className="text-xs font-mono text-foreground break-all text-center select-all">
                    {qrToken}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Students can enter this code manually if scanning fails
                </p>
              </div>
            )}
          </div>

          {/* Session info */}
          <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-center">
            <div className="py-3">
              <p className="text-lg font-bold text-foreground">{(session?.present_count as number) ?? 0}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div className="py-3">
              <p className="text-lg font-bold text-foreground">{(session?.expected_count as number) ?? 0}</p>
              <p className="text-xs text-muted-foreground">Expected</p>
            </div>
          </div>
        </div>

        {/* Session details */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
          {[
            ['Course', `${session?.course_code as string} — ${session?.course_name as string}`],
            ['Type', String(session?.session_type ?? '').toUpperCase()],
            ['Time', session?.scheduled_start ? `${new Date(session.scheduled_start as string).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ${new Date(session.scheduled_end as string).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : '—'],
            ['Location', String(session?.location ?? '')],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium text-foreground capitalize">{v as string}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate(`/professor/attendance-sheet?session=${session?.id}`)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4 text-success" />
          View Live Attendance Sheet
        </button>
      </div>
    );
  }

  // ── Session creation form ───────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader title="Generate QR Code" subtitle="Create a session and generate a live QR code for attendance" />

      {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}

      <div className="rounded-xl border border-border bg-card p-5">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Course info */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Course Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field id="courseCode" label="Course Code" value={formData.courseCode} onChange={set('courseCode')} required placeholder="CS101" />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Session Type</label>
                <select value={formData.sessionType} onChange={set('sessionType')}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {SESSION_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <Field id="courseName" label="Course Name" value={formData.courseName} onChange={set('courseName')} required placeholder="Introduction to Programming" />
          </div>

          {/* Schedule */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Start Time</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledStartTime}
                  onChange={e => setFormData(f => ({ ...f, scheduledStartTime: e.target.value }))}
                  required
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {formData.scheduledStartTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(formData.scheduledStartTime).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">End Time</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledEndTime}
                  min={formData.scheduledStartTime}
                  onChange={e => setFormData(f => ({ ...f, scheduledEndTime: e.target.value }))}
                  required
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {formData.scheduledEndTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(formData.scheduledEndTime).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location & Geofence</p>
            <Field id="location" label="Room / Location" value={formData.location} onChange={set('location')} required placeholder="Room 101, CS Block" />
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm flex items-center gap-2">
              {locationStatus === 'ok' && liveCoords ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-success shrink-0" />
                  <span className="text-success font-medium">Live GPS captured</span>
                  <span className="text-muted-foreground ml-auto font-mono text-xs">
                    {liveCoords.latitude.toFixed(5)}, {liveCoords.longitude.toFixed(5)}
                  </span>
                </>
              ) : locationStatus === 'fetching' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Capturing your location…</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Your live GPS will be captured on submit</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Students must be within <strong>10 meters</strong> of your location to mark attendance.</p>
          </div>

          {/* Students */}
          <Field id="expectedStudents" label="Expected Students" type="number" value={formData.expectedStudents} onChange={set('expectedStudents')} />

          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {creating ? 'Starting Session…' : 'Start Session & Generate QR'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ id, label, type = 'text', value, onChange, required, placeholder }: {
  id: string; label: string; type?: string;
  value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <input
        id={id} type={type} value={value as string} onChange={onChange} required={required} placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
