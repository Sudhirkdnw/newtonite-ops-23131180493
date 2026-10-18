import nodemailer from 'nodemailer';
import { type EmailSettingsDTO } from '@newtonite/shared';
import { settingsService } from './settings.service';
import { logger } from '../../shared/logger/logger';

export class EmailService {
  /**
   * Builds a nodemailer transport based on provided or stored SMTP configuration.
   */
  private createTransport(config: EmailSettingsDTO, forceSecure?: boolean) {
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

    // RFC Standard: Port 465 is implicit TLS (secure: true); Port 587/25 use explicit STARTTLS (secure: false).
    // If port 587 is selected, secure must be false to avoid OpenSSL wrong version number errors.
    const isSecure =
      forceSecure !== undefined
        ? forceSecure
        : config.smtpPort === 465
          ? true
          : config.smtpPort === 587
            ? false
            : Boolean(config.smtpSecure);

    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: isSecure,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword || '',
          }
        : undefined,
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
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
      const rawErrMsg = err instanceof Error ? err.message : String(err);

      // If error was wrong version number (SSL on STARTTLS port 587), attempt fallback with secure: false
      if (
        (rawErrMsg.includes('wrong version number') || rawErrMsg.includes('SSL routines')) &&
        config.smtpPort === 587
      ) {
        try {
          const fallbackTransporter = this.createTransport(config, false);
          await fallbackTransporter.verify();

          await settingsService.updateSettings<EmailSettingsDTO>(
            'email',
            {
              smtpSecure: false,
              lastTestResult: 'SUCCESS',
              lastTestedAt: new Date().toISOString(),
              lastTestError: null,
            },
            actorId
          );

          return {
            success: true,
            message:
              'SMTP connection established successfully via STARTTLS (auto-adjusted TLS mode for port 587)',
          };
        } catch {
          // Fall through to error reporting below
        }
      }

      let userFacingError = rawErrMsg;
      if (
        rawErrMsg.includes('535') ||
        rawErrMsg.includes('BadCredentials') ||
        rawErrMsg.includes('Username and Password not accepted')
      ) {
        userFacingError +=
          ' — Note: For Gmail (smtp.gmail.com), you must use a 16-character Google App Password (not your Gmail account password). Create one at https://myaccount.google.com/apppasswords';
      }

      logger.warn(`[EmailService] SMTP verification failed: ${userFacingError}`, {
        host: config.smtpHost,
        port: config.smtpPort,
      });

      // Record failure
      await settingsService.updateSettings<EmailSettingsDTO>(
        'email',
        {
          lastTestResult: 'FAILED',
          lastTestedAt: new Date().toISOString(),
          lastTestError: userFacingError,
        },
        actorId
      );

      return { success: false, message: `SMTP connection failed: ${userFacingError}` };
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
