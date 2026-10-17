import { Priority, SLA_CONFIG, SlaMetadata, SlaStatus, WorkItemStatus } from '@newtonite/shared';

export interface WorkItemSlaInput {
  priority: Priority;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  status: WorkItemStatus;
  completedAt?: Date | string | null;
  lastEscalationStatus?: string | null;
}

/**
 * Deterministically computes SLA status, target deadline, and remaining time
 * for a work item using an injectable clock.
 *
 * Rules:
 * 1. SLA deadline is calculated from `createdAt + SLA_CONFIG[priority].durationMs`.
 * 2. If an explicit `dueDate` was provided by an operator, the target deadline
 *    is `min(dueDate, slaDeadline)` to honor scheduled deadlines without permitting
 *    contractual SLA bypass.
 * 3. Closed items (COMPLETED, CANCELLED) are marked as RESOLVED and never escalate.
 * 4. Active items past the target deadline are marked as BREACHED.
 * 5. Active items within the warning threshold (<= 25% or max buffer remaining) are AT_RISK.
 * 6. Other active items are HEALTHY.
 */
export interface CustomSlaOptions {
  durations?: Record<Priority, number>; // in minutes
  warningBufferPercent?: number; // e.g. 25
}

export function calculateSlaStatus(
  item: WorkItemSlaInput,
  now: Date = new Date(),
  customConfig?: CustomSlaOptions
): SlaMetadata {
  const defaultConfig = SLA_CONFIG[item.priority] || SLA_CONFIG[Priority.MEDIUM];

  // Dynamic SLA durations from Settings if customized
  const customDurationMinutes = customConfig?.durations?.[item.priority];
  const durationMs = customDurationMinutes
    ? customDurationMinutes * 60 * 1000
    : defaultConfig.durationMs;

  const warningRatio = customConfig?.warningBufferPercent
    ? customConfig.warningBufferPercent / 100
    : defaultConfig.warningThresholdRatio;

  const createdTime = new Date(item.createdAt).getTime();
  const slaDeadline = new Date(createdTime + durationMs);

  let targetDeadline = slaDeadline;
  if (item.dueDate) {
    const userDueDate = new Date(item.dueDate);
    if (!isNaN(userDueDate.getTime()) && userDueDate.getTime() < slaDeadline.getTime()) {
      targetDeadline = userDueDate;
    }
  }

  const lastEscalationStatus = item.lastEscalationStatus || 'NONE';

  // Closed/Resolved items do not generate active escalations
  if (item.status === WorkItemStatus.COMPLETED || item.status === WorkItemStatus.CANCELLED) {
    return {
      targetDeadline: targetDeadline.toISOString(),
      slaDurationMs: durationMs,
      timeRemainingMs: 0,
      status: SlaStatus.RESOLVED,
      isBreached: false,
      isAtRisk: false,
      lastEscalationStatus,
    };
  }

  const currentTime = now.getTime();
  const timeRemainingMs = targetDeadline.getTime() - currentTime;

  if (timeRemainingMs <= 0) {
    return {
      targetDeadline: targetDeadline.toISOString(),
      slaDurationMs: durationMs,
      timeRemainingMs,
      status: SlaStatus.BREACHED,
      isBreached: true,
      isAtRisk: false,
      lastEscalationStatus,
    };
  }

  const warningBufferMs = Math.min(durationMs * warningRatio, defaultConfig.maxWarningBufferMs);

  if (timeRemainingMs <= warningBufferMs) {
    return {
      targetDeadline: targetDeadline.toISOString(),
      slaDurationMs: durationMs,
      timeRemainingMs,
      status: SlaStatus.AT_RISK,
      isBreached: false,
      isAtRisk: true,
      lastEscalationStatus,
    };
  }

  return {
    targetDeadline: targetDeadline.toISOString(),
    slaDurationMs: durationMs,
    timeRemainingMs,
    status: SlaStatus.HEALTHY,
    isBreached: false,
    isAtRisk: false,
    lastEscalationStatus,
  };
}
