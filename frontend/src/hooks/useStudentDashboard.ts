/**
 * Query hooks for the student dashboard module.
 * All hooks use @tanstack/react-query for caching, background refetch,
 * and loading/error state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubjectSummary {
  course_code: string;
  course_name: string;
  total_classes: string;
  attended: string;
  pct: string;
}

export interface TodaySession {
  id: string;
  course_code: string;
  course_name: string;
  session_type: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
  location: string;
  faculty_name: string;
}

export interface AttendanceSummary {
  total: string;
  attended: string;
  overall_pct: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
}

export interface StudentDashboardData {
  summary: AttendanceSummary;
  subjects: SubjectSummary[];
  todaySessions: TodaySession[];
  notifications: Notification[];
}

export interface HistoryRecord {
  id: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  marked_at: string | null;
  face_confidence: number | null;
  is_manual_override: boolean;
  scheduled_start: string;
  scheduled_end: string;
  location: string;
  session_type: string;
  course_code: string;
  course_name: string;
  faculty_name: string;
}

export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  courseCode?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Main dashboard data — summary, today's sessions, subjects, notifications */
export function useStudentDashboard(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-dashboard', studentId],
    queryFn: async (): Promise<StudentDashboardData> => {
      const r = await api.getStudentDashboard(studentId!);
      return r.data;
    },
    enabled: !!studentId,
    staleTime: 60_000,        // 1 min — dashboard data is relatively stable
    refetchInterval: 120_000, // background refresh every 2 min
  });
}

/** Date-wise attendance history with filters */
export function useStudentHistory(
  studentId: string | undefined,
  filters: HistoryFilters = {},
) {
  return useQuery({
    queryKey: ['student-history', studentId, filters],
    queryFn: async (): Promise<{ records: HistoryRecord[]; subjects: { course_code: string; course_name: string }[] }> => {
      const r = await api.getStudentHistory(studentId!, filters);
      return r.data;
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

/** Subject-wise attendance (reuses dashboard data) */
export function useSubjectAttendance(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-subjects', studentId],
    queryFn: async (): Promise<SubjectSummary[]> => {
      const r = await api.getStudentDashboard(studentId!);
      return r.data?.subjects ?? [];
    },
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

/** Enrollment status for face biometric */
export function useFaceEnrollmentStatus() {
  return useQuery({
    queryKey: ['face-enrollment-status'],
    queryFn: async () => {
      const r = await api.checkEnrollmentStatus();
      return r.data as { hasEnrollment: boolean; enrolledAt?: string; expiresAt?: string };
    },
    staleTime: 5 * 60_000,
  });
}

/** Mark student notifications as read */
export function useMarkStudentNotificationsRead(studentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.markNotificationsRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-dashboard', studentId] });
      qc.invalidateQueries({ queryKey: ['student-unread', studentId] });
    },
  });
}
