/**
 * ChildSelector — tab/pill selector when parent has multiple linked children.
 * Shows initials avatar + name. Hidden when only one child.
 */
import { cn, attendanceColor } from '../../lib/utils';
import type { LinkedChild } from '../../hooks/useParentDashboard';

interface ChildSelectorProps {
  children: LinkedChild[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function ChildSelector({ children, selectedId, onChange }: ChildSelectorProps) {
  if (children.length <= 1) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {children.map(child => {
        const pct = parseFloat(child.overall_pct ?? '0');
        const isSelected = child.id === selectedId;
        return (
          <button
            key={child.id}
            onClick={() => onChange(child.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
              isSelected
                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
            )}
          >
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold flex-shrink-0',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {child.first_name[0]}{child.last_name[0]}
            </div>
            <div className="text-left">
              <p className="leading-none">{child.first_name} {child.last_name}</p>
              {pct > 0 && (
                <p className={cn('text-xs mt-0.5', attendanceColor(pct))}>{pct}%</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
