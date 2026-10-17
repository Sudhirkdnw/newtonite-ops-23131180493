import React, { useState } from 'react';
import type { Priority, WorkItemType } from '@newtonite/shared';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    type: WorkItemType;
    priority: Priority;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<WorkItemType>('TASK' as WorkItemType);
  const [priority, setPriority] = useState<Priority>('HIGH' as Priority);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(),
      description: desc.trim() || undefined,
      type,
      priority,
    });
    setTitle('');
    setDesc('');
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
          maxWidth: '500px',
          width: '100%',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-popover)',
          border: '1px solid var(--border-color)',
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
          <h3
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            + Create New Task
          </h3>
          <button
            onClick={onClose}
            style={{ fontSize: '1.2rem', color: 'var(--text-subtle)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
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
              Task Title *
            </label>
            <input
              id="modal-task-title"
              type="text"
              required
              placeholder="e.g. Design Homepage Wireframe"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem' }}
            />
          </div>

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
              Description
            </label>
            <textarea
              id="modal-task-desc"
              rows={3}
              placeholder="Add key deliverables, scope, or background..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                Category / Type
              </label>
              <select
                id="modal-task-type"
                value={type}
                onChange={(e) => setType(e.target.value as WorkItemType)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                <option value="TASK">Task (Design/Dev)</option>
                <option value="INCIDENT">Incident (P0/P1)</option>
                <option value="CUSTOMER_ISSUE">Customer Issue</option>
                <option value="PAYMENT">Payment</option>
                <option value="COMPLIANCE">Compliance</option>
              </select>
            </div>

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
                Priority Level
              </label>
              <select
                id="modal-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                <option value="CRITICAL">Critical (P0)</option>
                <option value="URGENT">Urgent (P1)</option>
                <option value="HIGH">High (P2)</option>
                <option value="MEDIUM">Medium (P3)</option>
                <option value="LOW">Low (P4)</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
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
              id="btn-confirm-create-task"
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.55rem 1.25rem',
                backgroundColor: 'var(--primary-blue)',
                color: '#ffffff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 650,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
