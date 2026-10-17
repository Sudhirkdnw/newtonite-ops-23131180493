import { z } from 'zod';
export declare const WorkItemType: {
  readonly INCIDENT: 'INCIDENT';
  readonly CUSTOMER_ISSUE: 'CUSTOMER_ISSUE';
  readonly PAYMENT: 'PAYMENT';
  readonly COMPLIANCE: 'COMPLIANCE';
  readonly TASK: 'TASK';
};
export type WorkItemType = (typeof WorkItemType)[keyof typeof WorkItemType];
export declare const Priority: {
  readonly LOW: 'LOW';
  readonly MEDIUM: 'MEDIUM';
  readonly HIGH: 'HIGH';
  readonly URGENT: 'URGENT';
  readonly CRITICAL: 'CRITICAL';
};
export type Priority = (typeof Priority)[keyof typeof Priority];
export declare const WorkItemStatus: {
  readonly BACKLOG: 'BACKLOG';
  readonly TRIAGED: 'TRIAGED';
  readonly IN_PROGRESS: 'IN_PROGRESS';
  readonly BLOCKED: 'BLOCKED';
  readonly IN_REVIEW: 'IN_REVIEW';
  readonly COMPLETED: 'COMPLETED';
  readonly CANCELLED: 'CANCELLED';
};
export type WorkItemStatus = (typeof WorkItemStatus)[keyof typeof WorkItemStatus];
export declare const TeamRole: {
  readonly VIEWER: 'VIEWER';
  readonly MEMBER: 'MEMBER';
  readonly LEAD: 'LEAD';
  readonly ADMIN: 'ADMIN';
};
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];
export declare const SystemRole: {
  readonly USER: 'USER';
  readonly SYSTEM_ADMIN: 'SYSTEM_ADMIN';
};
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];
export declare const ActivityAction: {
  readonly CREATED: 'CREATED';
  readonly STATUS_CHANGED: 'STATUS_CHANGED';
  readonly PRIORITY_CHANGED: 'PRIORITY_CHANGED';
  readonly ASSIGNED: 'ASSIGNED';
  readonly UNASSIGNED: 'UNASSIGNED';
  readonly CLAIMED: 'CLAIMED';
  readonly COMMENT_ADDED: 'COMMENT_ADDED';
  readonly WORKFLOW_APPROVED: 'WORKFLOW_APPROVED';
  readonly UPDATED: 'UPDATED';
};
export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];
export declare const OutboxJobStatus: {
  readonly PENDING: 'PENDING';
  readonly PROCESSING: 'PROCESSING';
  readonly COMPLETED: 'COMPLETED';
  readonly FAILED: 'FAILED';
  readonly DEAD_LETTER: 'DEAD_LETTER';
};
export type OutboxJobStatus = (typeof OutboxJobStatus)[keyof typeof OutboxJobStatus];
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
export declare const PaginationQuerySchema: z.ZodObject<
  {
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    page: number;
    limit: number;
    cursor?: string | undefined;
  },
  {
    page?: number | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
  }
>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export declare const UUIDSchema: z.ZodString;
//# sourceMappingURL=index.d.ts.map
