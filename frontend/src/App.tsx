/**
 * App.tsx — Route configuration
 *
 * Structure:
 *   /login, /register          — public
 *   /                          — redirects to role root
 *   /student/*                 — student routes (RequireRole: student)
 *   /professor/*               — faculty routes (RequireRole: faculty)
 *   /admin/*                   — admin routes   (RequireRole: admin)
 *   /parent/*                  — parent routes  (RequireRole: parent)
 *
 * Each role group is wrapped in:
 *   RequireRole → DashboardShell → Outlet
 *
 * Pages are lazy-loaded for code splitting.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole, RedirectToRole } from './router/guards';
import { DashboardShell } from './components/layout/DashboardShell';
import { PageLoader } from './components/layout/PageLoader';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

// ── Public pages ──────────────────────────────────────────────────────────────
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// ── Student pages ─────────────────────────────────────────────────────────────
const StudentHome         = lazy(() => import('./pages/student/Dashboard'));
const ScanAttendance      = lazy(() => import('./pages/student/MarkAttendance'));
const MyAttendance        = lazy(() => import('./pages/student/MyAttendance'));
const StudentHistory      = lazy(() => import('./pages/student/AttendanceHistory'));
const StudentNotifications= lazy(() => import('./pages/student/Notifications'));
const FaceEnrollment      = lazy(() => import('./pages/student/FaceEnrollment'));

// ── Professor pages ───────────────────────────────────────────────────────────
const ProfessorHome       = lazy(() => import('./pages/professor/Home'));
const GenerateQR          = lazy(() => import('./pages/professor/GenerateQR'));
const AttendanceSheet     = lazy(() => import('./pages/professor/AttendanceSheet'));
const Defaulters          = lazy(() => import('./pages/professor/Defaulters'));
const ProfessorReports    = lazy(() => import('./pages/professor/Reports'));
const SessionView         = lazy(() => import('./pages/professor/SessionView'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminOverview       = lazy(() => import('./pages/admin/Overview'));
const BranchData          = lazy(() => import('./pages/admin/BranchData'));
const FacultyMonitoring   = lazy(() => import('./pages/admin/FacultyMonitoring'));
const AdminReports        = lazy(() => import('./pages/admin/Reports'));
const AdminSearch         = lazy(() => import('./pages/admin/Search'));

// ── Parent pages ──────────────────────────────────────────────────────────────
const ParentHome          = lazy(() => import('./pages/parent/Home'));
const ChildAttendance     = lazy(() => import('./pages/parent/ChildAttendance'));
const ParentLocation      = lazy(() => import('./pages/parent/Location'));
const ParentNotifications = lazy(() => import('./pages/parent/Notifications'));

// ── Lazy wrapper ──────────────────────────────────────────────────────────────
const L = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────────────── */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Root redirect ──────────────────────────────────────────────── */}
          <Route path="/" element={<RequireAuth><RedirectToRole /></RequireAuth>} />

          {/* ── Student routes ─────────────────────────────────────────────── */}
          <Route
            path="/student"
            element={
              <RequireRole roles={['student']}>
                <DashboardShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/student/home" replace />} />
            <Route path="home"             element={<L><StudentHome /></L>} />
            <Route path="scan-attendance"  element={<L><ScanAttendance /></L>} />
            <Route path="my-attendance"    element={<L><MyAttendance /></L>} />
            <Route path="history"          element={<L><StudentHistory /></L>} />
            <Route path="notifications"    element={<L><StudentNotifications /></L>} />
            <Route path="face-enrollment"  element={<L><FaceEnrollment /></L>} />
          </Route>

          {/* ── Professor routes ───────────────────────────────────────────── */}
          <Route
            path="/professor"
            element={
              <RequireRole roles={['faculty']}>
                <DashboardShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/professor/home" replace />} />
            <Route path="home"             element={<L><ProfessorHome /></L>} />
            <Route path="generate-qr"      element={<L><GenerateQR /></L>} />
            <Route path="attendance-sheet" element={<L><AttendanceSheet /></L>} />
            <Route path="defaulters"       element={<L><Defaulters /></L>} />
            <Route path="reports"          element={<L><ProfessorReports /></L>} />
            <Route path="session/:id"      element={<L><SessionView /></L>} />
          </Route>

          {/* ── Admin routes ───────────────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <DashboardShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/admin/overview" replace />} />
            <Route path="overview"          element={<L><AdminOverview /></L>} />
            <Route path="branch-data"       element={<L><BranchData /></L>} />
            <Route path="faculty-monitoring"element={<L><FacultyMonitoring /></L>} />
            <Route path="reports"           element={<L><AdminReports /></L>} />
            <Route path="search"            element={<L><AdminSearch /></L>} />
          </Route>

          {/* ── Parent routes ──────────────────────────────────────────────── */}
          <Route
            path="/parent"
            element={
              <RequireRole roles={['parent']}>
                <DashboardShell />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/parent/home" replace />} />
            <Route path="home"             element={<L><ParentHome /></L>} />
            <Route path="child-attendance" element={<L><ChildAttendance /></L>} />
            <Route path="location"         element={<L><ParentLocation /></L>} />
            <Route path="notifications"    element={<L><ParentNotifications /></L>} />
          </Route>

          {/* ── Catch-all ──────────────────────────────────────────────────── */}
          <Route path="*" element={<RequireAuth><RedirectToRole /></RequireAuth>} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
