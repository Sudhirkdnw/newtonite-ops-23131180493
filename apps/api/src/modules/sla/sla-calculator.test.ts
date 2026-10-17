import { describe, expect, it } from 'vitest';
import { Priority, SlaStatus, WorkItemStatus } from '@newtonite/shared';
import { calculateSlaStatus } from './sla-calculator';

describe('SLA Calculator Unit Tests', () => {
  const baseDate = new Date('2026-10-17T12:00:00.000Z');

  it('calculates HEALTHY status when comfortably within SLA window', () => {
    // CRITICAL has 2-hour duration (ends at 14:00:00). At 12:30:00, 90 mins remaining (> 30 min buffer).
    const now = new Date('2026-10-17T12:30:00.000Z');
    const result = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        status: WorkItemStatus.IN_PROGRESS,
      },
      now
    );

    expect(result.status).toBe(SlaStatus.HEALTHY);
    expect(result.isBreached).toBe(false);
    expect(result.isAtRisk).toBe(false);
    expect(result.timeRemainingMs).toBe(90 * 60 * 1000);
    expect(result.targetDeadline).toBe('2026-10-17T14:00:00.000Z');
  });

  it('calculates AT_RISK status when within warning threshold buffer', () => {
    // CRITICAL ends at 14:00:00. At 13:45:00, 15 mins remaining (<= 30 min buffer).
    const now = new Date('2026-10-17T13:45:00.000Z');
    const result = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        status: WorkItemStatus.IN_PROGRESS,
      },
      now
    );

    expect(result.status).toBe(SlaStatus.AT_RISK);
    expect(result.isBreached).toBe(false);
    expect(result.isAtRisk).toBe(true);
    expect(result.timeRemainingMs).toBe(15 * 60 * 1000);
  });

  it('calculates BREACHED status when current time is past target deadline', () => {
    // CRITICAL ends at 14:00:00. At 14:01:00, 1 min past deadline.
    const now = new Date('2026-10-17T14:01:00.000Z');
    const result = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        status: WorkItemStatus.IN_PROGRESS,
      },
      now
    );

    expect(result.status).toBe(SlaStatus.BREACHED);
    expect(result.isBreached).toBe(true);
    expect(result.isAtRisk).toBe(false);
    expect(result.timeRemainingMs).toBe(-60 * 1000);
  });

  it('applies priority-specific SLA duration mappings correctly', () => {
    const now = new Date('2026-10-17T12:00:00.000Z');

    // CRITICAL: 2 hours
    const critical = calculateSlaStatus(
      { priority: Priority.CRITICAL, createdAt: baseDate, status: WorkItemStatus.BACKLOG },
      now
    );
    expect(critical.targetDeadline).toBe('2026-10-17T14:00:00.000Z');

    // URGENT: 6 hours
    const urgent = calculateSlaStatus(
      { priority: Priority.URGENT, createdAt: baseDate, status: WorkItemStatus.BACKLOG },
      now
    );
    expect(urgent.targetDeadline).toBe('2026-10-17T18:00:00.000Z');

    // HIGH: 24 hours
    const high = calculateSlaStatus(
      { priority: Priority.HIGH, createdAt: baseDate, status: WorkItemStatus.BACKLOG },
      now
    );
    expect(high.targetDeadline).toBe('2026-10-18T12:00:00.000Z');

    // MEDIUM: 72 hours
    const medium = calculateSlaStatus(
      { priority: Priority.MEDIUM, createdAt: baseDate, status: WorkItemStatus.BACKLOG },
      now
    );
    expect(medium.targetDeadline).toBe('2026-10-20T12:00:00.000Z');

    // LOW: 168 hours
    const low = calculateSlaStatus(
      { priority: Priority.LOW, createdAt: baseDate, status: WorkItemStatus.BACKLOG },
      now
    );
    expect(low.targetDeadline).toBe('2026-10-24T12:00:00.000Z');
  });

  it('honors explicit earlier dueDate without allowing later dueDate to extend contractual SLA', () => {
    // Earlier explicit dueDate (1 hour after creation) should be honored as target deadline
    const earlierDue = new Date('2026-10-17T13:00:00.000Z');
    const resultEarlier = calculateSlaStatus(
      {
        priority: Priority.CRITICAL, // 2-hour SLA
        createdAt: baseDate,
        dueDate: earlierDue,
        status: WorkItemStatus.BACKLOG,
      },
      baseDate
    );
    expect(resultEarlier.targetDeadline).toBe(earlierDue.toISOString());

    // Later explicit dueDate (5 hours after creation) must NOT bypass 2-hour CRITICAL SLA
    const laterDue = new Date('2026-10-17T17:00:00.000Z');
    const resultLater = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        dueDate: laterDue,
        status: WorkItemStatus.BACKLOG,
      },
      baseDate
    );
    expect(resultLater.targetDeadline).toBe('2026-10-17T14:00:00.000Z');
  });

  it('marks COMPLETED and CANCELLED items as RESOLVED with no active escalation', () => {
    const overdueTime = new Date('2026-10-20T00:00:00.000Z'); // Far past deadline

    const completed = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        status: WorkItemStatus.COMPLETED,
        completedAt: new Date('2026-10-17T13:30:00.000Z'),
      },
      overdueTime
    );
    expect(completed.status).toBe(SlaStatus.RESOLVED);
    expect(completed.isBreached).toBe(false);
    expect(completed.isAtRisk).toBe(false);

    const cancelled = calculateSlaStatus(
      {
        priority: Priority.CRITICAL,
        createdAt: baseDate,
        status: WorkItemStatus.CANCELLED,
      },
      overdueTime
    );
    expect(cancelled.status).toBe(SlaStatus.RESOLVED);
    expect(cancelled.isBreached).toBe(false);
    expect(cancelled.isAtRisk).toBe(false);
  });
});
