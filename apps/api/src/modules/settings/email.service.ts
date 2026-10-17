import nodemailer from 'nodemailer';
import { type EmailSettingsDTO } from '@newtonite/shared';
import { settingsService } from './settings.service';
import { logger } from '../../shared/logger/logger';

export class EmailService {
  /**
   * Builds a nodemailer transport based on provided or stored SMTP configuration.
   */
  private createTransport(config: EmailSettingsDTO) {
    if (!config.smtpHost) {
      throw new Error('SMTP host is not configured');
    }

    // In isolated automated tests, use a jsonTransport or streamTransport if targeted at test host
    if (
      config.smtpHost === 'test.smtp.local' ||
      (process.env.NODE_ENV === 'test' && !config.smtpUser)
    ) {
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword || '',
          }
        : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
    });
  }

  /**
   * Tests the SMTP connection parameters using verify().
   */
  async testConnection(actorId?: string): Promise<{ success: boolean; message: string }> {
    const config = await settingsService.getSettings<EmailSettingsDTO>('email');

    if (!config.smtpHost) {
      return { success: false, message: 'SMTP is not configured (missing host)' };
    }

    try {
      const transporter = this.createTransport(config);
      await transporter.verify();

      // Record successful test
      await settingsService.updateSettings<EmailSettingsDTO>(
        'email',
        {
          lastTestResult: 'SUCCESS',
          lastTestedAt: new Date().toISOString(),
          lastTestError: null,
        },
        actorId
      );

      return { success: true, message: 'SMTP connection established successfully' };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`[EmailService] SMTP verification failed: ${errMsg}`, {
        host: config.smtpHost,
        port: config.smtpPort,
      });

      // Record failure
      await settingsService.updateSettings<EmailSettingsDTO>(
        'email',
        {
          lastTestResult: 'FAILED',
          lastTestedAt: new Date().toISOString(),
          lastTestError: errMsg,
        },
        actorId
      );

      return { success: false, message: `SMTP connection failed: ${errMsg}` };
    }
  }

  /**
   * Sends an actual test email message to verify end-to-end delivery capability.
   */
  async sendTestEmail(
    recipientEmail: string,
    actorId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const config = await settingsService.getSettings<EmailSettingsDTO>('email');

    if (!config.smtpHost) {
      return { success: false, error: 'SMTP is not configured' };
    }

    try {
      const transporter = this.createTransport(config);
      const sender = config.senderEmail
        ? `"${config.senderName}" <${config.senderEmail}>`
        : `"${config.senderName}" <no-reply@newtonite.dev>`;

      const info = await transporter.sendMail({
        from: sender,
        to: recipientEmail,
        subject: 'Newtonite Ops — System Email Configuration Test',
        text: `Hello,\n\nThis is a verified test email sent from Newtonite Ops Settings & Configuration Center at ${new Date().toISOString()}.\n\nYour outbound email delivery transport is functioning properly.\n\nRegards,\nNewtonite Operations Platform`,
        html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Newtonite Ops — Email Configuration Verified</h2>
          <p>This is a verified test email sent from the <strong>Newtonite Ops Settings & Configuration Center</strong>.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Status:</strong> Transport verified and operational.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Newtonite Operations Under Pressure — High Reliability Core Operations</p>
        </div>`,
      });

      // Record success
      await settingsService.updateSettings<EmailSettingsDTO>(
        'email',
        {
          lastTestResult: 'SUCCESS',
          lastTestedAt: new Date().toISOString(),
          lastTestError: null,
        },
        actorId
      );

      logger.info('[EmailService] Test email dispatched successfully', {
        recipient: recipientEmail,
        messageId: info.messageId,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[EmailService] Failed to send test email: ${errMsg}`, {
        recipient: recipientEmail,
      });

      await settingsService.updateSettings<EmailSettingsDTO>(
        'email',
        {
          lastTestResult: 'FAILED',
          lastTestedAt: new Date().toISOString(),
          lastTestError: errMsg,
        },
        actorId
      );

      return { success: false, error: errMsg };
    }
  }
}

export const emailService = new EmailService();
