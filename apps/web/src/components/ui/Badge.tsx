import React from 'react';
import type { WorkItemStatus, Priority, WorkItemType } from '@newtonite/shared';

interface StatusBadgeProps {
  status: WorkItemStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const map: Record<string, { bg: string; color: string; label: string; border: string }> = {
    BACKLOG: { bg: '#f1f5f9', color: '#475569', label: 'Backlog', border: '#cbd5e1' },
    TRIAGED: { bg: '#eff6ff', color: '#1d4ed8', label: 'Triaged', border: '#bfdbfe' },
    IN_PROGRESS: { bg: '#e0f2fe', color: '#0369a1', label: 'In Progress', border: '#bae6fd' },
    BLOCKED: { bg: '#fef2f2', color: '#b91c1c', label: 'Blocked', border: '#fecaca' },
    IN_REVIEW: { bg: '#faf5ff', color: '#7e22ce', label: 'In Review', border: '#e9d5ff' },
    COMPLETED: { bg: '#f0fdf4', color: '#15803d', label: 'Completed', border: '#bbf7d0' },
    CANCELLED: { bg: '#f8fafc', color: '#64748b', label: 'Cancelled', border: '#e2e8f0' },
  };

  const style = map[status] || {
    bg: '#f8fafc',
    color: '#475569',
    label: status,
    border: '#cbd5e1',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 650,
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: Priority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const map: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    CRITICAL: { bg: '#fef2f2', color: '#991b1b', dot: '#dc2626', label: 'Critical P0' },
    URGENT: { bg: '#fff7ed', color: '#9a3412', dot: '#ea580c', label: 'Urgent P1' },
    HIGH: { bg: '#fffbeb', color: '#92400e', dot: '#d97706', label: 'High P2' },
    MEDIUM: { bg: '#eff6ff', color: '#1e40af', dot: '#2563eb', label: 'Medium P3' },
    LOW: { bg: '#f8fafc', color: '#475569', dot: '#94a3b8', label: 'Low P4' },
  };

  const style = map[priority] || {
    bg: '#f8fafc',
    color: '#475569',
    dot: '#94a3b8',
    label: priority,
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: style.dot,
        }}
      />
      {style.label}
    </span>
  );
};

interface RoleBadgeProps {
  role: 'VIEWER' | 'MEMBER' | 'LEAD' | 'ADMIN' | string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    LEAD: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    ADMIN: { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
    MEMBER: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    VIEWER: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  };

  const style = map[role] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };

  return (
    <span
      style={{
        fontSize: '0.675rem',
        fontWeight: 750,
        padding: '0.15rem 0.45rem',
        borderRadius: '4px',
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {role}
    </span>
  );
};

interface TypeBadgeProps {
  type: WorkItemType | string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type }) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    INCIDENT: { bg: '#fee2e2', color: '#991b1b', label: 'Incident' },
    CUSTOMER_ISSUE: { bg: '#ffedd5', color: '#9a3412', label: 'Customer Issue' },
    PAYMENT: { bg: '#fef3c7', color: '#92400e', label: 'Payment' },
    COMPLIANCE: { bg: '#f3e8ff', color: '#6b21a8', label: 'Compliance' },
    TASK: { bg: '#e0f2fe', color: '#0369a1', label: 'Task' },
  };

  const style = map[type] || { bg: '#f1f5f9', color: '#475569', label: type };

  return (
    <span
      style={{
        fontSize: '0.725rem',
        fontWeight: 650,
        padding: '0.15rem 0.45rem',
        borderRadius: '4px',
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
};

interface SlaBadgeProps {
  sla?: {
    status: 'HEALTHY' | 'AT_RISK' | 'BREACHED' | 'RESOLVED' | string;
    isBreached?: boolean;
    isAtRisk?: boolean;
    timeRemainingMs?: number;
    targetDeadline?: string;
  };
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({ sla }) => {
  if (!sla) return null;

  if (sla.status === 'RESOLVED') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 650,
          backgroundColor: '#f1f5f9',
          color: '#475569',
          border: '1px solid #cbd5e1',
        }}
      >
        <span>✓</span> SLA Resolved
      </span>
    );
  }

  if (sla.status === 'BREACHED') {
    const overdueMinutes = Math.abs(Math.round((sla.timeRemainingMs ?? 0) / (60 * 1000)));
    const overdueText =
      overdueMinutes > 60
        ? `${Math.round(overdueMinutes / 60)}h overdue`
        : `${overdueMinutes}m overdue`;

    return (
      <span
        id="badge-sla-breached"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 750,
          backgroundColor: '#fef2f2',
          color: '#991b1b',
          border: '1px solid #f87171',
        }}
      >
        <span style={{ fontSize: '0.8rem' }}>🚨</span> Breached ({overdueText})
      </span>
    );
  }

  if (sla.status === 'AT_RISK') {
    const remainingMinutes = Math.max(0, Math.round((sla.timeRemainingMs ?? 0) / (60 * 1000)));
    const remainingText =
      remainingMinutes > 60
        ? `${Math.round(remainingMinutes / 60)}h left`
        : `${remainingMinutes}m left`;

    return (
      <span
        id="badge-sla-at-risk"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 750,
          backgroundColor: '#fffbeb',
          color: '#b45309',
          border: '1px solid #fde68a',
        }}
      >
        <span style={{ fontSize: '0.8rem' }}>⚠️</span> At Risk ({remainingText})
      </span>
    );
  }

  return (
    <span
      id="badge-sla-healthy"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.72rem',
        fontWeight: 650,
        backgroundColor: '#f0fdf4',
        color: '#166534',
        border: '1px solid #bbf7d0',
      }}
    >
      <span>⏱️</span> Within SLA
    </span>
  );
};
