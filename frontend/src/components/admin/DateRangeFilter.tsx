import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  label?: string;
}

export function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange, label }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="date"
          value={startDate}
          onChange={e => onStartChange(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={endDate}
          onChange={e => onEndChange(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
