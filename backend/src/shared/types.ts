// ─────────────────────────────────────────────────────────────────────────────
// Shared types — single source of truth for enums and interfaces
// ─────────────────────────────────────────────────────────────────────────────

// Must match the user_role enum in migration 001
export enum UserRole {
  STUDENT   = 'student',
  FACULTY   = 'faculty',
  ADMIN     = 'admin',
  PRINCIPAL = 'admin',   // PRINCIPAL maps to admin role in DB; distinguished by is_super_admin
  PARENT    = 'parent',
}

// Must match user_status enum in migration 001
export enum UserStatus {
  ACTIVE               = 'active',
  INACTIVE             = 'inactive',
  SUSPENDED            = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT  = 'absent',
  LATE    = 'late',
  EXCUSED = 'excused',
}

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  ACTIVE    = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum VerificationStep {
  QR_SCAN           = 'qr_scan',
  FACE_VERIFICATION = 'face_verification',
  GEOFENCE_CHECK    = 'geofence_check',
}

// Must match audit_action enum in migration 001
export enum AuditAction {
  LOGIN                       = 'login',
  LOGOUT                      = 'logout',
  REGISTER                    = 'register',
  PASSWORD_RESET              = 'password_reset',
  PROFILE_UPDATE              = 'profile_update',
  FACE_ENROLLED               = 'face_enrolled',
  FACE_UPDATED                = 'face_updated',
  FACE_DELETED                = 'face_deleted',
  SESSION_CREATED             = 'session_created',
  SESSION_STARTED             = 'session_started',
  SESSION_ENDED               = 'session_ended',
  SESSION_CANCELLED           = 'session_cancelled',
  QR_GENERATED                = 'qr_generated',
  QR_REFRESHED                = 'qr_refreshed',
  ATTENDANCE_MARKED           = 'attendance_marked',
  ATTENDANCE_FAILED           = 'attendance_failed',
  MANUAL_OVERRIDE_REQUESTED   = 'manual_override_requested',
  MANUAL_OVERRIDE_APPROVED    = 'manual_override_approved',
  MANUAL_OVERRIDE_REJECTED    = 'manual_override_rejected',
  USER_CREATED                = 'user_created',
  USER_UPDATED                = 'user_updated',
  USER_DEACTIVATED            = 'user_deactivated',
  ROLE_CHANGED                = 'role_changed',
  PARENT_LINKED               = 'parent_linked',
  PARENT_UNLINKED             = 'parent_unlinked',
  DATA_EXPORTED               = 'data_exported',
  DATA_DELETED                = 'data_deleted',
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string;          // user UUID
  email: string;
  role: UserRole;
  sessionId: string;    // device_session UUID — enables per-session revocation
  jti: string;          // JWT ID — unique per token
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

// ── Request context ───────────────────────────────────────────────────────────

export interface RequestContext {
  ip: string;
  userAgent: string;
  deviceId?: string;
  platform?: string;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface FaceDescriptor {
  descriptor: number[];
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface QRPayload {
  sessionId: string;
  facultyId: string;
  timestamp: number;
  nonce: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
