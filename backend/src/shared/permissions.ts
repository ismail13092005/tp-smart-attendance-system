/**
 * Permission Matrix
 *
 * Every action in the system is listed here.
 * Each role has an explicit allow/deny for every action.
 * Middleware reads this matrix — no scattered if/else role checks.
 *
 * Convention: true = allowed, false = denied
 */

import { UserRole } from './types';

// ── Action catalogue ──────────────────────────────────────────────────────────

export const Permission = {
  // Auth
  AUTH_REGISTER:              'auth:register',
  AUTH_LOGIN:                 'auth:login',
  AUTH_REFRESH:               'auth:refresh',
  AUTH_LOGOUT:                'auth:logout',
  AUTH_CHANGE_PASSWORD:       'auth:change_password',
  AUTH_RESET_PASSWORD:        'auth:reset_password',
  AUTH_REVOKE_SESSION:        'auth:revoke_session',
  AUTH_LIST_SESSIONS:         'auth:list_sessions',

  // Users — self
  USER_READ_SELF:             'user:read_self',
  USER_UPDATE_SELF:           'user:update_self',

  // Users — others (admin/principal)
  USER_READ_ANY:              'user:read_any',
  USER_CREATE:                'user:create',
  USER_UPDATE_ANY:            'user:update_any',
  USER_DEACTIVATE:            'user:deactivate',
  USER_CHANGE_ROLE:           'user:change_role',
  USER_LIST:                  'user:list',

  // Face biometrics
  FACE_ENROLL_SELF:           'face:enroll_self',
  FACE_READ_SELF:             'face:read_self',
  FACE_DELETE_SELF:           'face:delete_self',
  FACE_READ_ANY:              'face:read_any',   // admin audit only

  // Sessions
  SESSION_CREATE:             'session:create',
  SESSION_READ_OWN:           'session:read_own',
  SESSION_READ_ANY:           'session:read_any',
  SESSION_START:              'session:start',
  SESSION_END:                'session:end',
  SESSION_CANCEL:             'session:cancel',
  SESSION_REFRESH_QR:         'session:refresh_qr',

  // Attendance
  ATTENDANCE_MARK_SELF:       'attendance:mark_self',
  ATTENDANCE_READ_SELF:       'attendance:read_self',
  ATTENDANCE_READ_CLASS:      'attendance:read_class',
  ATTENDANCE_READ_ANY:        'attendance:read_any',
  ATTENDANCE_OVERRIDE:        'attendance:override',
  ATTENDANCE_APPROVE_OVERRIDE:'attendance:approve_override',

  // Parent visibility
  PARENT_READ_LINKED_STUDENT: 'parent:read_linked_student',
  PARENT_LINK_STUDENT:        'parent:link_student',
  PARENT_UNLINK_STUDENT:      'parent:unlink_student',

  // Audit logs
  AUDIT_READ_OWN:             'audit:read_own',
  AUDIT_READ_ANY:             'audit:read_any',

  // Analytics / reports
  ANALYTICS_READ_OWN:         'analytics:read_own',
  ANALYTICS_READ_ANY:         'analytics:read_any',

  // Notifications
  NOTIFICATION_READ_SELF:     'notification:read_self',
  NOTIFICATION_SEND_ANY:      'notification:send_any',

  // System
  SYSTEM_HEALTH:              'system:health',
  SYSTEM_CONFIG:              'system:config',
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];

// ── Role → Permission map ─────────────────────────────────────────────────────

type PermissionMatrix = Record<UserRole, Set<PermissionKey>>;

const buildMatrix = (): PermissionMatrix => {
  const allow = (...perms: PermissionKey[]): Set<PermissionKey> => new Set(perms);

  return {
    [UserRole.STUDENT]: allow(
      Permission.AUTH_LOGIN,
      Permission.AUTH_REFRESH,
      Permission.AUTH_LOGOUT,
      Permission.AUTH_CHANGE_PASSWORD,
      Permission.AUTH_REVOKE_SESSION,
      Permission.AUTH_LIST_SESSIONS,
      Permission.USER_READ_SELF,
      Permission.USER_UPDATE_SELF,
      Permission.FACE_ENROLL_SELF,
      Permission.FACE_READ_SELF,
      Permission.FACE_DELETE_SELF,
      Permission.ATTENDANCE_MARK_SELF,
      Permission.ATTENDANCE_READ_SELF,
      Permission.AUDIT_READ_OWN,
      Permission.ANALYTICS_READ_OWN,
      Permission.NOTIFICATION_READ_SELF,
      Permission.SYSTEM_HEALTH,
    ),

    [UserRole.FACULTY]: allow(
      Permission.AUTH_LOGIN,
      Permission.AUTH_REFRESH,
      Permission.AUTH_LOGOUT,
      Permission.AUTH_CHANGE_PASSWORD,
      Permission.AUTH_REVOKE_SESSION,
      Permission.AUTH_LIST_SESSIONS,
      Permission.USER_READ_SELF,
      Permission.USER_UPDATE_SELF,
      Permission.SESSION_CREATE,
      Permission.SESSION_READ_OWN,
      Permission.SESSION_START,
      Permission.SESSION_END,
      Permission.SESSION_CANCEL,
      Permission.SESSION_REFRESH_QR,
      Permission.ATTENDANCE_READ_CLASS,
      Permission.ATTENDANCE_OVERRIDE,
      Permission.AUDIT_READ_OWN,
      Permission.ANALYTICS_READ_OWN,
      Permission.NOTIFICATION_READ_SELF,
      Permission.SYSTEM_HEALTH,
    ),

    [UserRole.PARENT]: allow(
      Permission.AUTH_LOGIN,
      Permission.AUTH_REFRESH,
      Permission.AUTH_LOGOUT,
      Permission.AUTH_CHANGE_PASSWORD,
      Permission.AUTH_REVOKE_SESSION,
      Permission.AUTH_LIST_SESSIONS,
      Permission.USER_READ_SELF,
      Permission.USER_UPDATE_SELF,
      Permission.PARENT_READ_LINKED_STUDENT,
      Permission.PARENT_LINK_STUDENT,
      Permission.PARENT_UNLINK_STUDENT,
      Permission.NOTIFICATION_READ_SELF,
      Permission.SYSTEM_HEALTH,
    ),

    // ADMIN and PRINCIPAL both map to UserRole.ADMIN in the DB.
    // PRINCIPAL (is_super_admin=true) gets additional system:config permission
    // enforced at the service layer via the admin_profiles.is_super_admin flag.
    [UserRole.ADMIN]: allow(
      Permission.AUTH_LOGIN,
      Permission.AUTH_REFRESH,
      Permission.AUTH_LOGOUT,
      Permission.AUTH_CHANGE_PASSWORD,
      Permission.AUTH_REVOKE_SESSION,
      Permission.AUTH_LIST_SESSIONS,
      Permission.USER_READ_SELF,
      Permission.USER_UPDATE_SELF,
      Permission.USER_READ_ANY,
      Permission.USER_CREATE,
      Permission.USER_UPDATE_ANY,
      Permission.USER_DEACTIVATE,
      Permission.USER_CHANGE_ROLE,
      Permission.USER_LIST,
      Permission.FACE_READ_ANY,
      Permission.SESSION_READ_ANY,
      Permission.ATTENDANCE_READ_ANY,
      Permission.ATTENDANCE_OVERRIDE,
      Permission.ATTENDANCE_APPROVE_OVERRIDE,
      Permission.PARENT_READ_LINKED_STUDENT,
      Permission.AUDIT_READ_ANY,
      Permission.ANALYTICS_READ_ANY,
      Permission.NOTIFICATION_READ_SELF,
      Permission.NOTIFICATION_SEND_ANY,
      Permission.SYSTEM_HEALTH,
      Permission.SYSTEM_CONFIG,
    ),
  };
};

export const PERMISSION_MATRIX: PermissionMatrix = buildMatrix();

/**
 * Check if a role has a specific permission.
 * Used by the `can()` middleware guard.
 */
export function roleHasPermission(role: UserRole, permission: PermissionKey): boolean {
  return PERMISSION_MATRIX[role]?.has(permission) ?? false;
}
