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
// Common DTO Schemas
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' });
