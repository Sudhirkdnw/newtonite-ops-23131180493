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
    details?: ApiErrorDetail[];
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
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
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
