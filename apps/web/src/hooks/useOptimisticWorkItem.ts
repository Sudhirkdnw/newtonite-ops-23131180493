import { useState, useCallback } from 'react';
import type { WorkItemSummaryDTO } from '@newtonite/shared';
import { OptimisticReconciler } from './optimisticReconciler';

export interface OptimisticMutationOptions {
  mutationFn: () => Promise<WorkItemSummaryDTO>;
  optimisticPatch: Partial<WorkItemSummaryDTO>;
  reconcileFn?: () => Promise<WorkItemSummaryDTO>;
}

export interface UseOptimisticWorkItemResult {
  item: WorkItemSummaryDTO | null;
  setItem: (item: WorkItemSummaryDTO | null) => void;
  isMutating: boolean;
  conflictError: string | null;
  authorizationError: string | null;
  generalError: string | null;
  mutateOptimistically: (options: OptimisticMutationOptions) => Promise<boolean>;
  clearErrors: () => void;
}

export function useOptimisticWorkItem(
  initialItem: WorkItemSummaryDTO | null = null
): UseOptimisticWorkItemResult {
  const [item, setItem] = useState<WorkItemSummaryDTO | null>(initialItem);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setConflictError(null);
    setAuthorizationError(null);
    setGeneralError(null);
  }, []);

  const mutateOptimistically = useCallback(
    async ({
      mutationFn,
      optimisticPatch,
      reconcileFn,
    }: OptimisticMutationOptions): Promise<boolean> => {
      if (!item) return false;

      clearErrors();
      setIsMutating(true);

      // Optimistically update UI immediately
      setItem((curr) => (curr ? { ...curr, ...optimisticPatch } : null));

      try {
        const result = await OptimisticReconciler.execute<WorkItemSummaryDTO>(
          item,
          optimisticPatch,
          mutationFn,
          reconcileFn
        );

        setItem(result.state);
        setConflictError(result.conflictError);
        setAuthorizationError(result.authorizationError);
        setGeneralError(result.generalError);

        return result.success;
      } finally {
        setIsMutating(false);
      }
    },
    [item, clearErrors]
  );

  return {
    item,
    setItem,
    isMutating,
    conflictError,
    authorizationError,
    generalError,
    mutateOptimistically,
    clearErrors,
  };
}
