import { cn } from '../../lib/utils';

interface FiltersPanelProps {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function FiltersPanel({ children, className, actions }: FiltersPanelProps) {
  return (
    <div className={cn('filters-panel', className)}>
      <div className="filters-row">
        {children}
        {actions && <div className="ml-auto flex items-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterGroup({ label, children, className }: FilterGroupProps) {
  return (
    <div className={cn('filter-group', className)}>
      <label className="filter-label">{label}</label>
      {children}
    </div>
  );
}

interface FilterInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function FilterInput({ className, ...props }: FilterInputProps) {
  return <input className={cn('filter-input', className)} {...props} />;
}

interface FilterSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export function FilterSelect({ className, children, ...props }: FilterSelectProps) {
  return (
    <select className={cn('filter-select', className)} {...props}>
      {children}
    </select>
  );
}
