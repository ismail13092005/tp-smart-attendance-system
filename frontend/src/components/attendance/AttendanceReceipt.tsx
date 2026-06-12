import { CheckCircle2, Clock, BookOpen, MapPin, Fingerprint, Home } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatDateTime } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { useNavigate } from 'react-router-dom';
import type { AttendanceReceipt as ReceiptData } from './AttendanceFlowTypes';

interface AttendanceReceiptProps {
  receipt: ReceiptData;
  onMarkAnother: () => void;
}

export function AttendanceReceipt({ receipt }: AttendanceReceiptProps) {
  const navigate = useNavigate();
  const isLate = receipt.status === 'late';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Success hero */}
      <div className="text-center space-y-3 py-2">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Attendance Marked!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isLate
              ? 'You have been marked as late for this session.'
              : 'You have been marked present for this session.'}
          </p>
        </div>
        <Badge variant={isLate ? 'warning' : 'success'} className="text-sm px-4 py-1">
          {isLate ? '⏰ Late' : '✓ Present'}
        </Badge>
      </div>

      {/* Receipt card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Receipt header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Attendance Receipt</p>
              <p className="text-sm font-mono text-foreground mt-0.5">#{receipt.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Recorded at</p>
              <p className="text-sm font-medium text-foreground">{formatDateTime(receipt.markedAt)}</p>
            </div>
          </div>
        </div>

        {/* Receipt body */}
        <div className="divide-y divide-border">
          <ReceiptRow icon={BookOpen} label="Course" value={`${receipt.courseCode} — ${receipt.courseName}`} />
          <ReceiptRow icon={MapPin}   label="Location" value={receipt.location} />
          <ReceiptRow icon={Clock}    label="Marked At" value={formatDateTime(receipt.markedAt)} />
          {receipt.faceConfidence !== undefined && (
            <ReceiptRow
              icon={Fingerprint}
              label="Verification"
              value={`Face matched (${Math.round(receipt.faceConfidence * 100)}% confidence)`}
            />
          )}
        </div>

        {/* Verification badges */}
        <div className="px-5 py-4 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Verification checks passed</p>
          <div className="flex flex-wrap gap-2">
            <VerificationBadge label="QR Code" />
            <VerificationBadge label="Face ID" />
            <VerificationBadge label="Geofence" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={() => navigate('/attendance-history')}
          leftIcon={<Clock className="h-4 w-4" />}
        >
          View Attendance History
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/')}
          leftIcon={<Home className="h-4 w-4" />}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}

function ReceiptRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function VerificationBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
      <CheckCircle2 className="h-3 w-3" />
      {label}
    </span>
  );
}
