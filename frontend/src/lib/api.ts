import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  sessionId: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'faculty' | 'admin' | 'parent';
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  courseCode: string;
  courseName: string;
  sessionType: string;
  status: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime?: string;
  location: string;
  geofenceRadius: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  expectedCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  markedAt: string;
  faceConfidence?: number;
  isManualOverride: boolean;
}

export interface DeviceSession {
  id: string;
  platform: string;
  deviceName: string | null;
  ipAddress: string;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

// ── Client ────────────────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    });

    this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const deviceId = localStorage.getItem('deviceId');
      if (deviceId) config.headers['X-Device-Id'] = deviceId;
      return config;
    });

    this.client.interceptors.response.use(
      (r) => r,
      async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          const refreshToken = localStorage.getItem('refreshToken');

          if (!refreshToken) {
            this.clearAndRedirect();
            return Promise.reject(error);
          }

          if (isRefreshing) {
            return new Promise((resolve) => {
              refreshQueue.push((token) => {
                original.headers.Authorization = `Bearer ${token}`;
                resolve(this.client.request(original));
              });
            });
          }

          isRefreshing = true;
          try {
            const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: newRefresh } = res.data.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefresh);
            refreshQueue.forEach((cb) => cb(accessToken));
            refreshQueue = [];
            original.headers.Authorization = `Bearer ${accessToken}`;
            return this.client.request(original);
          } catch {
            this.clearAndRedirect();
            return Promise.reject(error);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  private clearAndRedirect() {
    // Clear both localStorage and Zustand store so guards redirect correctly
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    try {
      (window as any).__authStore?.getState?.()?.clearAuth?.();
    } catch { /* ignore */ }
    window.location.href = '/login';
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<ApiResponse<LoginResult>> {
    const r = await this.client.post('/auth/login', { email, password });
    return r.data;
  }

  async register(data: {
    email: string; password: string; firstName: string;
    lastName: string; role: string; phone?: string;
  }): Promise<ApiResponse<{ user: User }>> {
    const r = await this.client.post('/auth/register', data);
    return r.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout').catch(() => {});
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const r = await this.client.post('/auth/refresh', { refreshToken });
    return r.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    const r = await this.client.post('/auth/change-password', { currentPassword, newPassword });
    return r.data;
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    const r = await this.client.post('/auth/forgot-password', { email });
    return r.data;
  }

  async listSessions(): Promise<ApiResponse<{ sessions: DeviceSession[] }>> {
    const r = await this.client.get('/auth/sessions');
    return r.data;
  }

  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    const r = await this.client.delete(`/auth/sessions/${sessionId}`);
    return r.data;
  }

  async revokeAllSessions(): Promise<ApiResponse<void>> {
    const r = await this.client.delete('/auth/sessions');
    return r.data;
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getMe(): Promise<ApiResponse<{ user: User }>> {
    const r = await this.client.get('/users/me');
    return r.data;
  }

  async updateMe(data: { firstName?: string; lastName?: string; phone?: string }): Promise<ApiResponse<{ user: User }>> {
    const r = await this.client.put('/users/me', data);
    return r.data;
  }

  async listUsers(params?: { role?: string; status?: string; search?: string; page?: number; limit?: number }) {
    const r = await this.client.get('/users', { params });
    return r.data;
  }

  // ── Face ──────────────────────────────────────────────────────────────────

  async enrollFace(faceImage: File) {
    const fd = new FormData();
    fd.append('faceImage', faceImage);
    const r = await this.client.post('/face/enroll', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data;
  }

  async checkFaceQuality(faceImage: File) {
    const fd = new FormData();
    fd.append('faceImage', faceImage);
    const r = await this.client.post('/face/quality-check', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data;
  }

  async checkEnrollmentStatus() {
    const r = await this.client.get('/face/enrollment-status');
    return r.data;
  }

  async deleteEnrollment() {
    const r = await this.client.delete('/face/enrollment');
    return r.data;
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async getSessions() {
    const r = await this.client.get('/sessions');
    return r.data;
  }

  async getSession(id: string) {
    const r = await this.client.get(`/sessions/${id}`);
    return r.data;
  }

  async createSession(data: unknown) {
    const r = await this.client.post('/sessions', data);
    return r.data;
  }

  async startSession(id: string, coords?: { latitude: number; longitude: number }) {
    const r = await this.client.post(`/sessions/${id}/start`, coords ?? {});
    return r.data;
  }

  async refreshQR(id: string) {
    const r = await this.client.post(`/sessions/${id}/refresh-qr`);
    return r.data;
  }

  async validateQRToken(token: string) {
    const r = await this.client.post('/sessions/validate-qr', { token });
    return r.data;
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  async markAttendance(data: {
    qrToken: string; faceImage: File;
    latitude: number; longitude: number; accuracy?: number;
  }) {
    const fd = new FormData();
    fd.append('qrToken', data.qrToken);
    fd.append('faceImage', data.faceImage);
    fd.append('latitude', String(data.latitude));
    fd.append('longitude', String(data.longitude));
    if (data.accuracy) fd.append('accuracy', String(data.accuracy));
    const r = await this.client.post('/attendance/mark', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data;
  }

  async getSessionAttendance(sessionId: string) {
    const r = await this.client.get(`/attendance/session/${sessionId}`);
    return r.data;
  }

  async getStudentAttendance(studentId: string, filters?: Record<string, unknown>) {
    const r = await this.client.get(`/attendance/student/${studentId}`, { params: filters });
    return r.data;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getStudentDashboard(studentId: string) {
    const r = await this.client.get(`/dashboard/student/${studentId}`);
    return r.data;
  }

  async getStudentHistory(studentId: string, filters?: { startDate?: string; endDate?: string; courseCode?: string }) {
    const r = await this.client.get(`/dashboard/student/${studentId}/history`, { params: filters });
    return r.data;
  }

  async getFacultyDashboard(facultyId: string) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}`);
    return r.data;
  }

  async getFacultySessionSheet(facultyId: string, sessionId: string) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}/session/${sessionId}/sheet`);
    return r.data;
  }

  async getFacultyDefaulters(facultyId: string, params?: { threshold?: number; courseCode?: string }) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}/defaulters`, { params });
    return r.data;
  }

  async getFacultyReports(facultyId: string, params?: { startDate?: string; endDate?: string; courseCode?: string }) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}/reports`, { params });
    return r.data;
  }

  async getFacultyReportsExport(facultyId: string, params?: { startDate?: string; endDate?: string; courseCode?: string }) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}/reports/export`, { params });
    return r.data;
  }

  async getAdminDashboard() {
    const r = await this.client.get('/dashboard/admin');
    return r.data;
  }

  async getAdminToday() {
    const r = await this.client.get('/dashboard/admin/today');
    return r.data;
  }

  async getAdminTrend(days = 30) {
    const r = await this.client.get('/dashboard/admin/trend', { params: { days } });
    return r.data;
  }

  async getAdminFacultyMonitoring(params?: { departmentId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) {
    const r = await this.client.get('/dashboard/admin/faculty-monitoring', { params });
    return r.data;
  }

  async getAdminReports(params?: { period?: string; startDate?: string; endDate?: string; departmentId?: string }) {
    const r = await this.client.get('/dashboard/admin/reports', { params });
    return r.data;
  }

  async getAdminReportsExport(params?: { period?: string; startDate?: string; endDate?: string; departmentId?: string }) {
    const r = await this.client.get('/dashboard/admin/reports/export', { params });
    return r.data;
  }

  async getAdminSearch(params: { q?: string; role?: string; page?: number; limit?: number }) {
    const r = await this.client.get('/dashboard/admin/search', { params });
    return r.data;
  }

  async getAdminBranchData(params?: { departmentId?: string; termId?: string }) {
    const r = await this.client.get('/dashboard/admin/branch-data', { params });
    return r.data;
  }

  async getFacultySessionLive(facultyId: string, sessionId: string) {
    const r = await this.client.get(`/dashboard/faculty/${facultyId}/session/${sessionId}/live`);
    return r.data;
  }

  async markNotificationsRead(ids?: string[]) {
    const r = await this.client.post('/dashboard/notifications/mark-read', { ids });
    return r.data;
  }

  async getStudentUnreadCount(studentId: string) {
    const r = await this.client.get(`/dashboard/student/${studentId}/notifications/unread-count`);
    return r.data;
  }

  async getParentDashboard(parentId: string) {
    const r = await this.client.get(`/dashboard/parent/${parentId}`);
    return r.data;
  }

  async getParentChildSubjects(parentId: string, childId: string) {
    const r = await this.client.get(`/dashboard/parent/${parentId}/child/${childId}/subjects`);
    return r.data;
  }

  async getParentChildToday(parentId: string, childId: string) {
    const r = await this.client.get(`/dashboard/parent/${parentId}/child/${childId}/today`);
    return r.data;
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async getNotifications() {
    const r = await this.client.get('/notifications');
    return r.data;
  }

  async markNotificationRead(id: string) {
    const r = await this.client.post(`/notifications/${id}/read`);
    return r.data;
  }

  async markAllNotificationsRead() {
    const r = await this.client.post('/notifications/mark-all-read');
    return r.data;
  }

  async triggerDailyReport() {
    const r = await this.client.post('/notifications/trigger-daily-report');
    return r.data;
  }

  async getAttendanceReport(params?: Record<string, string>) {
    const r = await this.client.get('/dashboard/attendance-report', { params });
    return r.data;
  }

  async manualOverride(data: unknown) {
    const r = await this.client.post('/attendance/manual-override', data);
    return r.data;
  }

  async bulkMark(data: { sessionId: string; studentIds: string[]; status: string; reason: string }) {
    const r = await this.client.post('/attendance/bulk-mark', data);
    return r.data;
  }

  async endSession(id: string) {
    const r = await this.client.post(`/sessions/${id}/end`);
    return r.data;
  }
}

export const api = new ApiClient();

/** Extract error message from axios error */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
