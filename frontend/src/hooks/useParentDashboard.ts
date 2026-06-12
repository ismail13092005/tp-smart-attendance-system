/**
 * Query hooks for the parent dashboard module.
 * All data access is strictly scoped to the authenticated parent's linked children.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinkedChild {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_id: string;
  program: string;
  current_semester: number;
  total_classes: string;
  attended: string;
  overall_pct: string;
}

export interface ParentNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
}

export interface SubjectBreakdown {
  course_code: string;
  course_name: string;
  total_classes: string;
  attended: string;
  absent: string;
  pct: string;
}

export interface MonthlyPoint {
  month: string;
  month_date: string;
  total: string;
  attended: string;
  pct: string;
}

export interface TodaySession {
  session_id: string;
  course_code: string;
  course_name: string;
  session_type: string;
  session_status: string;
  scheduled_start: string;
  scheduled_end: string;
  campus_location: string;
  faculty_name: string;
  record_id: string | null;
  attendance_status: 'present' | 'late' | 'absent' | null;
  marked_at: string | null;
  face_confidence: number | null;
  is_manual_override: boolean;
}

export interface RecentRecord {
  id: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  marked_at: string;
  face_confidence: number | null;
  is_manual_override: boolean;
  scheduled_start: string;
  scheduled_end: string;
  campus_location: string;
  session_type: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Main parent dashboard — linked children + notifications */
export function useParentDashboard(parentId: string | undefined) {
  return useQuery({
    queryKey: ['parent-dashboard', parentId],
    queryFn: async () => {
      const r = await api.getParentDashboard(parentId!);
      return r.data as { children: LinkedChild[]; notifications: ParentNotification[] };
    },
    enabled: !!parentId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/** Child subject breakdown + monthly chart data */
export function useChildSubjects(parentId: string | undefined, childId: string | undefined) {
  return useQuery({
    queryKey: ['child-subjects', parentId, childId],
    queryFn: async () => {
      const r = await api.getParentChildSubjects(parentId!, childId!);
      return r.data as { subjects: SubjectBreakdown[]; monthly: MonthlyPoint[] };
    },
    enabled: !!parentId && !!childId,
    staleTime: 60_000,
  });
}

/** Child today's sessions + recent attendance with campus location */
export function useChildToday(parentId: string | undefined, childId: string | undefined) {
  return useQuery({
    queryKey: ['child-today', parentId, childId],
    queryFn: async () => {
      const r = await api.getParentChildToday(parentId!, childId!);
      return r.data as { today: TodaySession[]; recent: RecentRecord[] };
    },
    enabled: !!parentId && !!childId,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

/** Mark notifications as read — invalidates parent dashboard cache */
export function useMarkNotificationsRead(parentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-dashboard', parentId] });
    },
  });
}
