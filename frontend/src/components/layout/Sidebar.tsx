import { Link, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NAV_CONFIG } from '../../config/navigation';
import type { User } from '../../stores/authStore';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ user, onLogout, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const config = NAV_CONFIG[user.role];
  if (!config) return null;

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="sidebar-logo-area flex h-14 items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold tracking-tight shadow-sm">
            SA
          </div>
          <div>
            <p className="text-sm font-bold sidebar-user-name leading-none">SmartAttend</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--sidebar-fg))' }}>
              {config.portalLabel}
            </p>
          </div>
        </div>
        <button
          onClick={onMobileClose}
          className="md:hidden p-1 rounded-md transition-colors"
          style={{ color: 'hsl(var(--sidebar-fg))' }}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Main navigation">
        {config.items.map((item) => {
          const active = isActive(item.path, item.end);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              aria-current={active ? 'page' : undefined}
              className={cn('sidebar-nav-item', active && 'active')}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer p-3 flex-shrink-0">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
          style={{ color: 'hsl(var(--sidebar-fg))' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold flex-shrink-0 ring-2 ring-primary/30">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium sidebar-user-name truncate leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs truncate mt-0.5 sidebar-user-email">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex-shrink-0 p-1.5 rounded-md transition-colors hover:text-destructive hover:bg-destructive/10"
            style={{ color: 'hsl(var(--sidebar-fg))' }}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 sidebar-root"
        style={{ width: 'var(--sidebar-width, 248px)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside className="relative z-10 flex w-72 flex-col sidebar-root animate-slide-in-r">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
