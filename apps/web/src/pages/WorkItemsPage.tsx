import React, { useState, useEffect, useCallback } from 'react';
import type { WorkItemSummaryDTO } from '@newtonite/shared';
import { fetchWorkItems } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, TypeBadge, SlaBadge } from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

interface WorkItemsPageProps {
  onSelectItem: (item: WorkItemSummaryDTO) => void;
  onOpenCreate: () => void;
  onClaimItem: (item: WorkItemSummaryDTO) => Promise<void>;
  onOpenTransition: (item: WorkItemSummaryDTO) => void;
  onOpenEdit: (item: WorkItemSummaryDTO) => void;
}

export const WorkItemsPage: React.FC<WorkItemsPageProps> = ({
  onSelectItem,
  onOpenCreate,
  onClaimItem,
  onOpenTransition,
  onOpenEdit,
}) => {
  const { token, currentUser } = useAuth();

  // Filter states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [teamId, setTeamId] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<'ALL' | 'ME' | 'UNASSIGNED'>('ALL');
  const [limit, setLimit] = useState<number>(20);

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Data states
  const [items, setItems] = useState<WorkItemSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Set default team
  useEffect(() => {
    if (currentUser && currentUser.memberships.length > 0 && !teamId) {
      setTeamId(currentUser.memberships[0].teamId);
    }
  }, [currentUser, teamId]);

  const loadItems = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const assigneeId = assigneeFilter === 'ME' ? currentUser?.id : undefined;

      const res = await fetchWorkItems(token, {
        teamId: teamId || undefined,
        status: status !== 'ALL' ? status : undefined,
        priority: priority !== 'ALL' ? priority : undefined,
        type: type !== 'ALL' ? type : undefined,
        assigneeId,
        search: search.trim() || undefined,
        cursor,
        limit,
      });

      // If filtering for UNASSIGNED on frontend (since backend query supports assigneeId=uuid)
      let resultItems = res.items;
      if (assigneeFilter === 'UNASSIGNED') {
        resultItems = resultItems.filter((i) => !i.assigneeId);
      }

      setItems(resultItems);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to query work items from server');
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUser, teamId, status, priority, type, assigneeFilter, search, cursor, limit]);

  // Load when filters or cursor changes
  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(undefined);
    setCursorStack([]);
    void loadItems();
  };

  const handleFilterChange = () => {
    setCursor(undefined);
    setCursorStack([]);
  };

  const handleNextPage = () => {
    if (nextCursor && hasMore) {
      setCursorStack((prev) => [...prev, cursor]);
      setCursor(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorStack.length > 0) {
      const prevCursor = cursorStack[cursorStack.length - 1];
      setCursorStack((prev) => prev.slice(0, prev.length - 1));
      setCursor(prevCursor);
    }
  };

  const isViewer = currentUser?.memberships[0]?.role === 'VIEWER';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}
          >
            Work Items Registry
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Filterable enterprise operational backlog with server-side cursor pagination.
          </p>
        </div>

        <button
          id="btn-list-create-item"
          onClick={onOpenCreate}
          style={{
            padding: '0.55rem 1.15rem',
            backgroundColor: 'var(--primary-blue)',
            color: '#ffffff',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            fontWeight: 700,
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
          }}
        >
          + Create Work Item
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-subtle)',
              }}
            >
              🔍
            </span>
            <input
              id="work-item-search"
              type="text"
              placeholder="Search by title or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.25rem', fontSize: '0.85rem' }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--primary-blue)',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              fontWeight: 650,
            }}
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                handleFilterChange();
              }}
              style={{
                padding: '0.5rem 0.85rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                color: 'var(--text-muted)',
              }}
            >
              Clear
            </button>
          )}
        </form>

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          {/* Team Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label
              htmlFor="filter-team"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Team:
            </label>
            <select
              id="filter-team"
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            >
              {currentUser?.memberships.map((m) => (
                <option key={m.teamId} value={m.teamId}>
                  {m.teamName} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label
              htmlFor="filter-status"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Status:
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="TRIAGED">Triaged</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label
              htmlFor="filter-priority"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Priority:
            </label>
            <select
              id="filter-priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical (P0)</option>
              <option value="URGENT">Urgent (P1)</option>
              <option value="HIGH">High (P2)</option>
              <option value="MEDIUM">Medium (P3)</option>
              <option value="LOW">Low (P4)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label
              htmlFor="filter-type"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Type:
            </label>
            <select
              id="filter-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="ALL">All Types</option>
              <option value="TASK">Task</option>
              <option value="INCIDENT">Incident</option>
              <option value="CUSTOMER_ISSUE">Customer Issue</option>
              <option value="PAYMENT">Payment</option>
              <option value="COMPLIANCE">Compliance</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <label
              htmlFor="filter-assignee"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Assignee:
            </label>
            <select
              id="filter-assignee"
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value as 'ALL' | 'ME' | 'UNASSIGNED');
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
            >
              <option value="ALL">All Assignees</option>
              <option value="ME">Assigned to Me</option>
              <option value="UNASSIGNED">Unassigned Only</option>
            </select>
          </div>

          {/* Limit selector */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}
          >
            <label
              htmlFor="filter-limit"
              style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Page Size:
            </label>
            <select
              id="filter-limit"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                handleFilterChange();
              }}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Query Error:</strong> {error}
          </div>
          <button
            onClick={() => void loadItems()}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: '#dc2626',
              color: '#fff',
              borderRadius: '4px',
              fontWeight: 650,
              fontSize: '0.75rem',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && <TableSkeleton rows={limit > 10 ? 10 : limit} />}

      {/* Work Items Table */}
      {!isLoading && !error && (
        <>
          {items.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No work items match your query"
              description="Try adjusting your status, priority, or search term filters, or create a new operational item."
              actionText="+ Create Work Item"
              onAction={onOpenCreate}
            />
          ) : (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>SLA Deadline</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Title & Scope</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Assignee</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Updated</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isUnassigned = !item.assigneeId;

                    return (
                      <tr
                        key={item.id}
                        id={`row-${item.id}`}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s ease',
                        }}
                        onClick={() => onSelectItem(item)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <StatusBadge status={item.status} />
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <SlaBadge sla={item.sla} />
                        </td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '320px' }}>
                          <div
                            style={{ fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.725rem',
                              color: 'var(--text-subtle)',
                              fontFamily: 'var(--font-code)',
                            }}
                          >
                            #{item.id.slice(0, 8)}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <TypeBadge type={item.type} />
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontWeight: 650,
                              color: item.assigneeName ? 'var(--text-main)' : 'var(--text-subtle)',
                            }}
                          >
                            {item.assigneeName || 'Unassigned'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-code)',
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            v{item.version}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.75rem 1rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-subtle)',
                          }}
                        >
                          {new Date(item.updatedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td
                          style={{ padding: '0.75rem 1rem', textAlign: 'right' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.4rem',
                            }}
                          >
                            {/* Claim button */}
                            {isUnassigned && !isViewer && (
                              <button
                                id={`claim-row-${item.id}`}
                                onClick={() => void onClaimItem(item)}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  backgroundColor: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                }}
                              >
                                ⚡ Claim
                              </button>
                            )}

                            {/* Transition button */}
                            {!isViewer && (
                              <button
                                id={`transition-row-${item.id}`}
                                onClick={() => onOpenTransition(item)}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                  color: 'var(--text-main)',
                                }}
                              >
                                Move →
                              </button>
                            )}

                            {/* Edit button */}
                            {!isViewer && (
                              <button
                                id={`edit-row-${item.id}`}
                                onClick={() => onOpenEdit(item)}
                                style={{
                                  padding: '0.25rem 0.45rem',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                ✏
                              </button>
                            )}

                            {/* View button */}
                            <button
                              id={`view-row-${item.id}`}
                              onClick={() => onSelectItem(item)}
                              style={{
                                padding: '0.25rem 0.55rem',
                                backgroundColor: 'var(--primary-blue-light)',
                                color: 'var(--primary-blue)',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                              }}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Cursor Pagination Navigation Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-subtle)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <div>
                  Showing <strong>{items.length}</strong> items • Page{' '}
                  <strong>{cursorStack.length + 1}</strong>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    id="btn-prev-page"
                    onClick={handlePrevPage}
                    disabled={cursorStack.length === 0}
                    style={{
                      padding: '0.35rem 0.85rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 650,
                      color: cursorStack.length === 0 ? 'var(--text-subtle)' : 'var(--text-main)',
                      cursor: cursorStack.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    id="btn-next-page"
                    onClick={handleNextPage}
                    disabled={!hasMore}
                    style={{
                      padding: '0.35rem 0.85rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 650,
                      color: !hasMore ? 'var(--text-subtle)' : 'var(--text-main)',
                      cursor: !hasMore ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
