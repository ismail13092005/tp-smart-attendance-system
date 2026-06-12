/**
 * UsersService
 *
 * Admin/self user management — list, read, update, deactivate.
 * All mutations write audit logs.
 */

import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import { tokenService } from '../auth/token.service';
import logger from '../../shared/logger';
import { AuditAction, UserRole, UserStatus, RequestContext } from '../../shared/types';
import { NotFoundError, ForbiddenError } from '../../shared/errors';
import type { SafeUser } from '../auth/auth.service';

export interface UserListFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserListResult {
  users: SafeUser[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export class UsersService {

  async list(filters: UserListFilters): Promise<UserListResult> {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let p = 1;

    if (filters.role) {
      conditions.push(`role = $${p++}`);
      params.push(filters.role);
    }
    if (filters.status) {
      conditions.push(`status = $${p++}`);
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push(
        `(email ILIKE $${p} OR first_name ILIKE $${p} OR last_name ILIKE $${p})`,
      );
      params.push(`%${filters.search}%`);
      p++;
    }

    const where = conditions.join(' AND ');

    const [{ rows: countRows }, { rows }] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE ${where}`, params),
      pool.query(
        `SELECT id, email, first_name, last_name, role, status,
                email_verified, last_login_at, created_at
         FROM users WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset],
      ),
    ]);

    return {
      users: rows.map(this.mapUser),
      total: parseInt(countRows[0].count, 10),
      page,
      limit,
    };
  }

  async getById(userId: string): Promise<SafeUser> {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, status,
              email_verified, last_login_at, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (rows.length === 0) throw new NotFoundError('User not found');
    return this.mapUser(rows[0]);
  }

  async updateSelf(
    userId: string,
    input: UpdateUserInput,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let p = 1;

    if (input.firstName) { sets.push(`first_name = $${p++}`); params.push(input.firstName.trim()); }
    if (input.lastName)  { sets.push(`last_name  = $${p++}`); params.push(input.lastName.trim()); }
    if (input.phone)     { sets.push(`phone      = $${p++}`); params.push(input.phone.trim()); }

    if (sets.length === 1) throw new NotFoundError('No fields to update');

    params.push(userId);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${p} AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, role, status,
                 email_verified, last_login_at, created_at`,
      params,
    );
    if (rows.length === 0) throw new NotFoundError('User not found');

    await this.audit({
      userId,
      action: AuditAction.PROFILE_UPDATE,
      resourceId: userId,
      success: true,
      ctx,
      metadata: { fields: Object.keys(input) },
    });

    return this.mapUser(rows[0]);
  }

  async adminUpdateUser(
    targetUserId: string,
    input: UpdateUserInput & { status?: UserStatus },
    actorId: string,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let p = 1;

    if (input.firstName) { sets.push(`first_name = $${p++}`); params.push(input.firstName.trim()); }
    if (input.lastName)  { sets.push(`last_name  = $${p++}`); params.push(input.lastName.trim()); }
    if (input.phone)     { sets.push(`phone      = $${p++}`); params.push(input.phone.trim()); }
    if (input.status)    { sets.push(`status     = $${p++}`); params.push(input.status); }

    params.push(targetUserId);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${p} AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, role, status,
                 email_verified, last_login_at, created_at`,
      params,
    );
    if (rows.length === 0) throw new NotFoundError('User not found');

    await this.audit({
      userId: actorId,
      action: AuditAction.USER_UPDATED,
      resourceId: targetUserId,
      success: true,
      ctx,
      metadata: { fields: Object.keys(input), targetUserId },
    });

    return this.mapUser(rows[0]);
  }

  async deactivate(
    targetUserId: string,
    actorId: string,
    ctx: RequestContext,
  ): Promise<void> {
    if (targetUserId === actorId) {
      throw new ForbiddenError('Cannot deactivate your own account');
    }

    const { rowCount } = await pool.query(
      `UPDATE users SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [targetUserId],
    );
    if (!rowCount) throw new NotFoundError('User not found');

    // Revoke all sessions
    await tokenService.revokeAllUserSessions(targetUserId, 'admin_deactivated');

    await this.audit({
      userId: actorId,
      action: AuditAction.USER_DEACTIVATED,
      resourceId: targetUserId,
      success: true,
      ctx,
    });

    logger.info('User deactivated', { targetUserId, actorId });
  }

  async changeRole(
    targetUserId: string,
    newRole: UserRole,
    actorId: string,
    ctx: RequestContext,
  ): Promise<SafeUser> {
    if (targetUserId === actorId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const { rows } = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, role, status,
                 email_verified, last_login_at, created_at`,
      [newRole, targetUserId],
    );
    if (rows.length === 0) throw new NotFoundError('User not found');

    // Force re-login so new role is reflected in tokens
    await tokenService.revokeAllUserSessions(targetUserId, 'role_changed');

    await this.audit({
      userId: actorId,
      action: AuditAction.ROLE_CHANGED,
      resourceId: targetUserId,
      success: true,
      ctx,
      metadata: { newRole },
    });

    return this.mapUser(rows[0]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

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
    userId: string;
    action: AuditAction;
    resourceId?: string;
    success: boolean;
    ctx: RequestContext;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs
           (id, user_id, action, resource_type, resource_id,
            ip_address, user_agent, success, metadata)
         VALUES ($1,$2,$3,'user',$4,$5,$6,$7,$8)`,
        [
          uuidv4(),
          params.userId,
          params.action,
          params.resourceId ?? null,
          params.ctx.ip,
          params.ctx.userAgent,
          params.success,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
    } catch (err) {
      logger.error('Audit log write failed', { error: (err as Error).message });
    }
  }
}

export const usersService = new UsersService();
