import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { QRPayload } from '../../shared/types';
import { ValidationError, NotFoundError } from '../../shared/errors';
import config from '../../config';
import logger from '../../shared/logger';
import pool from '../../database/pool';

export class QRService {
  /**
   * Generate a new QR code for a session
   */
  async generateQRCode(sessionId: string, facultyId: string): Promise<{
    qrCodeDataURL: string;
    token: string;
    expiresAt: Date;
  }> {
    const { rows } = await pool.query(
      `SELECT id, faculty_user_id FROM faculty_sessions WHERE id = $1 AND deleted_at IS NULL`,
      [sessionId],
    );
    if (!rows[0]) throw new NotFoundError('Session not found');
    if (rows[0].faculty_user_id !== facultyId) throw new ValidationError('Unauthorized to generate QR for this session');

    const nonce = uuidv4();
    const payload: QRPayload = { sessionId, facultyId, timestamp: Date.now(), nonce };
    const token = jwt.sign(payload, config.qr.signingSecret, {
      expiresIn: `${config.qr.expiryMinutes}m`,
    } as jwt.SignOptions);

    const expiresAt = new Date(Date.now() + config.qr.expiryMinutes * 60 * 1000);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Revoke previous active QR for this session
    await pool.query(
      `UPDATE dynamic_qr_sessions SET status='revoked', revoked_at=NOW(), revoke_reason='refreshed'
       WHERE faculty_session_id=$1 AND status='active'`,
      [sessionId],
    );

    // Insert new QR record
    await pool.query(
      `INSERT INTO dynamic_qr_sessions
         (id, faculty_session_id, faculty_user_id, token, token_hash, nonce, status, issued_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6::uuid,'active',NOW(),$7)`,
      [uuidv4(), sessionId, facultyId, token, tokenHash, nonce, expiresAt],
    );

    const qrCodeDataURL = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'H', width: 300, margin: 2,
    });

    logger.info(`QR code generated for session: ${sessionId}`);
    return { qrCodeDataURL, token, expiresAt };
  }

  /**
   * Verify a scanned QR token against dynamic_qr_sessions table
   */
  async verifyQRToken(token: string): Promise<{
    valid: boolean;
    sessionId?: string;
    facultyId?: string;
    reason?: string;
  }> {
    try {
      // Verify JWT signature and expiration first
      const payload = jwt.verify(token, config.qr.signingSecret) as QRPayload;

      // Look up the token in dynamic_qr_sessions by hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const { rows } = await pool.query(
        `SELECT dqs.status, dqs.expires_at, dqs.faculty_session_id,
                fs.status AS session_status
         FROM dynamic_qr_sessions dqs
         JOIN faculty_sessions fs ON fs.id = dqs.faculty_session_id
         WHERE dqs.token_hash = $1 AND dqs.faculty_session_id = $2`,
        [tokenHash, payload.sessionId],
      );

      if (!rows[0]) {
        return { valid: false, reason: 'QR code not found or has been refreshed' };
      }

      const record = rows[0];

      if (record.session_status !== 'active') {
        return { valid: false, reason: 'Session is not active' };
      }

      if (record.status !== 'active') {
        return { valid: false, reason: 'QR code has been refreshed or revoked' };
      }

      if (new Date(record.expires_at) < new Date()) {
        return { valid: false, reason: 'QR code has expired' };
      }

      logger.info(`QR token verified for session: ${payload.sessionId}`);
      return { valid: true, sessionId: payload.sessionId, facultyId: payload.facultyId };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, reason: 'QR code has expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, reason: 'Invalid QR code' };
      }
      logger.error('QR verification error:', error);
      return { valid: false, reason: 'QR verification failed' };
    }
  }

  /**
   * Refresh QR code for a session (invalidates previous one)
   */
  async refreshQRCode(sessionId: string, facultyId: string): Promise<{
    qrCodeDataURL: string;
    token: string;
    expiresAt: Date;
  }> {
    return this.generateQRCode(sessionId, facultyId);
  }

  /**
   * Check if a QR token is still valid without full verification
   */
  async isTokenValid(token: string): Promise<boolean> {
    const result = await this.verifyQRToken(token);
    return result.valid;
  }
}
