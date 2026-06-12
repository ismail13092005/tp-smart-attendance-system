import { cn } from '../../lib/utils';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn('flex items-center', className)}>
      {steps.map((step, idx) => {
        const done    = idx < currentStep;
        const active  = idx === currentStep;
        const pending = idx > currentStep;

        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  done    && 'border-primary bg-primary text-primary-foreground',
                  active  && 'border-primary bg-background text-primary',
                  pending && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : step.icon ?? <span>{idx + 1}</span>}
              </div>
              <div className="mt-2 text-center">
                <p className={cn('text-xs font-medium', active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-3 mb-6 transition-colors', idx < currentStep ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
