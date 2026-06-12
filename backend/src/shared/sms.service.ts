/**
 * SMSService — sends SMS via Twilio.
 *
 * Configuration via environment variables:
 *   SMS_PROVIDER=twilio
 *   SMS_API_KEY=<Twilio Account SID>
 *   SMS_API_SECRET=<Twilio Auth Token>
 *   SMS_FROM_NUMBER=<Twilio phone number e.g. +15551234567>
 *
 * If not configured, logs a warning and silently skips — never crashes the app.
 */

import logger from './logger';

class SMSService {
  private configured = false;
  private client: any = null;
  private fromNumber = '';

  constructor() {
    this.init();
  }

  private init() {
    const provider   = process.env.SMS_PROVIDER || '';
    const accountSid = process.env.SMS_API_KEY || '';
    const authToken  = process.env.SMS_API_SECRET || '';
    this.fromNumber  = process.env.SMS_FROM_NUMBER || '';

    if (!provider || !accountSid || !authToken || !this.fromNumber) {
      logger.warn('[SMSService] Not configured — SMS_PROVIDER, SMS_API_KEY, SMS_API_SECRET, SMS_FROM_NUMBER are required. SMS will be skipped.');
      return;
    }

    try {
      if (provider === 'twilio') {
        const twilio = require('twilio');
        this.client = twilio(accountSid, authToken);
        this.configured = true;
        logger.info('[SMSService] Configured with Twilio');
      } else {
        logger.warn(`[SMSService] Unknown provider "${provider}". Only "twilio" is supported.`);
      }
    } catch {
      logger.warn('[SMSService] twilio package not installed — run: npm install twilio. SMS will be skipped.');
    }
  }

  async send(to: string, message: string): Promise<boolean> {
    if (!this.configured || !this.client) {
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[SMSService] SKIPPED (not configured) — To: ${to}, Message: ${message.substring(0, 50)}...`);
      }
      return false;
    }

    try {
      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to,
      });
      logger.info(`[SMSService] Sent to ${to}`);
      return true;
    } catch (err) {
      logger.error(`[SMSService] Failed to send to ${to}:`, err);
      return false;
    }
  }

  /**
   * Send attendance notification SMS to parent.
   */
  async sendAttendanceNotification(params: {
    parentPhone: string;
    studentName: string;
    rollNumber: string;
    subject: string;
    dateTime: string;
    status: 'present' | 'late' | 'absent';
  }): Promise<boolean> {
    const statusEmoji = params.status === 'present' ? '✅' : params.status === 'late' ? '⏰' : '❌';
    const statusText  = params.status === 'present' ? 'Present' : params.status === 'late' ? 'Late' : 'Absent';

    const message = `${statusEmoji} Attendance Alert\nStudent: ${params.studentName} (${params.rollNumber})\nSubject: ${params.subject}\nTime: ${params.dateTime}\nStatus: ${statusText}\n- Greenfield University`;

    return this.send(params.parentPhone, message);
  }
}

export const smsService = new SMSService();
