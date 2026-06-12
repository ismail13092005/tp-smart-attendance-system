import { useEffect, useState } from 'react';
import { QrCode, Camera, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SubmittingStepProps {
  /** Called once all animation phases complete */
  onAnimationDone?: () => void;
}

const PHASES = [
  { icon: QrCode,       label: 'Validating QR token',        duration: 900  },
  { icon: Camera,       label: 'Verifying face identity',     duration: 1400 },
  { icon: MapPin,       label: 'Checking geofence boundary',  duration: 900  },
  { icon: CheckCircle2, label: 'Recording attendance',        duration: 600  },
];

export function SubmittingStep({ onAnimationDone }: SubmittingStepProps) {
  const [phase, setPhase] = useState(0);
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    let idx = 0;
    const advance = () => {
      if (idx >= PHASES.length) {
        onAnimationDone?.();
        return;
      }
      setPhase(idx);
      const t = setTimeout(() => {
        setDone((d) => [...d, idx]);
        idx++;
        advance();
      }, PHASES[idx].duration);
      return t;
    };
    const t = advance();
    return () => { if (t) clearTimeout(t); };
  }, []);

  return (
    <div className="space-y-8 animate-fade-in py-4">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Verifying Attendance</h2>
        <p className="text-sm text-muted-foreground">Please wait while we process your verification</p>
      </div>

      <div className="space-y-3">
        {PHASES.map((p, idx) => {
          const isDone    = done.includes(idx);
          const isActive  = phase === idx && !isDone;
          const isPending = idx > phase;

          return (
            <div
              key={idx}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-all duration-300',
                isDone   && 'border-success/30 bg-success/5',
                isActive && 'border-primary/30 bg-primary/5',
                isPending && 'border-border bg-muted/20 opacity-40',
              )}
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 transition-colors',
                isDone   && 'bg-success/20',
                isActive && 'bg-primary/10',
                isPending && 'bg-muted',
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <p.icon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className={cn(
                'text-sm font-medium transition-colors',
                isDone   && 'text-success',
                isActive && 'text-primary',
                isPending && 'text-muted-foreground',
              )}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Do not close this page or navigate away
      </p>
    </div>
  );
}
