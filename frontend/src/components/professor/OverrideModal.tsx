/**
 * OverrideModal — audited manual attendance edit.
 * Requires a mandatory reason. Calls /attendance/manual-override.
 */
import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useManualOverride } from '../../hooks/useProfessorDashboard';
import { cn } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  student: { id: string; name: string; currentStatus: string | null };
}

const STATUSES = [
  { value: 'present', label: 'Present', color: 'text-success' },
  { value: 'late',    label: 'Late',    color: 'text-warning' },
  { value: 'absent',  label: 'Absent',  color: 'text-destructive' },
  { value: 'excused', label: 'Excused', color: 'text-info' },
];

export function OverrideModal({ open, onClose, sessionId, student }: Props) {
  const [status, setStatus] = useState(student.currentStatus ?? 'present');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const override = useManualOverride();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required for audit trail'); return; }
    setError('');
    try {
      await override.mutateAsync({ sessionId, studentId: student.id, status, reason });
      onClose();
      setReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Override failed');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manual Attendance Override" size="sm">
      <div className="space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">This action is audited</p>
            <p className="text-xs mt-0.5 opacity-80">
              All manual overrides are logged with your name, timestamp, and reason.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Student</p>
          <p className="font-semibold text-foreground">{student.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">New Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all',
                    status === s.value
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', {
                    'bg-success': s.value === 'present',
                    'bg-warning': s.value === 'late',
                    'bg-destructive': s.value === 'absent',
                    'bg-info': s.value === 'excused',
                  })} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Student was present but had technical issues with the app"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <p className="text-xs text-muted-foreground">This reason will be stored in the audit log.</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={override.isPending || !reason.trim()}
              className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {override.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Override
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
