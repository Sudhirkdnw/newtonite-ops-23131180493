import React, { useState, useEffect, useCallback } from 'react';
import type { WorkItemSummaryDTO, ActivityEventDTO, CommentDTO } from '@newtonite/shared';
import {
  fetchWorkItemById,
  fetchItemActivity,
  fetchItemComments,
  addComment,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, TypeBadge } from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';

interface WorkItemDetailPageProps {
  itemId: string;
  onBack: () => void;
  onClaimItem: (item: WorkItemSummaryDTO) => Promise<void>;
  onOpenTransition: (item: WorkItemSummaryDTO) => void;
  onOpenEdit: (item: WorkItemSummaryDTO) => void;
}

export const WorkItemDetailPage: React.FC<WorkItemDetailPageProps> = ({
  itemId,
  onBack,
  onClaimItem,
  onOpenTransition,
  onOpenEdit,
}) => {
  const { token, currentUser } = useAuth();

  const [item, setItem] = useState<WorkItemSummaryDTO | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityEventDTO[]>([]);
  const [comments, setComments] = useState<CommentDTO[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Comment input
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const loadItemDetails = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [itemData, actData, comData] = await Promise.all([
        fetchWorkItemById(token, itemId),
        fetchItemActivity(token, itemId),
        fetchItemComments(token, itemId).catch(() => []),
      ]);
      setItem(itemData);
      setActivityHistory(actData);
      setComments(comData);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load work item details');
    } finally {
      setIsLoading(false);
    }
  }, [token, itemId]);

  useEffect(() => {
    void loadItemDetails();
  }, [loadItemDetails]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newComment.trim() || isPostingComment) return;

    setIsPostingComment(true);
    setCommentError(null);

    try {
      const created = await addComment(token, itemId, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment('');
      // Refetch activity log so comment addition appears in timeline
      const freshActivity = await fetchItemActivity(token, itemId);
      setActivityHistory(freshActivity);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number };
      if (errorObj.status === 403) {
        setCommentError('Forbidden: Viewers do not have permission to comment on work items.');
      } else {
        setCommentError(errorObj.message || 'Failed to post comment.');
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  const isViewer = currentUser?.memberships[0]?.role === 'VIEWER';
  const isAssignedToMe = item && currentUser && item.assigneeId === currentUser.id;
  const isUnassigned = item && !item.assigneeId;

  if (isLoading) {
    return (
      <div style={{ padding: '2rem 0' }}>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          border: '1px solid var(--border-color)',
          textAlign: 'center',
        }}
      >
        <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Error Loading Work Item</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          {error || 'Item not found or inaccessible.'}
        </p>
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--primary-blue)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 650,
          }}
        >
          ← Return to Registry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back button & Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <button
          id="btn-back-to-list"
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: 650,
            color: 'var(--text-muted)',
            padding: '0.4rem 0.75rem',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
          }}
        >
          ← Back to Work Items
        </button>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {isUnassigned && !isViewer && (
            <button
              id="btn-claim-detail"
              onClick={async () => {
                await onClaimItem(item);
                void loadItemDetails();
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 700,
              }}
            >
              ⚡ Claim Work Item
            </button>
          )}

          {!isViewer && (
            <button
              id="btn-transition-detail"
              onClick={() => onOpenTransition(item)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--primary-blue)',
                color: '#ffffff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 700,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              Transition Status →
            </button>
          )}

          {!isViewer && (
            <button
              id="btn-edit-detail"
              onClick={() => onOpenEdit(item)}
              style={{
                padding: '0.5rem 0.85rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                fontWeight: 650,
                color: 'var(--text-main)',
              }}
            >
              ✏ Edit Item
            </button>
          )}
        </div>
      </div>

      {/* Main Details Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Badges & Version Row */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}
        >
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
          <TypeBadge type={item.type} />
          <span
            style={{
              fontSize: '0.725rem',
              fontFamily: 'var(--font-code)',
              fontWeight: 700,
              backgroundColor: '#eff6ff',
              color: 'var(--primary-blue)',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              border: '1px solid #bfdbfe',
            }}
          >
            Version v{item.version}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>
            ID: <code style={{ fontFamily: 'var(--font-code)' }}>{item.id}</code>
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            marginBottom: '0.85rem',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </h1>

        {/* Description */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h3
            style={{
              fontSize: '0.8rem',
              fontWeight: 750,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.4rem',
            }}
          >
            Description & Investigation Context
          </h3>
          <p
            style={{
              fontSize: '0.9rem',
              color: item.description ? 'var(--text-main)' : 'var(--text-subtle)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.description || 'No detailed description provided for this work item.'}
          </p>
        </div>

        {/* Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.825rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Team Scoping
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
              {item.teamName || 'Operational Team'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Current Assignee
            </div>
            <div
              style={{
                fontWeight: 700,
                color: item.assigneeName ? 'var(--text-main)' : 'var(--text-subtle)',
                marginTop: '0.15rem',
              }}
            >
              {item.assigneeName || 'Unassigned'}
              {isAssignedToMe && (
                <span style={{ fontSize: '0.7rem', color: '#10b981', marginLeft: '0.35rem' }}>
                  (You)
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Created By
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
              {item.creatorName || 'System'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Target Due Date
            </div>
            <div
              style={{
                fontWeight: 700,
                color: item.dueDate ? 'var(--text-main)' : 'var(--text-subtle)',
                marginTop: '0.15rem',
              }}
            >
              {item.dueDate ? new Date(item.dueDate).toLocaleString() : 'Not Set'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Registered On
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
              {new Date(item.createdAt).toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.725rem', fontWeight: 600 }}>
              Last State Mutation
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>
              {new Date(item.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 2 Columns: Activity Timeline & Discussion Comments */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Immutable Activity Timeline */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Audit Activity Timeline
            </h2>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                color: 'var(--text-muted)',
              }}
            >
              {activityHistory.length} events
            </span>
          </div>

          {activityHistory.length === 0 ? (
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-subtle)',
                fontStyle: 'italic',
                padding: '1rem 0',
              }}
            >
              No recorded activity events.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activityHistory.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderLeft: '2px solid var(--border-color)',
                    paddingLeft: '1rem',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {ev.actorName || 'System'}{' '}
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                      performed {ev.action.replace('_', ' ')}
                    </span>
                  </div>

                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--bg-subtle)',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '4px',
                        marginTop: '0.35rem',
                        fontFamily: 'var(--font-code)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: '0.725rem',
                      color: 'var(--text-subtle)',
                      marginTop: '0.25rem',
                    }}
                  >
                    {new Date(ev.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Discussion Comments */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Operational Discussion
            </h2>
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                color: 'var(--text-muted)',
              }}
            >
              {comments.length} comments
            </span>
          </div>

          {/* Comments List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              marginBottom: '1.25rem',
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            {comments.length === 0 ? (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-subtle)',
                  fontStyle: 'italic',
                  padding: '1rem 0',
                }}
              >
                No comments yet. Post an operational update below.
              </div>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
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
                      style={{ fontWeight: 750, fontSize: '0.825rem', color: 'var(--text-main)' }}
                    >
                      {c.authorName}
                    </span>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-main)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {c.body}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment Form */}
          {commentError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              ⚠ {commentError}
            </div>
          )}

          {!isViewer ? (
            <form
              onSubmit={(e) => void handlePostComment(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <textarea
                id="input-comment-body"
                rows={3}
                placeholder="Write an operational note, finding, or handover update..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  id="btn-post-comment"
                  type="submit"
                  disabled={isPostingComment || !newComment.trim()}
                  style={{
                    padding: '0.45rem 1rem',
                    backgroundColor: 'var(--primary-blue)',
                    color: '#ffffff',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    opacity: isPostingComment || !newComment.trim() ? 0.6 : 1,
                  }}
                >
                  {isPostingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          ) : (
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-subtle)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}
            >
              🔒 Viewers hold read-only permissions and cannot post comments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
