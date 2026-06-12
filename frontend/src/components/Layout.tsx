import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  LogOut, Home, Camera, History, User, Plus, Calendar,
  Users, BarChart3, Bell, FileText,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface NavLink { to: string; icon: React.ElementType; label: string; }

function getNavLinks(role: string): NavLink[] {
  switch (role) {
    case 'student': return [
      { to: '/',                   icon: Home,          label: 'Home' },
      { to: '/mark-attendance',    icon: Camera,        label: 'Scan Attendance' },
      { to: '/attendance-history', icon: History,       label: 'My Attendance' },
      { to: '/face-enrollment',    icon: User,          label: 'Face Enrollment' },
    ];
    case 'faculty': return [
      { to: '/',               icon: Home,          label: 'Home' },
      { to: '/create-session', icon: Plus,          label: 'Generate QR' },
      { to: '/sessions',       icon: Calendar,      label: 'My Sessions' },
    ];
    case 'admin': return [
      { to: '/',           icon: Home,          label: 'Overview' },
      { to: '/users',      icon: Users,         label: 'Users' },
      { to: '/analytics',  icon: BarChart3,     label: 'Analytics' },
      { to: '/audit',      icon: FileText,      label: 'Audit Logs' },
    ];
    case 'parent': return [
      { to: '/',       icon: Home, label: 'Home' },
      { to: '/alerts', icon: Bell, label: 'Alerts' },
    ];
    default: return [];
  }
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  admin:   'Admin',
  parent:  'Parent',
};

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try { await import('../lib/api').then(m => m.api.logout()); } catch {}
    clearAuth();
    navigate('/login');
  };

  const links = getNavLinks(user?.role ?? '');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card flex-shrink-0">
        {/* Logo */}
        <div className="flex h-14 items-center px-5 border-b border-border gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">SA</div>
          <span className="text-sm font-bold text-foreground">SmartAttend</span>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {ROLE_LABELS[user?.role ?? ''] ?? 'User'} Portal
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map((link) => {
            const active = location.pathname === link.to ||
              (link.to !== '/' && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <link.icon className="h-4 w-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b border-border bg-card px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">SA</div>
            <span className="text-sm font-bold text-foreground">SmartAttend</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground capitalize">{user?.firstName}</span>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-border bg-card flex-shrink-0">
          {links.slice(0, 4).map((link) => {
            const active = location.pathname === link.to ||
              (link.to !== '/' && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <link.icon className="h-5 w-5" />
                <span className="text-[10px] leading-none">{link.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
