/**
 * AuthService
 *
 * Handles: register, login, logout, refresh, password change,
 *          password reset request/confirm, session management.
 *
 * All sensitive operations write to audit_logs via raw SQL
 * (avoids circular dependency with Sequelize models).
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import { tokenService, TokenPair } from './token.service';
import logger from '../../shared/logger';
import {
  UserRole,
  UserStatus,
  AuditAction,
  RequestContext,
} from '../../shared/types';
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
  NotFoundError,
  AccountSuspendedError,
  TokenInvalidError,
} from '../../shared/errors';

// ── Public-safe user shape ────────────────────────────────────────────────────

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginResult {
  user: SafeUser;
  tokens: TokenPair;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
}

// ── AuthService ───────────────────────────────────────────────────────────────

export class AuthService {

  // ── Register ────────────────────────────────────────────────────────────────

  async register(input: RegisterInput, ctx: RequestContext): Promise<SafeUser> {
    // Validate password strength
    this.assertPasswordStrength(input.password);

    // Check email uniqueness
    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [input.email.toLowerCase().trim()],
    );
    if (existing.length > 0) {
      throw new ConflictError('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const userId = uuidv4();

    const { rows } = await pool.query(
      `INSERT INTO users
         (id, email, password_hash, first_name, last_name, role, status,
          email_verified, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'pending_verification',FALSE,NOW(),NOW())
       RETURNING id, email, first_name, last_name, role, status,
                 email_verified, last_login_at, created_at`,
      [
        userId,
        input.email.toLowerCase().trim(),
        passwordHash,
        input.firstName.trim(),
        input.lastName.trim(),
        input.role,
      ],
    );

    const user = this.mapUser(rows[0]);

    await this.audit({
      userId,
      action: AuditAction.REGISTER,
      resourceType: 'user',
      resourceId: userId,
      success: true,
      ctx,
      metadata: { role: input.role },
    });

    logger.info('User registered', { userId, email: user.email, role: user.role });
    return user;
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    ctx: RequestContext,
  ): Promise<LoginResult> {
    const normalised = email.toLowerCase().trim();

    // Fetch user (include password_hash)
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, status,
              email_verified, last_login_at, created_at
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [normalised],
    );

    // Constant-time failure — don't reveal whether email exists
    const user = rows[0];
    const dummyHash = '$2b$12$invalidhashtopreventtimingattacks000000000000000000000';
    const hashToCheck = user?.password_hash ?? dummyHash;
    const passwordMatch = await bcrypt.compare(password, hashToCheck);

    if (!user || !passwordMatch) {
      // Audit failed attempt (userId may be null if email not found)
      await this.audit({
        userId: user?.id ?? null,
        action: AuditAction.LOGIN,
        resourceType: 'auth',
        success: false,
        ctx,
        metadata: { email: normalised, reason: 'invalid_credentials' },
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      await this.audit({
        userId: user.id,
        action: AuditAction.LOGIN,
        resourceType: 'auth',
        success: false,
        ctx,
        metadata: { reason: 'account_suspended' },
      });
      throw new AccountSuspendedError();
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedError('Account is inactive. Contact your administrator.');
    }

    // Issue token pair + create device_session row
    const tokens = await tokenService.issueTokenPair(
      user.id,
      user.email,
      user.role,
      ctx,
    );

    // Update last_login_at
    await pool.query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, last_login_ua = $2,
              status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END,
              updated_at = NOW()
       WHERE id = $3`,
      [ctx.ip, ctx.userAgent, user.id],
    );

    await this.audit({
      userId: user.id,
      action: AuditAction.LOGIN,
      resourceType: 'auth',
      resourceId: tokens.sessionId,
      success: true,
      ctx,
      metadata: { sessionId: tokens.sessionId },
    });

    logger.info('User logged in', { userId: user.id, role: user.role });
    return { user: this.mapUser(user), tokens };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, sessionId: string, ctx: RequestContext): Promise<void> {
    await tokenService.revokeSession(sessionId, 'logout');

    await this.audit({
      userId,
      action: AuditAction.LOGOUT,
      resourceType: 'auth',
      resourceId: sessionId,
      success: true,
      ctx,
    });

    logger.info('User logged out', { userId, sessionId });
  }

  // ── Refresh tokens ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    return tokenService.rotateRefreshToken(refreshToken, ctx);
  }

  // ── Change password (authenticated) ────────────────────────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    this.assertPasswordStrength(newPassword);

    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundError('User not found');

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      await this.audit({
        userId,
        action: AuditAction.PASSWORD_RESET,
        resourceType: 'user',
        success: false,
        ctx,
        metadata: { reason: 'wrong_current_password' },
      });
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId],
    );

    // Revoke all other sessions (security best practice)
    await tokenService.revokeAllUserSessions(userId, 'password_changed');

    await this.audit({
      userId,
      action: AuditAction.PASSWORD_RESET,
      resourceType: 'user',
      resourceId: userId,
      success: true,
      ctx,
    });

    logger.info('Password changed', { userId });
  }

  // ── Forgot password — issue reset token ────────────────────────────────────

  async forgotPassword(email: string, ctx: RequestContext): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()],
    );

    // Always return success to prevent email enumeration
    if (rows.length === 0) return null;

    const userId = rows[0].id;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash  = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hash in a simple way using last_login_ua as temp storage (dev only)
    // In production: use a dedicated password_reset_tokens table
    await pool.query(
      `UPDATE users
       SET last_login_ua = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ resetTokenHash: resetHash, resetTokenExpiry: expiresAt.toISOString() }), userId],
    );

    await this.audit({
      userId,
      action: AuditAction.PASSWORD_RESET,
      resourceType: 'user',
      resourceId: userId,
      success: true,
      ctx,
      metadata: { step: 'token_issued' },
    });

    logger.info('Password reset token issued', { userId });
    return resetToken; // caller sends this via email
  }

  // ── Reset password with token ───────────────────────────────────────────────

  async resetPassword(
    resetToken: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    this.assertPasswordStrength(newPassword);

    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const { rows } = await pool.query(
      `SELECT id, last_login_ua FROM users
       WHERE deleted_at IS NULL`,
    );

    const user = rows.find(r => {
      try {
        const meta = JSON.parse(r.last_login_ua ?? '{}');
        return meta.resetTokenHash === resetHash;
      } catch { return false; }
    });

    if (!user) throw new TokenInvalidError('Reset token is invalid');

    const meta = JSON.parse(user.last_login_ua ?? '{}');
    const expiry = new Date(meta.resetTokenExpiry ?? 0);
    if (expiry < new Date()) throw new TokenInvalidError('Reset token has expired');

    const newHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           last_login_ua = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newHash, user.id],
    );

    await tokenService.revokeAllUserSessions(user.id, 'password_reset');

    await this.audit({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET,
      resourceType: 'user',
      resourceId: user.id,
      success: true,
      ctx,
      metadata: { step: 'password_reset' },
    });

    logger.info('Password reset completed', { userId: user.id });
  }

  // ── Get current user ────────────────────────────────────────────────────────

  async getMe(userId: string): Promise<SafeUser> {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, status,
              email_verified, last_login_at, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundError('User not found');
    return this.mapUser(rows[0]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private assertPasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }
  }

  private mapUser(row: Record<string, unknown>): SafeUser {
    return {
      id:            row.id as string,
      email:         row.email as string,
      firstName:     row.first_name as string,
      lastName:      row.last_name as string,
      role:          row.role as UserRole,
      status:        row.status as UserStatus,
      emailVerified: row.email_verified as boolean,
      lastLoginAt:   row.last_login_at as Date | null,
      createdAt:     row.created_at as Date,
    };
  }

  private async audit(params: {
    userId: string | null;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    success: boolean;
    ctx: RequestContext;
    metadata?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs
           (id, user_id, action, resource_type, resource_id,
            ip_address, user_agent, device_id, success, error_message, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          uuidv4(),
          params.userId,
          params.action,
          params.resourceType,
          params.resourceId ?? null,
          params.ctx.ip,
          params.ctx.userAgent,
          params.ctx.deviceId ?? null,
          params.success,
          params.errorMessage ?? null,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
    } catch (err) {
      // Audit failure must never break the main flow
      logger.error('Audit log write failed', { error: (err as Error).message });
    }
  }
}

export const authService = new AuthService();
