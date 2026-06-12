/**
 * Query hooks for the admin dashboard module.
 * All hooks use @tanstack/react-query for caching and background refresh.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  total_students: string;
  total_faculty: string;
  active_sessions: string;
  avg_attendance_pct: string;
}

export interface TodayStats {
  total_sessions: string;
  active_sessions: string;
  completed_sessions: string;
  total_expected: string;
  total_present: string;
  total_absent: string;
  today_pct: string;
}

export interface TrendPoint {
  date: string;
  sessions: string;
  expected: string;
  attended: string;
  pct: string;
}

export interface DeptStat {
  department: string;
  students: string;
  total_records: string;
  attended: string;
  pct: string;
}

export interface ActiveSession {
  id: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
  location: string;
  present_count: number;
  expected_count: number;
}

export interface FacultyMonitorRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
  last_login_at: string | null;
  sessions_total: string;
  sessions_completed: string;
  sessions_active: string;
  total_expected: string;
  total_present: string;
  avg_attendance_pct: string;
  last_session_at: string | null;
}

export interface ReportTrendPoint {
  period: string;
  sessions: string;
  total_records: string;
  attended: string;
  absent: string;
  pct: string;
}

export interface Defaulter {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string | null;
  department: string | null;
  total: string;
  attended: string;
  pct: string;
}

export interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  roll_number: string | null;
  faculty_id: string | null;
  department: string | null;
  total_classes: string;
  attended: string;
  attendance_pct: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const r = await api.getAdminDashboard();
      return r.data as {
        overview: AdminOverview;
        departments: DeptStat[];
        activeSessions: ActiveSession[];
        facultyActivity: Array<{ id: string; first_name: string; last_name: string; sessions_conducted: string; total_present: string }>;
      };
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useAdminToday() {
  return useQuery({
    queryKey: ['admin-today'],
    queryFn: async () => {
      const r = await api.getAdminToday();
      return r.data.today as TodayStats;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAdminTrend(days = 30) {
  return useQuery({
    queryKey: ['admin-trend', days],
    queryFn: async () => {
      const r = await api.getAdminTrend(days);
      return (r.data?.trend ?? []) as TrendPoint[];
    },
    staleTime: 120_000,
  });
}

export function useAdminFacultyMonitoring(params: {
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ['admin-faculty-monitoring', params],
    queryFn: async () => {
      const r = await api.getAdminFacultyMonitoring(params);
      return r.data as {
        faculty: FacultyMonitorRow[];
        total: number;
        departments: Array<{ id: string; name: string }>;
      };
    },
    staleTime: 60_000,
  });
}

export function useAdminReports(params: {
  period?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
} = {}) {
  return useQuery({
    queryKey: ['admin-reports', params],
    queryFn: async () => {
      const r = await api.getAdminReports(params);
      return r.data as {
        trend: ReportTrendPoint[];
        defaulters: Defaulter[];
        departments: Array<{ id: string; name: string }>;
      };
    },
    staleTime: 60_000,
  });
}

export function useAdminSearch(params: {
  q?: string;
  role?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['admin-search', params],
    queryFn: async () => {
      const r = await api.getAdminSearch(params);
      return r.data as {
        users: SearchResult[];
        total: number;
        page: number;
        limit: number;
      };
    },
    enabled: !!(params.q && params.q.length >= 1),
    staleTime: 30_000,
  });
}

// ── New hooks for missing endpoints ──────────────────────────────────────────

export interface BranchDeptStat {
  department_id: string;
  department: string;
  students: string;
  total_records: string;
  attended: string;
  pct: string;
}

export interface BranchClassStat {
  class_id: string;
  course_code: string;
  course_name: string;
  department: string;
  enrolled: string;
  sessions: string;
  total_present: string;
  total_expected: string;
  avg_pct: string;
}

export function useAdminBranchData(params: { departmentId?: string; termId?: string } = {}) {
  return useQuery({
    queryKey: ['admin-branch-data', params],
    queryFn: async () => {
      const r = await api.getAdminBranchData(params);
      return r.data as {
        departments: BranchDeptStat[];
        classes: BranchClassStat[];
        terms: Array<{ id: string; name: string; code: string; is_active: boolean }>;
        deptList: Array<{ id: string; name: string }>;
      };
    },
    staleTime: 120_000,
  });
}

export interface LiveAttendanceRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  roll_number: string | null;
  status: string;
  marked_at: string;
  face_confidence: number | null;
  qr_verified: boolean;
  face_verified: boolean;
  geo_verified: boolean;
  is_manual_override: boolean;
}

export function useFacultySessionLive(
  facultyId: string | undefined,
  sessionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['session-live', sessionId],
    queryFn: async () => {
      const r = await api.getFacultySessionLive(facultyId!, sessionId!);
      return r.data as {
        session: { id: string; status: string; present_count: number; late_count: number; absent_count: number; expected_count: number };
        records: LiveAttendanceRecord[];
        total_marked: number;
      };
    },
    enabled: !!facultyId && !!sessionId && enabled,
    staleTime: 0,
    refetchInterval: 15_000, // poll every 15 s for live sessions
  });
}

export function useStudentUnreadCount(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-unread', studentId],
    queryFn: async () => {
      const r = await api.getStudentUnreadCount(studentId!);
      return (r.data?.unread ?? 0) as number;
    },
    enabled: !!studentId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
