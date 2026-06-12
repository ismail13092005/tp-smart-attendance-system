/**
 * Navigation configuration — single source of truth for all role-based nav.
 *
 * Each role has:
 *  - rootPath: where to redirect after login
 *  - label: portal display name
 *  - items: sidebar nav items (with optional badge and children)
 */

import {
  Home, Camera, History, Bell,
  QrCode, ClipboardList, AlertTriangle, BarChart3,
  LayoutDashboard, Building2, Users, FileText, Search,
  Baby, MapPin, BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Optional badge text (e.g. "New") */
  badge?: string;
  end?: boolean; // exact match for active state
}

export interface RoleNavConfig {
  rootPath: string;
  portalLabel: string;
  accentColor: string;
  items: NavItem[];
}

export const NAV_CONFIG: Record<string, RoleNavConfig> = {
  student: {
    rootPath:    '/student/home',
    portalLabel: 'Student Portal',
    accentColor: 'blue',
    items: [
      { label: 'Home',             path: '/student/home',              icon: Home,          end: true },
      { label: 'Scan Attendance',  path: '/student/scan-attendance',   icon: Camera },
      { label: 'My Attendance',    path: '/student/my-attendance',     icon: BookOpen },
      { label: 'History',          path: '/student/history',           icon: History },
      { label: 'Notifications',    path: '/student/notifications',     icon: Bell },
    ],
  },

  faculty: {
    rootPath:    '/professor/home',
    portalLabel: 'Faculty Portal',
    accentColor: 'violet',
    items: [
      { label: 'Home',             path: '/professor/home',            icon: Home,          end: true },
      { label: 'Generate QR',      path: '/professor/generate-qr',    icon: QrCode },
      { label: 'Attendance Sheet', path: '/professor/attendance-sheet',icon: ClipboardList },
      { label: 'Defaulters',       path: '/professor/defaulters',      icon: AlertTriangle },
      { label: 'Reports',          path: '/professor/reports',         icon: BarChart3 },
    ],
  },

  admin: {
    rootPath:    '/admin/overview',
    portalLabel: 'Admin Portal',
    accentColor: 'emerald',
    items: [
      { label: 'Overview',         path: '/admin/overview',            icon: LayoutDashboard, end: true },
      { label: 'Branch Data',      path: '/admin/branch-data',         icon: Building2 },
      { label: 'Faculty Monitor',  path: '/admin/faculty-monitoring',  icon: Users },
      { label: 'Reports',          path: '/admin/reports',             icon: FileText },
      { label: 'Search',           path: '/admin/search',              icon: Search },
    ],
  },

  parent: {
    rootPath:    '/parent/home',
    portalLabel: 'Parent Portal',
    accentColor: 'orange',
    items: [
      { label: 'Home',             path: '/parent/home',               icon: Home,          end: true },
      { label: 'Child Attendance', path: '/parent/child-attendance',   icon: Baby },
      { label: 'Location',         path: '/parent/location',           icon: MapPin },
      { label: 'Notifications',    path: '/parent/notifications',      icon: Bell },
    ],
  },
};

/** Get the root redirect path for a given role */
export function getRoleRoot(role: string): string {
  return NAV_CONFIG[role]?.rootPath ?? '/login';
}
