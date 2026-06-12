/**
 * MonthlyBarChart — recharts bar chart for monthly attendance trend.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import type { MonthlyPoint } from '../../hooks/useParentDashboard';

interface Props {
  data: MonthlyPoint[];
  height?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MonthlyPoint;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.month}</p>
      <p className="text-muted-foreground">Attended: {d.attended}/{d.total}</p>
      <p className="font-medium" style={{ color: getColor(parseFloat(d.pct ?? '0')) }}>
        {parseFloat(d.pct ?? '0') > 0 ? `${d.pct}%` : 'No data'}
      </p>
    </div>
  );
};

function getColor(pct: number) {
  if (pct >= 75) return 'hsl(var(--success))';
  if (pct >= 60) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function MonthlyBarChart({ data, height = 180 }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No monthly data available
      </div>
    );
  }

  const chartData = data.map(d => ({ ...d, pct: parseFloat(d.pct ?? '0') }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
        <ReferenceLine y={75} stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeWidth={1.5} />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
