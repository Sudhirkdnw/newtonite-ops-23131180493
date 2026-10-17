import { describe, it, expect } from 'vitest';
import { OptimisticReconciler } from '../../apps/web/src/hooks/optimisticReconciler';

describe('Critical Behaviour 7: Optimistic UI Reconciliation Pattern', () => {
  const initialWorkItem = {
    id: 'item-101',
    title: 'Initial Incident Title',
    status: 'IN_PROGRESS',
    assigneeId: 'user-alice',
    version: 3,
  };

  it('rolls back to previous snapshot and alerts on HTTP 409 Conflict', async () => {
    // Simulated stale update where server returns 409 Conflict with newer version 4
    const simulatedConflictMutation = async () => {
      const err = new Error('Stale update rejected: Work item has been modified by another user');
      (err as unknown as { status: number }).status = 409;
      throw err;
    };

    // Simulated reconciliation function that fetches latest state from server
    const simulatedReconcileFn = async () => {
      return {
        ...initialWorkItem,
        version: 4,
        title: 'Title Modified Concurrently on Server',
      };
    };

    const optimisticPatch = { title: 'Optimistically Edited Title' };

    const result = await OptimisticReconciler.execute(
      initialWorkItem,
      optimisticPatch,
      simulatedConflictMutation,
      simulatedReconcileFn
    );

    expect(result.success).toBe(false);
    expect(result.conflictError).toContain('Conflict detected');
    // State was reconciled with the latest server state (version 4)
    expect(result.state.version).toBe(4);
    expect(result.state.title).toBe('Title Modified Concurrently on Server');
  });

  it('rolls back to previous snapshot and records error on HTTP 403 Forbidden', async () => {
    const simulatedForbiddenMutation = async () => {
      const err = new Error('Viewers do not have permission to modify work items');
      (err as unknown as { status: number }).status = 403;
      throw err;
    };

    const optimisticPatch = { status: 'COMPLETED' };

    const result = await OptimisticReconciler.execute(
      initialWorkItem,
      optimisticPatch,
      simulatedForbiddenMutation
    );

    expect(result.success).toBe(false);
    expect(result.authorizationError).toContain('Authorization failed');
    expect(result.authorizationError).toContain('Viewers do not have permission');
    // State rolled back to initial status
    expect(result.state.status).toBe('IN_PROGRESS');
  });

  it('updates state to server response on successful mutation', async () => {
    const serverResult = {
      ...initialWorkItem,
      version: 4,
      status: 'IN_REVIEW',
    };

    const successfulMutation = async () => {
      return serverResult;
    };

    const optimisticPatch = { status: 'IN_REVIEW' };

    const result = await OptimisticReconciler.execute(
      initialWorkItem,
      optimisticPatch,
      successfulMutation
    );

    expect(result.success).toBe(true);
    expect(result.conflictError).toBeNull();
    expect(result.authorizationError).toBeNull();
    expect(result.state.status).toBe('IN_REVIEW');
    expect(result.state.version).toBe(4);
  });
});
