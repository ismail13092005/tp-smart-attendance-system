/**
 * AttendanceDonut — SVG donut chart for overall attendance %.
 * No external dependency — pure SVG.
 */
import { cn } from '../../lib/utils';

interface AttendanceDonutProps {
  pct: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function AttendanceDonut({ pct, size = 120, strokeWidth = 10, label }: AttendanceDonutProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 75 ? 'hsl(var(--success))' : pct >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold', pct >= 75 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive')}
            style={{ fontSize: size * 0.18 }}>
            {pct > 0 ? `${pct}%` : '—'}
          </span>
        </div>
      </div>
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
