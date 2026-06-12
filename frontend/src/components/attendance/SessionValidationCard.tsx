import { CheckCircle2, BookOpen, MapPin, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { QRValidationResult } from './AttendanceFlowTypes';

interface SessionValidationCardProps {
  validation: QRValidationResult;
  className?: string;
}

export function SessionValidationCard({ validation, className }: SessionValidationCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-success/30 bg-success/5 p-4 space-y-3 animate-slide-up',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20">
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-sm font-semibold text-success">QR Code Verified</p>
          <p className="text-xs text-muted-foreground">Session found and active</p>
        </div>
      </div>

      {/* Session details */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Detail icon={BookOpen} label="Course" value={validation.courseName ?? '—'} />
        <Detail icon={BookOpen} label="Code" value={validation.courseCode ?? '—'} />
        <Detail icon={User} label="Faculty" value={validation.facultyName ?? '—'} />
        <Detail icon={MapPin} label="Room" value={validation.location ?? '—'} />
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
