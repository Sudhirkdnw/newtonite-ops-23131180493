import { prisma } from '../../shared/database/prisma';
import {
  type SettingsCategory,
  type GeneralSettingsDTO,
  type BrandingSettingsDTO,
  type EmailSettingsDTO,
  type SlaSettingsDTO,
  type WorkflowSettingsDTO,
  type SecuritySettingsDTO,
  type NotificationSettingsDTO,
  type AiSettingsDTO,
  DEFAULT_NEWTONITE_LOGO,
} from '@newtonite/shared';
import { logger } from '../../shared/logger/logger';
import type { Prisma } from '@prisma/client';

export const DEFAULT_SETTINGS = {
  general: {
    appName: 'Newtonite Ops',
    orgName: 'Newtonite Technologies Inc.',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    supportContact: 'support@newtonite.dev',
    maintenanceMode: false,
  } as GeneralSettingsDTO,

  branding: {
    appName: 'Newtonite Ops',
    logoUrl: DEFAULT_NEWTONITE_LOGO,
    faviconUrl: null,
    browserTitle: 'Newtonite Ops — Operations Under Pressure',
    primaryColor: '#2563eb',
    accentColor: '#1d4ed8',
    themeDefault: 'light',
    sidebarTheme: 'light',
  } as BrandingSettingsDTO,

  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: false,
    senderName: 'Newtonite Alerts',
    senderEmail: '',
    enabled: false,
    lastTestResult: 'NONE',
    lastTestedAt: null,
    lastTestError: null,
  } as EmailSettingsDTO,

  sla: {
    durations: {
      CRITICAL: 120, // 2h in minutes
      URGENT: 360, // 6h
      HIGH: 1440, // 24h
      MEDIUM: 4320, // 72h
      LOW: 10080, // 168h
    },
    warningBufferPercent: 25,
    scanIntervalMinutes: 5,
    escalationProcessingEnabled: true,
  } as SlaSettingsDTO,

  workflow: {
    defaultPriority: 'MEDIUM',
    defaultType: 'TASK',
    allowViewerComments: true,
    requireDueDateForCritical: false,
  } as WorkflowSettingsDTO,

  security: {
    sessionTimeoutMinutes: 60,
    minPasswordLength: 8,
    requireSpecialChar: true,
    requireNumber: true,
  } as SecuritySettingsDTO,

  notification: {
    emailNotificationsEnabled: false,
    notifyOnEscalation: true,
    notifyOnAssignment: true,
    notifyOnApproval: true,
  } as NotificationSettingsDTO,

  ai: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    apiKey: '',
    enabled: true,
    temperature: 0.2,
    maxTokens: 1024,
    systemPrompt: '',
  } as AiSettingsDTO,
};

export class SettingsService {
  // In-memory cache for ultra-fast reading by active application modules
  private cache = new Map<string, unknown>();

  /**
   * Retrieves typed settings by category, merging with defaults if not yet customized.
   */
  async getSettings<T>(category: SettingsCategory): Promise<T> {
    if (this.cache.has(category)) {
      return this.cache.get(category) as T;
    }

    const defaultVal = DEFAULT_SETTINGS[category as keyof typeof DEFAULT_SETTINGS] as T;

    try {
      const record = await prisma.systemSetting.findUnique({
        where: { key: category },
      });

      if (!record || !record.value) {
        this.cache.set(category, defaultVal);
        return defaultVal;
      }

      const merged = { ...defaultVal, ...(record.value as object) } as T;
      this.cache.set(category, merged);
      return merged;
    } catch {
      logger.warn('[SettingsService] Failed to load setting from DB, using defaults', { category });
      return defaultVal;
    }
  }

  /**
   * Public-facing branding settings for login page and initial app boot.
   */
  async getPublicBranding(): Promise<BrandingSettingsDTO> {
    return this.getSettings<BrandingSettingsDTO>('branding');
  }

  /**
   * Safe getter for email settings that masks the stored password before returning to client.
   */
  async getEmailSettingsSafe(): Promise<EmailSettingsDTO> {
    const raw = await this.getSettings<EmailSettingsDTO>('email');
    return {
      ...raw,
      smtpPassword: raw.smtpPassword ? '••••••••' : '',
    };
  }

  /**
   * Safe getter for AI configuration that masks the stored apiKey before returning to client.
   */
  async getAiSettingsSafe(): Promise<AiSettingsDTO> {
    const raw = await this.getSettings<AiSettingsDTO>('ai');
    return {
      ...raw,
      apiKey: raw.apiKey ? '••••••••' : '',
    };
  }

  /**
   * Updates settings transactionally, creates an append-only audit event with redacted secrets,
   * and immediately refreshes cache.
   */
  async updateSettings<T extends Record<string, unknown>>(
    category: SettingsCategory,
    updates: Partial<T>,
    actorId?: string
  ): Promise<T> {
    const current = await this.getSettings<T>(category);

    // If updating email, handle password preservation:
    // If incoming password is empty string, undefined, or masked '••••••••', keep existing stored password.
    const merged = { ...current, ...updates };
    if (category === 'email') {
      const currentEmail = current as unknown as EmailSettingsDTO;
      const updateEmail = updates as unknown as Partial<EmailSettingsDTO>;
      if (!updateEmail.smtpPassword || updateEmail.smtpPassword === '••••••••') {
        (merged as unknown as EmailSettingsDTO).smtpPassword = currentEmail.smtpPassword;
      }
    }

    // If updating AI, handle apiKey preservation:
    // If incoming apiKey is empty string, undefined, or masked '••••••••', keep existing stored apiKey.
    if (category === 'ai') {
      const currentAi = current as unknown as AiSettingsDTO;
      const updateAi = updates as unknown as Partial<AiSettingsDTO>;
      if (!updateAi.apiKey || updateAi.apiKey === '••••••••') {
        (merged as unknown as AiSettingsDTO).apiKey = currentAi.apiKey;
      }
    }

    // If updating branding, handle logo preservation:
    // If incoming logoUrl is empty string, null, or undefined, preserve existing stored logo.
    if (category === 'branding') {
      const currentBranding = current as unknown as BrandingSettingsDTO;
      const updateBranding = updates as unknown as Partial<BrandingSettingsDTO>;
      if (!updateBranding.logoUrl) {
        (merged as unknown as BrandingSettingsDTO).logoUrl =
          currentBranding.logoUrl || DEFAULT_NEWTONITE_LOGO;
      }
    }

    // Prepare safe before/after diff for audit log (strip or mask secrets)
    const redactSecrets = (obj: Record<string, unknown>): Record<string, unknown> => {
      const clone = { ...obj };
      if ('smtpPassword' in clone && clone.smtpPassword) {
        clone.smtpPassword = '••••••••';
      }
      if ('apiKey' in clone && clone.apiKey) {
        clone.apiKey = '••••••••';
      }
      if ('logoUrl' in clone && typeof clone.logoUrl === 'string' && clone.logoUrl.length > 80) {
        clone.logoUrl = `[BASE64_IMAGE_${clone.logoUrl.length}_CHARS]`;
      }
      return clone;
    };

    const beforeRedacted = redactSecrets(current as Record<string, unknown>);
    const afterRedacted = redactSecrets(merged as Record<string, unknown>);

    await prisma.$transaction(async (tx) => {
      // 1. Upsert setting
      await tx.systemSetting.upsert({
        where: { key: category },
        update: {
          value: merged as unknown as Prisma.InputJsonValue,
          updatedBy: actorId || null,
        },
        create: {
          category,
          key: category,
          value: merged as unknown as Prisma.InputJsonValue,
          updatedBy: actorId || null,
        },
      });

      // 2. Append-only audit event
      await tx.settingAuditEvent.create({
        data: {
          category,
          action: 'UPDATED',
          actorId: actorId || null,
          diff: {
            before: beforeRedacted,
            after: afterRedacted,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // Invalidate cache immediately
    this.cache.set(category, merged);
    logger.info('[SettingsService] Configuration updated and audited', {
      category,
      actorId,
    });

    return merged as T;
  }

  /**
   * Checks if maintenance mode is enabled in General settings.
   */
  async isMaintenanceMode(): Promise<boolean> {
    const general = await this.getSettings<GeneralSettingsDTO>('general');
    return general.maintenanceMode === true;
  }

  /**
   * Invalidate all in-memory caches (useful in tests).
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const settingsService = new SettingsService();
