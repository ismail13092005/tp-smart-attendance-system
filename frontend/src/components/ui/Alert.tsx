import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type AlertVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const config: Record<AlertVariant, { icon: React.ElementType; classes: string }> = {
  default:     { icon: Info,          classes: 'bg-muted border-border text-foreground' },
  success:     { icon: CheckCircle2,  classes: 'bg-success/10 border-success/30 text-success' },
  warning:     { icon: AlertTriangle, classes: 'bg-warning/10 border-warning/30 text-warning' },
  destructive: { icon: AlertCircle,   classes: 'bg-destructive/10 border-destructive/30 text-destructive' },
  info:        { icon: Info,          classes: 'bg-info/10 border-info/30 text-info' },
};

export function Alert({ variant = 'default', title, children, className, onDismiss }: AlertProps) {
  const { icon: Icon, classes } = config[variant];
  return (
    <div role="alert" className={cn('relative flex gap-3 rounded-lg border p-4', classes, className)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium text-sm mb-1">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
