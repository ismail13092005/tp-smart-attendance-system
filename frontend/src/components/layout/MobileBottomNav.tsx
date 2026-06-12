import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { NAV_CONFIG } from '../../config/navigation';
import type { User } from '../../stores/authStore';

interface MobileBottomNavProps {
  user: User;
}

export function MobileBottomNav({ user }: MobileBottomNavProps) {
  const location = useLocation();
  const config = NAV_CONFIG[user.role];
  if (!config) return null;

  // Show max 5 items in bottom nav
  const items = config.items.slice(0, 5);

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <nav
      className="md:hidden flex border-t border-border bg-card flex-shrink-0 safe-area-pb"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const active = isActive(item.path, item.end);
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 min-w-0 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden />
            <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">
              {item.label.split(' ')[0]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
