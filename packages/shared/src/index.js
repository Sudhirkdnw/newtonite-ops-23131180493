"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUIDSchema = exports.PaginationQuerySchema = exports.OutboxJobStatus = exports.ActivityAction = exports.SystemRole = exports.TeamRole = exports.WorkItemStatus = exports.Priority = exports.WorkItemType = void 0;
const zod_1 = require("zod");
// ==========================================
// Domain Enums & Literals
// ==========================================
exports.WorkItemType = {
    INCIDENT: 'INCIDENT',
    CUSTOMER_ISSUE: 'CUSTOMER_ISSUE',
    PAYMENT: 'PAYMENT',
    COMPLIANCE: 'COMPLIANCE',
    TASK: 'TASK',
};
exports.Priority = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
    CRITICAL: 'CRITICAL',
};
exports.WorkItemStatus = {
    BACKLOG: 'BACKLOG',
    TRIAGED: 'TRIAGED',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    IN_REVIEW: 'IN_REVIEW',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
};
exports.TeamRole = {
    VIEWER: 'VIEWER',
    MEMBER: 'MEMBER',
    LEAD: 'LEAD',
    ADMIN: 'ADMIN',
};
exports.SystemRole = {
    USER: 'USER',
    SYSTEM_ADMIN: 'SYSTEM_ADMIN',
};
exports.ActivityAction = {
    CREATED: 'CREATED',
    STATUS_CHANGED: 'STATUS_CHANGED',
    PRIORITY_CHANGED: 'PRIORITY_CHANGED',
    ASSIGNED: 'ASSIGNED',
    UNASSIGNED: 'UNASSIGNED',
    CLAIMED: 'CLAIMED',
    COMMENT_ADDED: 'COMMENT_ADDED',
    WORKFLOW_APPROVED: 'WORKFLOW_APPROVED',
    UPDATED: 'UPDATED',
};
exports.OutboxJobStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    DEAD_LETTER: 'DEAD_LETTER',
};
// ==========================================
// Common DTO Schemas
// ==========================================
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    cursor: zod_1.z.string().optional(),
});
exports.UUIDSchema = zod_1.z.string().uuid({ message: 'Must be a valid UUID' });
//# sourceMappingURL=index.js.map