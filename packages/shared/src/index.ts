import { z } from 'zod';

// ==========================================
// Domain Enums & Literals
// ==========================================

export const WorkItemType = {
  INCIDENT: 'INCIDENT',
  CUSTOMER_ISSUE: 'CUSTOMER_ISSUE',
  PAYMENT: 'PAYMENT',
  COMPLIANCE: 'COMPLIANCE',
  TASK: 'TASK',
} as const;
export type WorkItemType = (typeof WorkItemType)[keyof typeof WorkItemType];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const WorkItemStatus = {
  BACKLOG: 'BACKLOG',
  TRIAGED: 'TRIAGED',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkItemStatus = (typeof WorkItemStatus)[keyof typeof WorkItemStatus];

export const TeamRole = {
  VIEWER: 'VIEWER',
  MEMBER: 'MEMBER',
  LEAD: 'LEAD',
  ADMIN: 'ADMIN',
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

export const SystemRole = {
  USER: 'USER',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const ActivityAction = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  CLAIMED: 'CLAIMED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  WORKFLOW_APPROVED: 'WORKFLOW_APPROVED',
  UPDATED: 'UPDATED',
  ESCALATED: 'ESCALATED',
} as const;
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

export const OutboxJobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER',
} as const;
export type OutboxJobStatus = (typeof OutboxJobStatus)[keyof typeof OutboxJobStatus];

// ==========================================
// Workflow State Transition Map
// ==========================================

export const ALLOWED_TRANSITIONS: Record<WorkItemStatus, readonly WorkItemStatus[]> = {
  BACKLOG: [WorkItemStatus.TRIAGED, WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED],
  TRIAGED: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED],
  IN_PROGRESS: [WorkItemStatus.BLOCKED, WorkItemStatus.IN_REVIEW, WorkItemStatus.CANCELLED],
  BLOCKED: [WorkItemStatus.IN_PROGRESS, WorkItemStatus.CANCELLED],
  IN_REVIEW: [WorkItemStatus.COMPLETED, WorkItemStatus.IN_PROGRESS],
  COMPLETED: [WorkItemStatus.IN_PROGRESS],
  CANCELLED: [WorkItemStatus.BACKLOG],
};

// ==========================================
// Service Level Agreement (SLA) Configuration & Types
// ==========================================

export const SlaStatus = {
  HEALTHY: 'HEALTHY',
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED',
  RESOLVED: 'RESOLVED',
} as const;
export type SlaStatus = (typeof SlaStatus)[keyof typeof SlaStatus];

export interface SlaPriorityConfig {
  durationHours: number;
  durationMs: number;
  warningThresholdRatio: number; // e.g. 0.25 (last 25% of window is AT_RISK)
  maxWarningBufferMs: number; // e.g. 30 mins
}

export const SLA_CONFIG: Record<Priority, SlaPriorityConfig> = {
  [Priority.CRITICAL]: {
    durationHours: 2,
    durationMs: 2 * 60 * 60 * 1000,
    warningThresholdRatio: 0.25, // 30 mins remaining
    maxWarningBufferMs: 30 * 60 * 1000,
  },
  [Priority.URGENT]: {
    durationHours: 6,
    durationMs: 6 * 60 * 60 * 1000,
    warningThresholdRatio: 0.25, // 90 mins remaining
    maxWarningBufferMs: 90 * 60 * 1000,
  },
  [Priority.HIGH]: {
    durationHours: 24,
    durationMs: 24 * 60 * 60 * 1000,
    warningThresholdRatio: 0.25, // 6 hours remaining
    maxWarningBufferMs: 6 * 60 * 60 * 1000,
  },
  [Priority.MEDIUM]: {
    durationHours: 72,
    durationMs: 72 * 60 * 60 * 1000,
    warningThresholdRatio: 0.25, // 18 hours remaining
    maxWarningBufferMs: 18 * 60 * 60 * 1000,
  },
  [Priority.LOW]: {
    durationHours: 168,
    durationMs: 168 * 60 * 60 * 1000,
    warningThresholdRatio: 0.25, // 42 hours remaining
    maxWarningBufferMs: 24 * 60 * 60 * 1000,
  },
};

export interface SlaMetadata {
  targetDeadline: string;
  slaDurationMs: number;
  timeRemainingMs: number;
  status: SlaStatus;
  isBreached: boolean;
  isAtRisk: boolean;
  lastEscalationStatus: string;
}

export interface SlaOverviewDTO {
  totalActive: number;
  healthyCount: number;
  atRiskCount: number;
  breachedCount: number;
  urgentQueue: WorkItemSummaryDTO[];
}

// ==========================================
// Standard API Envelope Types
// ==========================================

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
    requestId?: string;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiResponseError {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    requestId?: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

// ==========================================
// Health & Readiness Types
// ==========================================

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
}

export interface ReadinessCheckResponse {
  status: 'ready' | 'unhealthy';
  database: 'connected' | 'disconnected';
  latencyMs?: number;
  timestamp: string;
  error?: string;
}

// ==========================================
// Authentication DTOs
// ==========================================

export const LoginInputSchema = z.object({
  email: z.string().trim().email({ message: 'Must be a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
}

export interface TeamMembershipInfo {
  teamId: string;
  teamName: string;
  teamSlug: string;
  role: TeamRole;
}

export interface UserProfile extends AuthUser {
  memberships: TeamMembershipInfo[];
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

// ==========================================
// Work Item DTOs & Validation Schemas
// ==========================================

export const CreateWorkItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { message: 'Title must be at least 3 characters long' })
    .max(255, { message: 'Title cannot exceed 255 characters' }),
  description: z
    .string()
    .trim()
    .max(4000, { message: 'Description cannot exceed 4000 characters' })
    .optional(),
  type: z.nativeEnum(WorkItemType, {
    errorMap: () => ({ message: 'Invalid work item type' }),
  }),
  priority: z
    .nativeEnum(Priority, {
      errorMap: () => ({ message: 'Invalid priority level' }),
    })
    .default(Priority.MEDIUM),
  teamId: z.string().uuid({ message: 'Valid team ID is required' }),
  assigneeId: z.string().uuid({ message: 'Invalid assignee ID' }).nullable().optional(),
  dueDate: z
    .string()
    .datetime({ message: 'Due date must be an ISO 8601 string' })
    .nullable()
    .optional(),
});
export type CreateWorkItemInput = z.infer<typeof CreateWorkItemSchema>;

export const UpdateWorkItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { message: 'Title must be at least 3 characters long' })
      .max(255, { message: 'Title cannot exceed 255 characters' })
      .optional(),
    description: z
      .string()
      .trim()
      .max(4000, { message: 'Description cannot exceed 4000 characters' })
      .nullable()
      .optional(),
    priority: z
      .nativeEnum(Priority, {
        errorMap: () => ({ message: 'Invalid priority level' }),
      })
      .optional(),
    dueDate: z
      .string()
      .datetime({ message: 'Due date must be an ISO 8601 string' })
      .nullable()
      .optional(),
    assigneeId: z.string().uuid({ message: 'Invalid assignee ID' }).nullable().optional(),
    version: z
      .number()
      .int({ message: 'Version must be an integer' })
      .positive({ message: 'Version must be a positive integer' })
      .optional(),
  })
  .refine(
    (data) => {
      const { version: _v, ...rest } = data;
      return Object.keys(rest).length > 0;
    },
    {
      message:
        'At least one mutable field (title, description, priority, dueDate, assigneeId) must be provided for update',
    }
  );
export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemSchema>;

export const TransitionWorkItemSchema = z.object({
  targetStatus: z.nativeEnum(WorkItemStatus, {
    errorMap: () => ({ message: 'Invalid target status' }),
  }),
  reason: z
    .string()
    .trim()
    .max(1000, { message: 'Reason cannot exceed 1000 characters' })
    .optional(),
});
export type TransitionWorkItemInput = z.infer<typeof TransitionWorkItemSchema>;

export const AddCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { message: 'Comment body cannot be empty' })
    .max(2000, { message: 'Comment cannot exceed 2000 characters' }),
});
export type AddCommentInput = z.infer<typeof AddCommentSchema>;

export const WorkItemListQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(WorkItemType).optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type WorkItemListQuery = z.infer<typeof WorkItemListQuerySchema>;

// ==========================================
// Entity Representation DTOs
// ==========================================

export interface WorkItemSummaryDTO {
  id: string;
  title: string;
  description: string | null;
  type: WorkItemType;
  priority: Priority;
  status: WorkItemStatus;
  teamId: string;
  teamName?: string;
  assigneeId: string | null;
  assigneeName?: string | null;
  creatorId: string;
  creatorName?: string;
  dueDate: string | null;
  completedAt: string | null;
  version: number;
  lastEscalationStatus?: string;
  sla?: SlaMetadata;
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments: number;
    activities: number;
  };
}

export interface ActivityEventDTO {
  id: string;
  workItemId: string;
  actorId: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: ActivityAction;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  workItemId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Common Utility Schemas
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// ==========================================
// Settings & Configuration DTOs and Schemas
// ==========================================

export const SettingsCategory = {
  GENERAL: 'general',
  BRANDING: 'branding',
  EMAIL: 'email',
  SLA: 'sla',
  WORKFLOW: 'workflow',
  SECURITY: 'security',
  NOTIFICATION: 'notification',
} as const;
export type SettingsCategory = (typeof SettingsCategory)[keyof typeof SettingsCategory];

// A. General
export const GeneralSettingsSchema = z.object({
  appName: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100),
  timezone: z.string().default('UTC'),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']).default('YYYY-MM-DD'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
  supportContact: z.string().email(),
  maintenanceMode: z.boolean().default(false),
});
export type GeneralSettingsDTO = z.infer<typeof GeneralSettingsSchema>;

// B. Branding
export const BrandingSettingsSchema = z.object({
  appName: z.string().min(1).max(100),
  logoUrl: z.string().nullable().default(null),
  faviconUrl: z.string().nullable().default(null),
  browserTitle: z.string().min(1).max(150),
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color code'),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color code'),
  themeDefault: z.enum(['light', 'dark', 'system']).default('light'),
  sidebarTheme: z.enum(['light', 'dark']).default('light'),
});
export type BrandingSettingsDTO = z.infer<typeof BrandingSettingsSchema>;

// C. Email
export const EmailSettingsSchema = z.object({
  smtpHost: z.string().default(''),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().default(''),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean().default(false),
  senderName: z.string().min(1).default('Newtonite Alerts'),
  senderEmail: z.string().email().or(z.literal('')).default(''),
  enabled: z.boolean().default(false),
  lastTestResult: z.enum(['NONE', 'SUCCESS', 'FAILED']).default('NONE'),
  lastTestedAt: z.string().nullable().default(null),
  lastTestError: z.string().nullable().default(null),
});
export type EmailSettingsDTO = z.infer<typeof EmailSettingsSchema>;

export const SendTestEmailSchema = z.object({
  recipientEmail: z.string().email('Recipient must be a valid email address'),
});
export type SendTestEmailInput = z.infer<typeof SendTestEmailSchema>;

// D. SLA
export const SlaSettingsSchema = z.object({
  durations: z.object({
    CRITICAL: z.number().int().min(15).max(43200),
    URGENT: z.number().int().min(15).max(43200),
    HIGH: z.number().int().min(15).max(43200),
    MEDIUM: z.number().int().min(15).max(43200),
    LOW: z.number().int().min(15).max(43200),
  }),
  warningBufferPercent: z.number().min(5).max(50).default(25),
  scanIntervalMinutes: z.number().int().min(1).max(60).default(5),
  escalationProcessingEnabled: z.boolean().default(true),
});
export type SlaSettingsDTO = z.infer<typeof SlaSettingsSchema>;

// E. Workflow
export const WorkflowSettingsSchema = z.object({
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).default('MEDIUM'),
  defaultType: z
    .enum(['INCIDENT', 'CUSTOMER_ISSUE', 'PAYMENT', 'COMPLIANCE', 'TASK'])
    .default('TASK'),
  allowViewerComments: z.boolean().default(true),
  requireDueDateForCritical: z.boolean().default(false),
});
export type WorkflowSettingsDTO = z.infer<typeof WorkflowSettingsSchema>;

// F. Security
export const SecuritySettingsSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(15).max(1440).default(60),
  minPasswordLength: z.number().int().min(8).max(32).default(8),
  requireSpecialChar: z.boolean().default(true),
  requireNumber: z.boolean().default(true),
});
export type SecuritySettingsDTO = z.infer<typeof SecuritySettingsSchema>;

// G. Notifications
export const NotificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean().default(false),
  notifyOnEscalation: z.boolean().default(true),
  notifyOnAssignment: z.boolean().default(true),
  notifyOnApproval: z.boolean().default(true),
});
export type NotificationSettingsDTO = z.infer<typeof NotificationSettingsSchema>;

// Audit & Outbox DTOs
export interface SettingAuditEventDTO {
  id: string;
  category: string;
  action: string;
  actorId: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  diff: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;
  createdAt: string;
}

export interface OutboxQueueStatsDTO {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  total: number;
  recentFailures: Array<{
    id: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: string;
    nextRetryAt: string;
  }>;
}

export interface TeamMemberAdminDTO {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  systemRole: SystemRole;
  role: TeamRole;
  teamId: string;
  teamName: string;
  createdAt: string;
}

export const UpdateTeamMemberRoleSchema = z.object({
  role: z.enum(['VIEWER', 'MEMBER', 'LEAD', 'ADMIN']),
});

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['VIEWER', 'MEMBER', 'LEAD', 'ADMIN']),
});

export const ToggleUserActiveSchema = z.object({
  isActive: z.boolean(),
});
