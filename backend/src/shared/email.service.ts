/**
 * EmailService — sends emails via SMTP (nodemailer) or SendGrid.
 *
 * Configuration via environment variables:
 *   EMAIL_PROVIDER=smtp|sendgrid
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD  (SMTP)
 *   EMAIL_FROM
 *
 * If not configured, logs a warning and silently skips — never crashes the app.
 */

import logger from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private configured = false;
  private transporter: any = null;

  constructor() {
    this.init();
  }

  private init() {
    const provider = process.env.EMAIL_PROVIDER || 'smtp';
    const host     = process.env.EMAIL_HOST || '';
    const user     = process.env.EMAIL_USER || '';
    const password = process.env.EMAIL_PASSWORD || '';

    if (!host || !user || !password) {
      logger.warn('[EmailService] Not configured — EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD are required. Emails will be skipped.');
      return;
    }

    try {
      // Dynamic require so the app starts even if nodemailer is not installed
      const nodemailer = require('nodemailer');

      if (provider === 'sendgrid') {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: { user: 'apikey', pass: process.env.EMAIL_PASSWORD },
        });
      } else {
        // Default: SMTP
        this.transporter = nodemailer.createTransport({
          host,
          port: parseInt(process.env.EMAIL_PORT || '587', 10),
          secure: parseInt(process.env.EMAIL_PORT || '587', 10) === 465,
          auth: { user, pass: password },
        });
      }

      this.configured = true;
      logger.info(`[EmailService] Configured with provider: ${provider}`);
    } catch (err) {
      logger.warn('[EmailService] nodemailer not installed — run: npm install nodemailer. Emails will be skipped.');
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    if (!this.configured || !this.transporter) {
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[EmailService] SKIPPED (not configured) — To: ${options.to}, Subject: ${options.subject}`);
      }
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@attendance.edu',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text.replace(/\n/g, '<br>'),
      });
      logger.info(`[EmailService] Sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (err) {
      logger.error(`[EmailService] Failed to send to ${options.to}:`, err);
      return false;
    }
  }

  /**
   * Send attendance notification to parent.
   */
  async sendAttendanceNotification(params: {
    parentEmail: string;
    studentName: string;
    rollNumber: string;
    subject: string;
    dateTime: string;
    status: 'present' | 'late' | 'absent';
    location: string;
  }): Promise<boolean> {
    const statusEmoji = params.status === 'present' ? '✅' : params.status === 'late' ? '⏰' : '❌';
    const statusText  = params.status === 'present' ? 'Present' : params.status === 'late' ? 'Late' : 'Absent';

    const text = [
      `Attendance Notification — Greenfield University`,
      ``,
      `Student: ${params.studentName}`,
      `Roll No: ${params.rollNumber}`,
      `Subject: ${params.subject}`,
      `Date/Time: ${params.dateTime}`,
      `Status: ${statusEmoji} ${statusText}`,
      `Location: ${params.location}`,
      ``,
      `This is an automated notification from the Smart Attendance System.`,
    ].join('\n');

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1f2937;margin-bottom:4px;">Attendance Notification</h2>
        <p style="color:#6b7280;font-size:14px;margin-top:0;">Greenfield University Smart Attendance System</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:100px;">Student</td><td style="padding:6px 0;font-weight:600;">${params.studentName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Roll No</td><td style="padding:6px 0;">${params.rollNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;">${params.subject}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Date/Time</td><td style="padding:6px 0;">${params.dateTime}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Status</td><td style="padding:6px 0;font-weight:600;color:${params.status === 'present' ? '#10b981' : params.status === 'late' ? '#f59e0b' : '#ef4444'};">${statusEmoji} ${statusText}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;">${params.location}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated message. Please do not reply.</p>
      </div>
    `;

    return this.send({
      to: params.parentEmail,
      subject: `${statusEmoji} Attendance: ${params.studentName} — ${params.subject}`,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
