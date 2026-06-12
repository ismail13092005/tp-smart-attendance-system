import { Link, useLocation } from 'react-router-dom';
import { Menu, Bell, ChevronRight, Sun, Moon, Monitor } from 'lucide-react';
import { useState } from 'react';
import { NAV_CONFIG } from '../../config/navigation';
import { useThemeStore } from '../../stores/authStore';
import type { User } from '../../stores/authStore';
import { cn } from '../../lib/utils';

interface TopbarProps {
  user: User;
  onMenuClick: () => void;
  unreadCount?: number;
}

function useBreadcrumbs(user: User) {
  const location = useLocation();
  const config = NAV_CONFIG[user.role];
  if (!config) return [];

  const segments: { label: string; path: string }[] = [];
  const match = config.items.find(item =>
    item.end
      ? location.pathname === item.path
      : location.pathname.startsWith(item.path),
  );

  if (match) {
    segments.push({ label: config.portalLabel, path: config.rootPath });
    if (location.pathname !== config.rootPath) {
      segments.push({ label: match.label, path: match.path });
    }
  }
  return segments;
}

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);

  const options = [
    { value: 'light' as const, icon: Sun,     label: 'Light' },
    { value: 'dark'  as const, icon: Moon,    label: 'Dark' },
    { value: 'system'as const, icon: Monitor, label: 'System' },
  ];

  const current = options.find(o => o.value === theme) ?? options[2];
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Toggle theme"
        title="Toggle theme"
      >
        <Icon className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-1 z-20 w-32 rounded-lg border border-border bg-popover shadow-elevated py-1 animate-slide-up">
            {options.map(({ value, icon: OptionIcon, label }) => (
              <button
                key={value}
                onClick={() => { setTheme(value); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  theme === value
                    ? 'text-primary font-medium bg-primary/5'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <OptionIcon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ user, onMenuClick, unreadCount = 0 }: TopbarProps) {
  const breadcrumbs = useBreadcrumbs(user);
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo — mobile only */}
        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            SA
          </div>
          <span className="text-sm font-bold text-foreground">SmartAttend</span>
        </div>

        {/* Breadcrumbs — desktop */}
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1 text-sm min-w-0">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden />}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-foreground truncate" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ThemeToggle />

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
          )}
        </button>

        {/* Avatar — desktop */}
        <div className="hidden md:flex items-center gap-2 ml-1 pl-2 border-l border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold ring-2 ring-primary/20">
            {initials}
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-foreground leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{user.role}</p>
          </div>
        </div>

        {/* Avatar — mobile only */}
        <div className="md:hidden flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold ring-2 ring-primary/20">
          {initials}
        </div>
      </div>
    </header>
  );
}
