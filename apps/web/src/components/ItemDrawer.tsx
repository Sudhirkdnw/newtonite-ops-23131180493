import React, { useState } from 'react';
import type {
  WorkItemSummaryDTO,
  ActivityEventDTO,
  CommentDTO,
  WorkItemStatus,
} from '@newtonite/shared';

interface ItemDrawerProps {
  item: WorkItemSummaryDTO | null;
  onClose: () => void;
  isLoading: boolean;
  activityHistory: ActivityEventDTO[];
  comments: CommentDTO[];
  onAddComment: (body: string) => Promise<void>;
  onClaim: (item: WorkItemSummaryDTO) => Promise<void>;
  onTransition: (itemId: string, status: WorkItemStatus) => Promise<void>;
  currentUserId?: string;
  isViewer?: boolean;
}

export const ItemDrawer: React.FC<ItemDrawerProps> = ({
  item,
  onClose,
  isLoading,
  activityHistory,
  comments,
  onAddComment,
  onClaim,
  onTransition,
  currentUserId,
  isViewer,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  if (!item) return null;

  const isAssignedToMe = currentUserId && item.assigneeId === currentUserId;
  const isUnassigned = !item.assigneeId;

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-left"
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-subtle)',
                backgroundColor: '#eef2f6',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            >
              #{item.id.slice(0, 8)}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 650,
                color: 'var(--primary-blue)',
                backgroundColor: '#eff6ff',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              v{item.version}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              fontSize: '1.25rem',
              color: 'var(--text-subtle)',
              lineHeight: 1,
              padding: '0.25rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              marginBottom: '0.75rem',
              lineHeight: 1.35,
            }}
          >
            {item.title}
          </h2>

          {/* Metadata badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                backgroundColor: '#f1f5f9',
                color: 'var(--text-muted)',
              }}
            >
              Type: {item.type}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                color: '#ef4444',
              }}
            >
              Priority: {item.priority}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
                color: 'var(--primary-blue)',
              }}
            >
              Status: {item.status}
            </span>
          </div>

          {/* Quick Actions Row */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-subtle)' }}>
                Assignee:
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {item.assigneeName || 'Unassigned'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isUnassigned && !isViewer && (
                <button
                  onClick={() => void onClaim(item)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    backgroundColor: 'var(--primary-blue)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  ⚡ Claim Task
                </button>
              )}
              {isAssignedToMe && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#10b981',
                    padding: '0.4rem 0.6rem',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '4px',
                  }}
                >
                  Assigned to You
                </span>
              )}
            </div>
          </div>

          {/* State Transition Controls */}
          {!isViewer && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Workflow Transitions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(
                  [
                    'TRIAGED',
                    'IN_PROGRESS',
                    'IN_REVIEW',
                    'COMPLETED',
                    'BLOCKED',
                  ] as WorkItemStatus[]
                )
                  .filter((s) => s !== item.status)
                  .map((target) => (
                    <button
                      key={target}
                      onClick={() => void onTransition(item.id, target)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 650,
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                        color: 'var(--text-main)',
                      }}
                    >
                      → {target.replace('_', ' ')}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-subtle)' }}>
              Loading item details...
            </div>
          ) : (
            <>
              {/* Timeline / Activity Section */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>Activity Timeline</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#eef2f6',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '10px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {activityHistory.length}
                  </span>
                </div>

                {activityHistory.length === 0 ? (
                  <div
                    style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}
                  >
                    No activity recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activityHistory.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          fontSize: '0.8rem',
                          borderLeft: '2px solid #e2e8f0',
                          paddingLeft: '0.85rem',
                          paddingBottom: '0.35rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 650, color: 'var(--text-main)' }}>
                            {ev.actorName || 'User'}{' '}
                            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                              performed {ev.action.replace('_', ' ')}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-subtle)',
                              marginTop: '0.15rem',
                            }}
                          >
                            {new Date(ev.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discussion Comments Section */}
              <div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    marginBottom: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>Discussion Comments</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#eef2f6',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '10px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {comments.length}
                  </span>
                </div>

                {comments.length === 0 ? (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-subtle)',
                      fontStyle: 'italic',
                      marginBottom: '1rem',
                    }}
                  >
                    No comments yet. Start the conversation below.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: 'var(--text-main)',
                            }}
                          >
                            {c.authorName}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                            {new Date(c.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.825rem',
                            color: 'var(--text-muted)',
                            lineHeight: 1.45,
                          }}
                        >
                          {c.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment Input */}
                {!isViewer && (
                  <form
                    onSubmit={(e) => void handleCommentSubmit(e)}
                    style={{ marginTop: '0.75rem' }}
                  >
                    <textarea
                      rows={2}
                      placeholder="Write an operational note or update..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{
                        width: '100%',
                        fontSize: '0.85rem',
                        resize: 'none',
                        marginBottom: '0.5rem',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        disabled={isSubmittingComment || !commentText.trim()}
                        style={{
                          padding: '0.4rem 0.9rem',
                          backgroundColor: 'var(--primary-blue)',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
