/**
 * AttendanceTrendChart — line chart for daily/weekly attendance %.
 * Uses recharts (already installed).
 */
import {
  ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Area, AreaChart,
} from 'recharts';
import type { TrendPoint } from '../../hooks/useAdminDashboard';

interface Props {
  data: TrendPoint[];
  height?: number;
  showGrid?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as TrendPoint;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{formatDate(label)}</p>
      <p className="text-success">Attendance: <strong>{d.pct ?? 0}%</strong></p>
      <p className="text-muted-foreground">Present: {d.attended} / {d.expected}</p>
      <p className="text-muted-foreground">Sessions: {d.sessions}</p>
    </div>
  );
};

export function AttendanceTrendChart({ data, height = 220, showGrid = true }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No data available
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    pct: parseFloat(d.pct ?? '0'),
    date: d.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={75} stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area
          type="monotone"
          dataKey="pct"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#attendanceGrad)"
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
