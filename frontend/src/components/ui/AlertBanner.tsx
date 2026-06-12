import { cn } from '../../lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type AlertBannerVariant = 'warning' | 'destructive' | 'success' | 'info';

interface AlertBannerProps {
  variant?: AlertBannerVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const icons: Record<AlertBannerVariant, React.ElementType> = {
  warning:     AlertTriangle,
  destructive: AlertCircle,
  success:     CheckCircle2,
  info:        Info,
};

const variantClass: Record<AlertBannerVariant, string> = {
  warning:     'alert-banner-warning',
  destructive: 'alert-banner-destructive',
  success:     'alert-banner-success',
  info:        'alert-banner-info',
};

export function AlertBanner({
  variant = 'warning', title, description, action, onDismiss, className,
}: AlertBannerProps) {
  const Icon = icons[variant];
  return (
    <div className={cn('alert-banner', variantClass[variant], className)} role="alert">
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-none">{title}</p>
        {description && <p className="text-sm opacity-85 mt-1">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
