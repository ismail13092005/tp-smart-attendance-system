import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

interface Tab {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ tabs, value, onChange, children, className }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange} className={className}>
      <RadixTabs.List className="flex border-b border-border gap-1 mb-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg',
              'text-muted-foreground hover:text-foreground transition-colors',
              'border-b-2 border-transparent -mb-px',
              'data-[state=active]:text-primary data-[state=active]:border-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {tab.badge}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabsContent = RadixTabs.Content;
