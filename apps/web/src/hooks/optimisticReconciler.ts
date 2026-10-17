export interface OptimisticMutationResult<T> {
  success: boolean;
  state: T;
  optimisticState: T;
  conflictError: string | null;
  authorizationError: string | null;
  generalError: string | null;
}

export class OptimisticReconciler {
  /**
   * Executes an optimistic mutation with automatic rollback on error.
   * - Preserves the snapshot of the initial state.
   * - On 409 Conflict: rolls back to snapshot, logs conflict message, and reconciles with server if reconcileFn provided.
   * - On 403 Forbidden: rolls back to snapshot and records authorization error.
   * - On success: updates state to server state.
   */
  static async execute<T extends object>(
    currentState: T,
    optimisticPatch: Partial<T>,
    mutationFn: () => Promise<T>,
    reconcileFn?: () => Promise<T>
  ): Promise<OptimisticMutationResult<T>> {
    // 1. Snapshot original state before applying optimistic patch
    const snapshot = { ...currentState };
    const optimisticState = { ...currentState, ...optimisticPatch };

    try {
      // 2. Perform server mutation
      const serverResult = await mutationFn();

      return {
        success: true,
        state: serverResult,
        optimisticState,
        conflictError: null,
        authorizationError: null,
        generalError: null,
      };
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
        status?: number;
        message?: string;
      };

      const statusCode = errorObj.response?.status || errorObj.status;
      const message =
        errorObj.response?.data?.error?.message || errorObj.message || 'Operation failed';

      // 3. Rollback on 409 Conflict
      if (statusCode === 409) {
        let finalState = snapshot;
        if (reconcileFn) {
          try {
            finalState = await reconcileFn();
          } catch {
            finalState = snapshot;
          }
        }

        return {
          success: false,
          state: finalState,
          optimisticState,
          conflictError: `Conflict detected: ${message}. Optimistic changes rolled back.`,
          authorizationError: null,
          generalError: null,
        };
      }

      // 4. Rollback on 403 Forbidden
      if (statusCode === 403) {
        return {
          success: false,
          state: snapshot,
          optimisticState,
          conflictError: null,
          authorizationError: `Authorization failed: ${message}. Permission denied.`,
          generalError: null,
        };
      }

      // 5. Rollback on any other error
      return {
        success: false,
        state: snapshot,
        optimisticState,
        conflictError: null,
        authorizationError: null,
        generalError: message,
      };
    }
  }
}
