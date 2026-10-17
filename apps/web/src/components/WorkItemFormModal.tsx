import React, { useState, useEffect } from 'react';
import type {
  WorkItemSummaryDTO,
  Priority,
  WorkItemType,
  CreateWorkItemInput,
  UpdateWorkItemInput,
} from '@newtonite/shared';
import { useAuth } from '../context/AuthContext';

interface WorkItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate?: (data: CreateWorkItemInput, idempotencyKey: string) => Promise<void>;
  onSubmitUpdate?: (
    itemId: string,
    patch: UpdateWorkItemInput,
    idempotencyKey: string
  ) => Promise<void>;
  initialItem?: WorkItemSummaryDTO | null; // If provided, modal is in Edit mode
  availableTeamMembers?: Array<{ id: string; name: string }>;
}

export const WorkItemFormModal: React.FC<WorkItemFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  initialItem,
  availableTeamMembers = [],
}) => {
  const { currentUser } = useAuth();
  const isEditMode = Boolean(initialItem);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<WorkItemType>('TASK' as WorkItemType);
  const [priority, setPriority] = useState<Priority>('MEDIUM' as Priority);
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Populate form on open / change
  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title);
      setDescription(initialItem.description || '');
      setType(initialItem.type);
      setPriority(initialItem.priority);
      setTeamId(initialItem.teamId);
      setAssigneeId(initialItem.assigneeId || '');
      setDueDate(initialItem.dueDate ? initialItem.dueDate.slice(0, 16) : '');
    } else {
      setTitle('');
      setDescription('');
      setType('TASK' as WorkItemType);
      setPriority('MEDIUM' as Priority);
      const defaultTeam = currentUser?.memberships[0]?.teamId || '';
      setTeamId(defaultTeam);
      setAssigneeId('');
      setDueDate('');
    }
    setErrors({});
    setApiError(null);
  }, [initialItem, currentUser, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    } else if (title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters long';
    } else if (title.trim().length > 255) {
      errs.title = 'Title cannot exceed 255 characters';
    }

    if (description && description.length > 4000) {
      errs.description = 'Description cannot exceed 4000 characters';
    }

    if (!teamId && !isEditMode) {
      errs.teamId = 'Team selection is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setApiError(null);

    const idempotencyKey = `web-form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      if (isEditMode && initialItem && onSubmitUpdate) {
        const patch: UpdateWorkItemInput = {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          version: initialItem.version, // Optimistic lock token
        };
        await onSubmitUpdate(initialItem.id, patch, idempotencyKey);
      } else if (onSubmitCreate) {
        const createData: CreateWorkItemInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          teamId,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        };
        await onSubmitCreate(createData, idempotencyKey);
      }
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { message?: string; details?: unknown; status?: number };
      if (errorObj.status === 409) {
        setApiError(
          'Conflict detected: This work item was modified by another user. Please refresh.'
        );
      } else if (errorObj.status === 403) {
        setApiError('Forbidden: You do not have permission to perform this action.');
      } else {
        setApiError(errorObj.message || 'Operation failed. Please review inputs.');
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
          maxWidth: '560px',
          width: '100%',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-popover)',
          border: '1px solid var(--border-color)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
              }}
            >
              {isEditMode ? 'Edit Work Item' : 'Create New Work Item'}
            </h2>
            {isEditMode && initialItem && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Targeting version v{initialItem.version} (Optimistic Concurrency Control)
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: '1.2rem', color: 'var(--text-subtle)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {apiError && (
          <div
            id="form-api-error"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            ⚠ {apiError}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Title */}
          <div>
            <label
              htmlFor="field-title"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.35rem',
              }}
            >
              Title *
            </label>
            <input
              id="field-title"
              type="text"
              required
              placeholder="Operational incident or task summary..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                borderColor: errors.title ? '#ef4444' : undefined,
              }}
            />
            {errors.title && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  marginTop: '0.25rem',
                  display: 'block',
                }}
              >
                {errors.title}
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="field-description"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.35rem',
              }}
            >
              Description
            </label>
            <textarea
              id="field-description"
              rows={3}
              placeholder="Background, scope, investigation findings, or remediation steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
            {errors.description && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  marginTop: '0.25rem',
                  display: 'block',
                }}
              >
                {errors.description}
              </span>
            )}
          </div>

          {/* Type & Priority Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="field-type"
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Work-Item Type
              </label>
              <select
                id="field-type"
                disabled={isEditMode} // Type is immutable after creation
                value={type}
                onChange={(e) => setType(e.target.value as WorkItemType)}
                style={{ width: '100%', opacity: isEditMode ? 0.7 : 1 }}
              >
                <option value="TASK">Task (Standard Operation)</option>
                <option value="INCIDENT">Incident (P0/P1 Outage)</option>
                <option value="CUSTOMER_ISSUE">Customer Issue</option>
                <option value="PAYMENT">Payment Investigation</option>
                <option value="COMPLIANCE">Compliance Review</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="field-priority"
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Priority Level
              </label>
              <select
                id="field-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                style={{ width: '100%' }}
              >
                <option value="CRITICAL">Critical (P0)</option>
                <option value="URGENT">Urgent (P1)</option>
                <option value="HIGH">High (P2)</option>
                <option value="MEDIUM">Medium (P3)</option>
                <option value="LOW">Low (P4)</option>
              </select>
            </div>
          </div>

          {/* Team & Assignee Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="field-team"
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Team *
              </label>
              <select
                id="field-team"
                disabled={isEditMode}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={{ width: '100%', opacity: isEditMode ? 0.7 : 1 }}
              >
                {currentUser?.memberships.map((m) => (
                  <option key={m.teamId} value={m.teamId}>
                    {m.teamName} ({m.role})
                  </option>
                ))}
              </select>
              {errors.teamId && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    marginTop: '0.25rem',
                    display: 'block',
                  }}
                >
                  {errors.teamId}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="field-assignee"
                style={{
                  display: 'block',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.35rem',
                }}
              >
                Assignee
              </label>
              <select
                id="field-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Unassigned</option>
                {currentUser && (
                  <option value={currentUser.id}>Assign to Me ({currentUser.name})</option>
                )}
                {availableTeamMembers
                  .filter((m) => m.id !== currentUser?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label
              htmlFor="field-duedate"
              style={{
                display: 'block',
                fontSize: '0.825rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.35rem',
              }}
            >
              Due Date / Target Resolution
            </label>
            <input
              id="field-duedate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.55rem 1rem',
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
              id="btn-submit-work-item"
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.55rem 1.25rem',
                backgroundColor: 'var(--primary-blue)',
                color: '#ffffff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Work Item' : 'Create Work Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
