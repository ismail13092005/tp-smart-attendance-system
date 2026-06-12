import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import { AuditAction } from '../../shared/types';
import logger from '../../shared/logger';

interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  ip?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

export class AuditService {
  async getLogs(params: { limit: number; offset: number }): Promise<{ logs: unknown[]; total: number }> {
    const [logsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [params.limit, params.offset],
      ),
      pool.query(`SELECT COUNT(*) FROM audit_logs`),
    ]);
    return {
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs
           (id, user_id, action, resource_type, resource_id,
            ip_address, user_agent, device_id,
            metadata, success, error_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          uuidv4(),
          params.userId ?? null,
          params.action,
          params.resource ?? null,
          params.resourceId ?? null,
          params.ip ?? params.ipAddress ?? null,
          params.userAgent ?? null,
          params.deviceId ?? null,
          JSON.stringify(params.metadata ?? {}),
          params.success,
          params.errorMessage ?? null,
        ],
      );
    } catch (err) {
      // Audit logging must never break the main flow
      logger.error('Failed to create audit log:', err);
    }
  }
}
