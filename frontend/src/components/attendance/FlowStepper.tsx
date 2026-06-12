import { cn } from '../../lib/utils';
import { Check, QrCode, Camera, MapPin, Loader2 } from 'lucide-react';
import type { FlowStep } from './AttendanceFlowTypes';

const STEPS: { id: FlowStep; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'qr',       label: 'Scan QR Code',    shortLabel: 'QR',    icon: QrCode  },
  { id: 'face',     label: 'Face Verify',      shortLabel: 'Face',  icon: Camera  },
  { id: 'location', label: 'Location Check',   shortLabel: 'Location', icon: MapPin },
];

const STEP_INDEX: Record<string, number> = { qr: 0, face: 1, location: 2, submitting: 2, success: 3, duplicate: 3, failed: 3 };

interface FlowStepperProps {
  currentStep: FlowStep;
}

export function FlowStepper({ currentStep }: FlowStepperProps) {
  const currentIdx = STEP_INDEX[currentStep] ?? 0;
  const isSubmitting = currentStep === 'submitting';

  return (
    <nav aria-label="Attendance verification steps" className="w-full">
      <ol className="flex items-center w-full">
        {STEPS.map((step, idx) => {
          const done   = idx < currentIdx;
          const active = idx === currentIdx && !isSubmitting;
          const busy   = idx === currentIdx && isSubmitting;

          return (
            <li key={step.id} className={cn('flex items-center', idx < STEPS.length - 1 && 'flex-1')}>
              {/* Circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                    done  && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-primary bg-background text-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]',
                    busy  && 'border-primary bg-primary text-primary-foreground',
                    !done && !active && !busy && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {done  && <Check className="h-5 w-5" aria-hidden />}
                  {busy  && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                  {!done && !busy && <step.icon className="h-4 w-4" aria-hidden />}
                </div>
                {/* Label */}
                <span className={cn(
                  'text-xs font-medium whitespace-nowrap hidden sm:block',
                  active || busy ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {step.label}
                </span>
                <span className={cn(
                  'text-xs font-medium sm:hidden',
                  active || busy ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {step.shortLabel}
                </span>
              </div>

              {/* Connector */}
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-2 mb-5 transition-colors duration-500',
                  idx < currentIdx ? 'bg-primary' : 'bg-border',
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
