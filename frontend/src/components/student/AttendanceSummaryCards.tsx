/**
 * AttendanceSummaryCards
 * Three stat cards: Total Classes / Attended / Overall %.
 * Used on both Home and My Attendance pages.
 */
import { BookOpen, CheckCircle2, TrendingUp } from 'lucide-react';
import { cn, attendanceColor } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

interface Props {
  total: number;
  attended: number;
  pct: number;
  loading?: boolean;
}

export function AttendanceSummaryCards({ total, attended, pct, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
    );
  }

  const absent = Math.max(0, total - attended);
  void absent; // available for future use

  const cards = [
    {
      label: 'Total Classes',
      value: total,
      icon: BookOpen,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      valueColor: 'text-foreground',
    },
    {
      label: 'Attended',
      value: attended,
      icon: CheckCircle2,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      valueColor: 'text-success',
    },
    {
      label: 'Attendance %',
      value: pct > 0 ? `${pct}%` : '—',
      icon: TrendingUp,
      iconBg: pct >= 75 ? 'bg-success/10' : pct >= 60 ? 'bg-warning/10' : 'bg-destructive/10',
      iconColor: pct >= 75 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive',
      valueColor: attendanceColor(pct),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(card => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', card.iconBg)}>
            <card.icon className={cn('h-4 w-4', card.iconColor)} />
          </div>
          <p className={cn('text-xl font-bold leading-none', card.valueColor)}>{card.value}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
