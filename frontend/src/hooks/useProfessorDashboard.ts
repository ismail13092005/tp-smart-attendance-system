/**
 * Query hooks for the professor dashboard module.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfSession {
  id: string;
  course_code: string;
  course_name: string;
  session_type: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
  location: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  expected_count: number;
  notes?: string;
}

export interface SheetRow {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string | null;
  record_id: string | null;
  status: 'present' | 'late' | 'absent' | 'excused' | null;
  marked_at: string | null;
  face_confidence: number | null;
  qr_verified: boolean;
  face_verified: boolean;
  geo_verified: boolean;
  is_manual_override: boolean;
  override_reason: string | null;
  course_code: string;
  course_name: string;
  session_type: string;
  scheduled_start: string;
  scheduled_end: string;
  location: string;
}

export interface Defaulter {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string | null;
  course_code: string;
  course_name: string;
  total: string;
  attended: string;
  absent: string;
  pct: string;
}

export interface LectureReport {
  session_id: string;
  course_code: string;
  course_name: string;
  session_type: string;
  scheduled_start: string;
  scheduled_end: string;
  location: string;
  expected_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  status: string;
  attendance_pct: string;
}

export interface SubjectSummary {
  course_code: string;
  course_name: string;
  total_sessions: string;
  total_expected: string;
  total_present: string;
  total_late: string;
  total_absent: string;
  avg_pct: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFacultyDashboard(facultyId: string | undefined) {
  return useQuery({
    queryKey: ['faculty-dashboard', facultyId],
    queryFn: async () => {
      const r = await api.getFacultyDashboard(facultyId!);
      return r.data as {
        todaySessions: ProfSession[];
        recentSessions: ProfSession[];
        defaulters: Defaulter[];
      };
    },
    enabled: !!facultyId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useSessions(facultyId: string | undefined) {
  return useQuery({
    queryKey: ['sessions', facultyId],
    queryFn: async () => {
      const r = await api.getSessions();
      return (r.data?.sessions ?? []) as ProfSession[];
    },
    enabled: !!facultyId,
    staleTime: 30_000,
  });
}

export function useSessionSheet(facultyId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-sheet', sessionId],
    queryFn: async () => {
      const r = await api.getFacultySessionSheet(facultyId!, sessionId!);
      return (r.data?.sheet ?? []) as SheetRow[];
    },
    enabled: !!facultyId && !!sessionId,
    staleTime: 15_000,
    refetchInterval: 30_000, // live refresh for active sessions
  });
}

export function useFacultyDefaulters(
  facultyId: string | undefined,
  params: { threshold?: number; courseCode?: string } = {},
) {
  return useQuery({
    queryKey: ['faculty-defaulters', facultyId, params],
    queryFn: async () => {
      const r = await api.getFacultyDefaulters(facultyId!, params);
      return r.data as { defaulters: Defaulter[]; courses: { course_code: string; course_name: string }[] };
    },
    enabled: !!facultyId,
    staleTime: 60_000,
  });
}

export function useFacultyReports(
  facultyId: string | undefined,
  params: { startDate?: string; endDate?: string; courseCode?: string } = {},
) {
  return useQuery({
    queryKey: ['faculty-reports', facultyId, params],
    queryFn: async () => {
      const r = await api.getFacultyReports(facultyId!, params);
      return r.data as { lectures: LectureReport[]; summary: SubjectSummary[]; courses: { course_code: string; course_name: string }[] };
    },
    enabled: !!facultyId,
    staleTime: 60_000,
  });
}

export function useManualOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; studentId: string; status: string; reason: string }) =>
      api.manualOverride(data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['session-sheet', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['faculty-dashboard'] });
    },
  });
}

export function useBulkMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; studentIds: string[]; status: string; reason: string }) =>
      api.bulkMark(data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['session-sheet', vars.sessionId] });
      qc.invalidateQueries({ queryKey: ['faculty-dashboard'] });
    },
  });
}
