import React from 'react';
import type { WorkItemSummaryDTO, WorkItemStatus } from '@newtonite/shared';
import type { UserProfile } from '../services/api';

interface KanbanBoardProps {
  items: WorkItemSummaryDTO[];
  currentUser: UserProfile | null;
  onClaim: (item: WorkItemSummaryDTO) => void;
  onTransition: (itemId: string, status: WorkItemStatus) => void;
  onOpenDrawer: (item: WorkItemSummaryDTO) => void;
  onOpenCreateModal: () => void;
}

interface ColumnConfig {
  id: string;
  title: string;
  statuses: WorkItemStatus[];
  headerBg: string;
  badgeBg: string;
  textColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    title: 'To Do',
    statuses: ['BACKLOG' as WorkItemStatus, 'TRIAGED' as WorkItemStatus],
    headerBg: 'var(--column-todo-bg)',
    badgeBg: 'var(--column-todo-badge)',
    textColor: 'var(--column-todo-text)',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    statuses: ['IN_PROGRESS' as WorkItemStatus, 'BLOCKED' as WorkItemStatus],
    headerBg: 'var(--column-progress-bg)',
    badgeBg: 'var(--column-progress-badge)',
    textColor: 'var(--column-progress-text)',
  },
  {
    id: 'in_review',
    title: 'In Review',
    statuses: ['IN_REVIEW' as WorkItemStatus],
    headerBg: 'var(--column-review-bg)',
    badgeBg: 'var(--column-review-badge)',
    textColor: 'var(--column-review-text)',
  },
  {
    id: 'done',
    title: 'Done',
    statuses: ['COMPLETED' as WorkItemStatus],
    headerBg: 'var(--column-done-bg)',
    badgeBg: 'var(--column-done-badge)',
    textColor: 'var(--column-done-text)',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  items,
  currentUser,
  onClaim,
  onTransition,
  onOpenDrawer,
  onOpenCreateModal,
}) => {
  // Dot color by priority
  const getPriorityDotColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'URGENT':
        return '#ef4444'; // Red
      case 'HIGH':
        return '#f59e0b'; // Amber
      case 'MEDIUM':
        return '#3b82f6'; // Blue
      default:
        return '#94a3b8'; // Slate
    }
  };

  // Tag styling by type or tag
  const getTagStyle = (type: string) => {
    switch (type) {
      case 'INCIDENT':
        return { bg: '#fee2e2', color: '#b91c1c' };
      case 'CUSTOMER_ISSUE':
        return { bg: '#ffedd5', color: '#c2410c' };
      case 'PAYMENT':
        return { bg: '#fef3c7', color: '#b45309' };
      case 'COMPLIANCE':
        return { bg: '#f3e8ff', color: '#7e22ce' };
      default:
        return { bg: '#e0f2fe', color: '#0369a1' };
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '1.5rem',
      }}
    >
      {/* Board Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h2
          style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
          }}
        >
          My Tasks (Kanban)
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Sort Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Sort:</span>
            <select
              defaultValue="Priority"
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontWeight: 600,
                color: 'var(--text-main)',
              }}
            >
              <option value="Priority">Priority</option>
              <option value="Date">Date Created</option>
              <option value="Version">Version</option>
            </select>
          </div>

          {/* View Mode Icons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-page)',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
              }}
            >
              ☰
            </button>
            <button
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                color: 'var(--primary-blue)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                fontWeight: 700,
              }}
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kanban Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
          gap: '1rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        {COLUMNS.map((col) => {
          const colItems = items.filter((item) => col.statuses.includes(item.status));

          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '480px',
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.65rem',
                  backgroundColor: col.headerBg,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.85rem',
                }}
              >
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: col.textColor }}>
                  {col.title}
                </span>
                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: col.badgeBg,
                    color: col.textColor,
                  }}
                >
                  {colItems.length}
                </span>
              </div>

              {/* Column Cards List */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {colItems.map((item) => {
                  const tagStyle = getTagStyle(item.type);
                  const dotColor = getPriorityDotColor(item.priority);
                  const isUnassigned = !item.assigneeId;
                  const isMine = currentUser && item.assigneeId === currentUser.id;

                  return (
                    <div
                      key={item.id}
                      id={`card-${item.id}`}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.85rem',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                      }}
                      onClick={() => onOpenDrawer(item)}
                    >
                      {/* Top Row: Dot & Title & 3-dots */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: dotColor,
                              flexShrink: 0,
                            }}
                          />
                          <h4
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              lineHeight: 1.3,
                            }}
                          >
                            {item.title}
                          </h4>
                        </div>

                        {/* 3 dots action menu */}
                        <button
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-subtle)',
                            padding: '0 0.2rem',
                            lineHeight: 1,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDrawer(item);
                          }}
                        >
                          ⋮
                        </button>
                      </div>

                      {/* Tag Pill & Concurrency Version */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          marginBottom: '0.65rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            backgroundColor: tagStyle.bg,
                            color: tagStyle.color,
                          }}
                        >
                          {item.type}
                        </span>

                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-code)',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: 'var(--text-muted)',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          v{item.version}
                        </span>
                      </div>

                      {/* Footer Row: Date & Assignee Avatar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.725rem',
                            color: 'var(--text-subtle)',
                            fontWeight: 500,
                          }}
                        >
                          {item.dueDate
                            ? new Date(item.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Aug 18'}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {/* Claim button if unassigned */}
                          {isUnassigned && (
                            <button
                              id={`claim-btn-${item.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClaim(item);
                              }}
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0',
                              }}
                            >
                              ⚡ Claim
                            </button>
                          )}

                          {/* Avatar Circle */}
                          <div
                            title={item.assigneeName || 'Unassigned'}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: isMine
                                ? '#dbeafe'
                                : isUnassigned
                                  ? '#f1f5f9'
                                  : '#fef3c7',
                              color: isMine ? '#1d4ed8' : isUnassigned ? '#94a3b8' : '#b45309',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            {item.assigneeName ? item.assigneeName.charAt(0) : '?'}
                          </div>
                        </div>
                      </div>

                      {/* Transition selector */}
                      <div style={{ marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                        <select
                          id={`quick-transition-${item.id}`}
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onTransition(item.id, e.target.value as WorkItemStatus);
                              e.target.value = '';
                            }
                          }}
                          style={{
                            width: '100%',
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.4rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <option value="" disabled>
                            Move to...
                          </option>
                          {item.status !== 'IN_PROGRESS' && (
                            <option value="IN_PROGRESS">→ In Progress</option>
                          )}
                          {item.status !== 'IN_REVIEW' && (
                            <option value="IN_REVIEW">→ In Review</option>
                          )}
                          {item.status === 'IN_REVIEW' && (
                            <option value="COMPLETED">✓ Approve & Done (Lead Only)</option>
                          )}
                          {item.status !== 'COMPLETED' && item.status !== 'BLOCKED' && (
                            <option value="BLOCKED">⚠ Mark Blocked</option>
                          )}
                          {item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
                            <option value="CANCELLED">✕ Cancel</option>
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom + Add Task inside column */}
              <button
                id={`btn-add-${col.id}`}
                onClick={onOpenCreateModal}
                style={{
                  marginTop: '0.85rem',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#ffffff',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--primary-blue)',
                  fontSize: '0.78rem',
                  fontWeight: 650,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>+</span>
                <span>Add Task</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
