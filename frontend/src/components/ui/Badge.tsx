import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline' | 'secondary';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default:     'bg-primary/10 text-primary border-primary/20',
  success:     'bg-success/10 text-success border-success/20',
  warning:     'bg-warning/10 text-warning border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  info:        'bg-info/10 text-info border-info/20',
  outline:     'bg-transparent border-border text-foreground',
  secondary:   'bg-secondary text-secondary-foreground border-transparent',
};

const dotColors: Record<BadgeVariant, string> = {
  default:     'bg-primary',
  success:     'bg-success',
  warning:     'bg-warning',
  destructive: 'bg-destructive',
  info:        'bg-info',
  outline:     'bg-foreground',
  secondary:   'bg-secondary-foreground',
};

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      variants[variant],
      className,
    )}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

/** Map attendance status to badge variant */
export function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    present: 'success',
    late:    'warning',
    absent:  'destructive',
    excused: 'info',
  };
  return <Badge variant={map[status] ?? 'secondary'} dot>{status}</Badge>;
}

/** Map session status to badge variant */
export function SessionBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:    'success',
    scheduled: 'info',
    completed: 'secondary',
    cancelled: 'destructive',
  };
  return <Badge variant={map[status] ?? 'secondary'} dot>{status}</Badge>;
}
