/**
 * TokenService
 *
 * Responsibilities:
 *  - Sign access tokens (15 min, contains sessionId + jti)
 *  - Sign refresh tokens (7 days, contains sessionId + jti)
 *  - Verify both token types
 *  - Persist device_sessions rows (refresh token stored as SHA-256 hash)
 *  - Rotate refresh tokens on use (old token invalidated, new one issued)
 *  - Revoke individual sessions or all sessions for a user
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import config from '../../config';
import logger from '../../shared/logger';
import {
  JWTPayload,
  RefreshTokenPayload,
  UserRole,
  RequestContext,
} from '../../shared/types';
import {
  TokenExpiredError,
  TokenInvalidError,
  UnauthorizedError,
} from '../../shared/errors';

const sha256 = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
}

export interface SessionRow {
  id: string;
  user_id: string;
  platform: string;
  device_name: string | null;
  device_id: string | null;
  ip_address: string;
  user_agent: string | null;
  is_active: boolean;
  last_active_at: Date;
  expires_at: Date;
  created_at: Date;
}

export class TokenService {
  // ── Issue a brand-new token pair ────────────────────────────────────────────

  async issueTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const sessionId = uuidv4();
    const accessJti  = uuidv4();
    const refreshJti = uuidv4();

    const accessToken  = this.signAccess(userId, email, role, sessionId, accessJti);
    const refreshToken = this.signRefresh(userId, sessionId, refreshJti);

    const refreshExpirySecs = this.parseDurationToSeconds(config.jwt.refreshExpiry);
    const expiresAt = new Date(Date.now() + refreshExpirySecs * 1000);

    // Persist session row (refresh token stored as hash only)
    await pool.query(
      `INSERT INTO device_sessions
         (id, user_id, refresh_token_hash, access_token_jti,
          platform, device_name, device_id,
          ip_address, user_agent,
          is_active, last_active_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NOW(),$10)`,
      [
        sessionId,
        userId,
        sha256(refreshToken),
        accessJti,
        ctx.platform ?? 'web',
        this.parseDeviceName(ctx.userAgent),
        ctx.deviceId ?? null,
        ctx.ip,
        ctx.userAgent,
        expiresAt,
      ],
    );

    logger.debug('Token pair issued', { userId, sessionId });
    return { accessToken, refreshToken, sessionId, expiresAt };
  }

  // ── Rotate refresh token ────────────────────────────────────────────────────

  async rotateRefreshToken(
    incomingRefreshToken: string,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    // 1. Verify JWT signature + expiry
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(
        incomingRefreshToken,
        config.jwt.refreshSecret,
      ) as RefreshTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new TokenExpiredError();
      throw new TokenInvalidError();
    }

    const tokenHash = sha256(incomingRefreshToken);

    // 2. Look up session by hash
    const { rows } = await pool.query<SessionRow>(
      `SELECT * FROM device_sessions
       WHERE refresh_token_hash = $1 AND is_active = TRUE`,
      [tokenHash],
    );

    if (rows.length === 0) {
      // Token reuse detected — revoke entire session family
      logger.warn('Refresh token reuse detected', {
        userId: payload.sub,
        sessionId: payload.sessionId,
      });
      await this.revokeSession(payload.sessionId, 'token_reuse_detected');
      throw new TokenInvalidError('Refresh token already used');
    }

    const session = rows[0];

    // 3. Validate session matches payload
    if (session.id !== payload.sessionId || session.user_id !== payload.sub) {
      throw new TokenInvalidError();
    }

    // 4. Fetch user to get current role (role may have changed)
    const { rows: userRows } = await pool.query(
      `SELECT id, email, role, status FROM users WHERE id = $1`,
      [payload.sub],
    );
    if (userRows.length === 0 || userRows[0].status !== 'active') {
      throw new UnauthorizedError('Account not active');
    }
    const user = userRows[0];

    // 5. Issue new token pair (new JTIs, same sessionId)
    const newAccessJti  = uuidv4();
    const newRefreshJti = uuidv4();
    const newAccessToken  = this.signAccess(user.id, user.email, user.role, session.id, newAccessJti);
    const newRefreshToken = this.signRefresh(user.id, session.id, newRefreshJti);

    const refreshExpirySecs = this.parseDurationToSeconds(config.jwt.refreshExpiry);
    const expiresAt = new Date(Date.now() + refreshExpirySecs * 1000);

    // 6. Atomically swap the hash (old token is now invalid)
    await pool.query(
      `UPDATE device_sessions
       SET refresh_token_hash = $1,
           access_token_jti   = $2,
           last_active_at     = NOW(),
           expires_at         = $3,
           ip_address         = $4,
           user_agent         = $5
       WHERE id = $6`,
      [
        sha256(newRefreshToken),
        newAccessJti,
        expiresAt,
        ctx.ip,
        ctx.userAgent,
        session.id,
      ],
    );

    logger.debug('Refresh token rotated', { userId: user.id, sessionId: session.id });
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: session.id,
      expiresAt,
    };
  }

  // ── Verify access token ─────────────────────────────────────────────────────

  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw new TokenExpiredError();
      throw new TokenInvalidError();
    }
  }

  // ── Revoke a single session ─────────────────────────────────────────────────

  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    await pool.query(
      `UPDATE device_sessions
       SET is_active = FALSE, revoked_at = NOW(), revoke_reason = $1
       WHERE id = $2`,
      [reason, sessionId],
    );
  }

  // ── Revoke all sessions for a user (e.g. password reset) ───────────────────

  async revokeAllUserSessions(userId: string, reason = 'password_reset'): Promise<void> {
    await pool.query(
      `UPDATE device_sessions
       SET is_active = FALSE, revoked_at = NOW(), revoke_reason = $1
       WHERE user_id = $2 AND is_active = TRUE`,
      [reason, userId],
    );
  }

  // ── List active sessions for a user ────────────────────────────────────────

  async listActiveSessions(userId: string): Promise<SessionRow[]> {
    const { rows } = await pool.query<SessionRow>(
      `SELECT id, user_id, platform, device_name, device_id,
              ip_address, user_agent, is_active, last_active_at, expires_at, created_at
       FROM device_sessions
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY last_active_at DESC`,
      [userId],
    );
    return rows;
  }

  // ── Validate that a session is still active (used in authenticate middleware)

  async isSessionActive(sessionId: string, accessJti: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM device_sessions
       WHERE id = $1 AND access_token_jti = $2 AND is_active = TRUE`,
      [sessionId, accessJti],
    );
    return rows.length > 0;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private signAccess(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string,
    jti: string,
  ): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      sessionId,
      jti,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiry,
    } as jwt.SignOptions);
  }

  private signRefresh(userId: string, sessionId: string, jti: string): string {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      sessionId,
      jti,
    };
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiry,
    } as jwt.SignOptions);
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600; // default 7d
    const value = parseInt(match[1], 10);
    const unit  = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }

  private parseDeviceName(ua?: string): string | null {
    if (!ua) return null;
    if (ua.includes('Chrome'))  return 'Chrome Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('Safari'))  return 'Safari Browser';
    if (ua.includes('Mobile'))  return 'Mobile Browser';
    return 'Unknown Browser';
  }
}

export const tokenService = new TokenService();
