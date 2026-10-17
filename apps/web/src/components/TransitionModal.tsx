import React, { useState } from 'react';
import type { WorkItemStatus, WorkItemSummaryDTO } from '@newtonite/shared';

interface TransitionModalProps {
  isOpen: boolean;
  item: WorkItemSummaryDTO | null;
  onClose: () => void;
  onConfirm: (itemId: string, targetStatus: WorkItemStatus, reason?: string) => Promise<void>;
  userRole?: string;
}

const NEXT_STATUS_OPTIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  BACKLOG: ['TRIAGED' as WorkItemStatus, 'IN_PROGRESS' as WorkItemStatus, 'CANCELLED' as WorkItemStatus],
  TRIAGED: ['IN_PROGRESS' as WorkItemStatus, 'BLOCKED' as WorkItemStatus, 'CANCELLED' as WorkItemStatus],
  IN_PROGRESS: ['IN_REVIEW' as WorkItemStatus, 'BLOCKED' as WorkItemStatus, 'CANCELLED' as WorkItemStatus],
  BLOCKED: ['IN_PROGRESS' as WorkItemStatus, 'CANCELLED' as WorkItemStatus],
  IN_REVIEW: ['COMPLETED' as WorkItemStatus, 'IN_PROGRESS' as WorkItemStatus, 'CANCELLED' as WorkItemStatus],
  COMPLETED: [],
  CANCELLED: [],
};

export const TransitionModal: React.FC<TransitionModalProps> = ({
  isOpen,
  item,
  onClose,
  onConfirm,
  userRole,
}) => {
  const [targetStatus, setTargetStatus] = useState<WorkItemStatus | ''>('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const validNextStates = NEXT_STATUS_OPTIONS[item.status] || [];
  const selectedIsApproval = targetStatus === 'COMPLETED' && item.status === 'IN_REVIEW';
  const hasApprovalAuthority = userRole === 'LEAD' || userRole === 'ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onConfirm(item.id, targetStatus as WorkItemStatus, reason.trim() || undefined);
      setReason('');
      setTargetStatus('');
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number };
      if (errorObj.status === 403) {
        setErrorMsg('Approval Forbidden: Only Leads or Admins can approve items in review to Completed.');
      } else {
        setErrorMsg(errorObj.message || 'Workflow transition rejected by server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '460px',
          width: '100%',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-popover)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: '1.15rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '0.25rem',
          }}
        >
          Transition Workflow State
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Moving "{item.title}" from <strong style={{ color: 'var(--primary-blue)' }}>{item.status}</strong>
        </p>

        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              marginBottom: '1rem',
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}

        {validNextStates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>
            This item is in a terminal state ({item.status}) and cannot be transitioned further.
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Target Status *
              </label>
              <select
                id="select-target-status"
                required
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as WorkItemStatus)}
                style={{ width: '100%', fontSize: '0.875rem' }}
              >
                <option value="" disabled>
                  Select next status...
                </option>
                {validNextStates.map((s) => (
                  <option key={s} value={s}>
                    → {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {selectedIsApproval && !hasApprovalAuthority && (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.775rem',
                }}
              >
                ℹ Notice: Approving an item in review requires Lead or Admin authority. Your current role is{' '}
                <strong>{userRole || 'MEMBER'}</strong>.
              </div>
            )}

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Transition Reason / Notes (Optional)
              </label>
              <textarea
                id="transition-reason"
                rows={2}
                placeholder="Audit explanation for this status change..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '0.5rem 0.95rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-transition"
                type="submit"
                disabled={isSubmitting || !targetStatus}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--primary-blue)',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  opacity: isSubmitting || !targetStatus ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Transitioning...' : 'Confirm Transition'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
