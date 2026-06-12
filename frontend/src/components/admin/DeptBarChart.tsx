/**
 * DeptBarChart — horizontal bar chart comparing department attendance %.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';
import type { DeptStat } from '../../hooks/useAdminDashboard';

interface Props {
  data: DeptStat[];
  height?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DeptStat;
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{d.department}</p>
      <p className="text-muted-foreground">Students: {d.students}</p>
      <p className="text-muted-foreground">Attended: {d.attended} / {d.total_records}</p>
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

export function DeptBarChart({ data, height = 200 }: Props) {
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
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="department"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
        <ReferenceLine x={75} stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeWidth={1.5} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
