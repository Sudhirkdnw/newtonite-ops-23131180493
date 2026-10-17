import React, { useEffect, useState, useCallback } from 'react';
import {
  loginUser,
  fetchWorkItems,
  claimWorkItem,
  transitionWorkItem,
  createWorkItem,
  fetchItemActivity,
  fetchItemComments,
  addComment,
  fetchReadiness,
  type UserProfile,
} from '../services/api';
import type {
  WorkItemSummaryDTO,
  ActivityEventDTO,
  CommentDTO,
  WorkItemStatus,
  Priority,
  WorkItemType,
} from '@newtonite/shared';

const DEMO_PERSONAS = [
  { name: 'Bob Lead', email: 'bob.lead@newtonite.dev', role: 'LEAD', team: 'Core Operations' },
  {
    name: 'Evan Member',
    email: 'evan.member@newtonite.dev',
    role: 'MEMBER',
    team: 'Core Operations',
  },
  {
    name: 'Ian Viewer',
    email: 'ian.viewer@newtonite.dev',
    role: 'VIEWER',
    team: 'Core Operations',
  },
  {
    name: 'Alice Admin',
    email: 'alice.admin@newtonite.dev',
    role: 'ADMIN',
    team: 'Platform & Operations',
  },
];

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // System status
  const [systemReady, setSystemReady] = useState<boolean | null>(null);
  const [dbLatency, setDbLatency] = useState<number | undefined>(undefined);

  // Work items state
  const [items, setItems] = useState<WorkItemSummaryDTO[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast / Notification
  const [toast, setToast] = useState<{
    type: 'success' | 'conflict' | 'forbidden' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  // Selected item drawer (activity & comments)
  const [activeDrawerItem, setActiveDrawerItem] = useState<WorkItemSummaryDTO | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityEventDTO[]>([]);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [newCommentBody, setNewCommentBody] = useState<string>('');

  // Create Item Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<WorkItemType>('INCIDENT' as WorkItemType);
  const [newPriority, setNewPriority] = useState<Priority>('HIGH' as Priority);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Auto-clear toast after 6s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initial login with Bob Lead
  const handleLoginAs = useCallback(async (email: string) => {
    try {
      setAuthLoading(true);
      const auth = await loginUser(email);
      setToken(auth.token);
      setCurrentUser(auth.user);
      setToast({
        type: 'success',
        message: `Switched persona to ${auth.user.name} (${auth.user.memberships[0]?.role || 'ADMIN'})`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: `Login failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Poll system health
  useEffect(() => {
    async function checkSys() {
      try {
        const r = await fetchReadiness();
        setSystemReady(r.status === 'ready');
        setDbLatency(r.latencyMs);
      } catch {
        setSystemReady(false);
      }
    }
    void checkSys();
    const interval = setInterval(() => void checkSys(), 15000);
    return () => clearInterval(interval);
  }, []);

  // Mount: login as default demo user (Bob Lead)
  useEffect(() => {
    void handleLoginAs('bob.lead@newtonite.dev');
  }, [handleLoginAs]);

  // Load items when token or filters change
  const loadItems = useCallback(async () => {
    if (!token) return;
    try {
      setItemsLoading(true);
      const res = await fetchWorkItems(token, {
        status: selectedStatus,
        priority: selectedPriority,
        search: searchQuery,
      });
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load work items', err);
    } finally {
      setItemsLoading(false);
    }
  }, [token, selectedStatus, selectedPriority, searchQuery]);

  useEffect(() => {
    if (token) {
      void loadItems();
    }
  }, [token, loadItems]);

  // Claim Item action with optimistic update & 409 conflict detection
  const handleClaim = async (item: WorkItemSummaryDTO) => {
    if (!token || !currentUser) return;

    // Snapshot
    const previous = [...items];

    // Optimistically update
    setItems((curr) =>
      curr.map((i) =>
        i.id === item.id
          ? {
              ...i,
              assigneeId: currentUser.id,
              assigneeName: currentUser.name,
              status:
                i.status === 'BACKLOG' || i.status === 'TRIAGED'
                  ? ('IN_PROGRESS' as WorkItemStatus)
                  : i.status,
              version: i.version + 1,
            }
          : i
      )
    );

    try {
      const updated = await claimWorkItem(token, item.id);
      setItems((curr) => curr.map((i) => (i.id === item.id ? updated : i)));
      setToast({
        type: 'success',
        message: `Successfully claimed "${item.title}"`,
      });
    } catch (err: unknown) {
      // Rollback
      setItems(previous);
      const errorObj = err as {
        status?: number;
        message?: string;
        details?: { claimedBy?: string };
      };

      if (errorObj.status === 409) {
        setToast({
          type: 'conflict',
          message: `409 Conflict: ${errorObj.message || 'Item was already claimed'}`,
          details: errorObj.details?.claimedBy
            ? `Currently assigned to ${errorObj.details.claimedBy}`
            : undefined,
        });
      } else if (errorObj.status === 403) {
        setToast({
          type: 'forbidden',
          message: `403 Forbidden: Viewers do not have permission to claim work items`,
          details: 'Switch to Evan Member or Bob Lead to claim.',
        });
      } else {
        setToast({
          type: 'error',
          message: errorObj.message || 'Failed to claim work item',
        });
      }
    }
  };

  // Transition state action
  const handleTransition = async (itemId: string, targetStatus: WorkItemStatus) => {
    if (!token) return;

    try {
      const updated = await transitionWorkItem(token, itemId, targetStatus);
      setItems((curr) => curr.map((i) => (i.id === itemId ? updated : i)));
      setToast({
        type: 'success',
        message: `Transitioned status to ${targetStatus}`,
      });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj.status === 403) {
        setToast({
          type: 'forbidden',
          message: `403 Forbidden: Workflow approval requires Lead or Admin role`,
          details: 'Members cannot complete items in review. Switch to Bob Lead to approve.',
        });
      } else {
        setToast({
          type: 'error',
          message: errorObj.message || 'Transition rejected by workflow state machine',
        });
      }
    }
  };

  // Open item drawer
  const handleOpenDrawer = async (item: WorkItemSummaryDTO) => {
    setActiveDrawerItem(item);
    if (!token) return;
    setDrawerLoading(true);
    try {
      const [act, com] = await Promise.all([
        fetchItemActivity(token, item.id),
        fetchItemComments(token, item.id),
      ]);
      setActivityHistory(act);
      setComments(com);
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeDrawerItem || !newCommentBody.trim()) return;

    try {
      const created = await addComment(token, activeDrawerItem.id, newCommentBody.trim());
      setComments((curr) => [...curr, created]);
      setNewCommentBody('');
      setToast({ type: 'success', message: 'Comment posted to item discussion' });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj.status === 403) {
        setToast({
          type: 'forbidden',
          message: '403 Forbidden: Viewers cannot post comments',
        });
      } else {
        setToast({
          type: 'error',
          message: errorObj.message || 'Failed to post comment',
        });
      }
    }
  };

  // Create Item Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentUser || !newTitle.trim()) return;

    const userTeamId = currentUser.memberships[0]?.teamId;
    if (!userTeamId) {
      setToast({ type: 'error', message: 'User does not belong to any team' });
      return;
    }

    setCreateSubmitting(true);
    try {
      const idempKey = `web-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const created = await createWorkItem(
        token,
        {
          teamId: userTeamId,
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          type: newType,
          priority: newPriority,
        },
        idempKey
      );

      setItems((curr) => [created, ...curr]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setToast({
        type: 'success',
        message: `Created work item "${created.title}" (Version 1)`,
      });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj.status === 403) {
        setToast({
          type: 'forbidden',
          message: '403 Forbidden: Viewers cannot create work items',
        });
      } else {
        setToast({
          type: 'error',
          message: errorObj.message || 'Failed to create work item',
        });
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      BACKLOG: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: 'BACKLOG' },
      TRIAGED: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', label: 'TRIAGED' },
      IN_PROGRESS: { bg: 'rgba(59, 130, 246, 0.25)', color: '#38bdf8', label: 'IN PROGRESS' },
      BLOCKED: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', label: 'BLOCKED' },
      IN_REVIEW: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', label: 'IN REVIEW' },
      COMPLETED: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', label: 'COMPLETED' },
      CANCELLED: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'CANCELLED' },
    };
    return map[status] || { bg: 'rgba(255,255,255,0.1)', color: '#fff', label: status };
  };

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      CRITICAL: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
      URGENT: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
      HIGH: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
      MEDIUM: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
      LOW: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
    };
    return map[priority] || { color: '#94a3b8', bg: 'rgba(255,255,255,0.05)' };
  };

  return (
    <div className="container">
      {/* Toast Notification */}
      {toast && (
        <div
          id="toast-notification"
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            backgroundColor:
              toast.type === 'success'
                ? '#064e3b'
                : toast.type === 'conflict'
                  ? '#7c2d12'
                  : toast.type === 'forbidden'
                    ? '#701a75'
                    : '#7f1d1d',
            border: `1px solid ${
              toast.type === 'success'
                ? '#10b981'
                : toast.type === 'conflict'
                  ? '#f97316'
                  : toast.type === 'forbidden'
                    ? '#d946ef'
                    : '#ef4444'
            }`,
            color: '#fff',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '420px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                {toast.type === 'conflict'
                  ? '⚡ Claim Conflict (HTTP 409)'
                  : toast.type === 'forbidden'
                    ? '🔒 Access Denied (HTTP 403)'
                    : toast.type === 'success'
                      ? '✓ Operation Succeeded'
                      : '⚠ Action Error'}
              </div>
              <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.95 }}>
                {toast.message}
              </div>
              {toast.details && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    marginTop: '0.35rem',
                    opacity: 0.8,
                    fontStyle: 'italic',
                  }}
                >
                  {toast.details}
                </div>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ color: '#fff', opacity: 0.7, fontSize: '1.1rem', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              Newtonite Ops
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              MISSION CRITICAL
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Operations Under Pressure — High-Concurrency Operational Workflow Engine
          </p>
        </div>

        {/* System Health Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: systemReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${systemReady ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <span
              className="pulse-dot"
              style={{
                backgroundColor: systemReady ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            />
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: systemReady ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {systemReady
                ? `LIVE SYSTEM OPERATIONAL${dbLatency !== undefined ? ` (${dbLatency}ms)` : ''}`
                : 'DEGRADED'}
            </span>
          </div>
        </div>
      </header>

      {/* Demo Persona Switcher Bar */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              Active Security Persona (Role-Based Access Control)
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}
            >
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {authLoading ? 'Authenticating...' : currentUser?.name}
              </span>
              {currentUser && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      currentUser.memberships[0]?.role === 'LEAD'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : currentUser.memberships[0]?.role === 'ADMIN'
                          ? 'rgba(139, 92, 246, 0.2)'
                          : currentUser.memberships[0]?.role === 'VIEWER'
                            ? 'rgba(100, 116, 139, 0.2)'
                            : 'rgba(59, 130, 246, 0.2)',
                    color:
                      currentUser.memberships[0]?.role === 'LEAD'
                        ? '#fbbf24'
                        : currentUser.memberships[0]?.role === 'ADMIN'
                          ? '#c084fc'
                          : currentUser.memberships[0]?.role === 'VIEWER'
                            ? '#94a3b8'
                            : '#60a5fa',
                  }}
                >
                  {currentUser.memberships[0]?.role || 'ADMIN'}
                </span>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                • {currentUser?.memberships[0]?.teamName || 'All Scoped Teams'}
              </span>
            </div>
          </div>

          {/* Quick Persona Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {DEMO_PERSONAS.map((p) => {
              const isActive = currentUser?.email === p.email;
              return (
                <button
                  key={p.email}
                  id={`btn-persona-${p.role.toLowerCase()}`}
                  onClick={() => void handleLoginAs(p.email)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    backgroundColor: isActive
                      ? 'var(--color-primary)'
                      : 'var(--bg-surface-elevated)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {p.name} ({p.role})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter and Action Bar */}
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          {/* Status Filter */}
          <select
            id="filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="BACKLOG">Backlog</option>
            <option value="TRIAGED">Triaged</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="IN_REVIEW">In Review (Approval Required)</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            id="filter-priority"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical (P0)</option>
            <option value="URGENT">Urgent (P1)</option>
            <option value="HIGH">High (P2)</option>
            <option value="MEDIUM">Medium (P3)</option>
            <option value="LOW">Low (P4)</option>
          </select>

          {/* Search Query */}
          <input
            id="search-input"
            type="text"
            placeholder="Search items by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '0.85rem', width: '220px' }}
          />

          <button
            id="btn-refresh"
            onClick={() => void loadItems()}
            style={{
              padding: '0.5rem 0.85rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Create Work Item Trigger */}
        <button
          id="btn-create-item"
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            padding: '0.55rem 1.15rem',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          + New Work Item
        </button>
      </section>

      {/* Main Operations Board Grid */}
      <main>
        {itemsLoading && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            Loading mission-critical operational items...
          </div>
        )}

        {!itemsLoading && items.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 600 }}>
              No work items match the selected filters
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
              Create a new work item or adjust your status/priority filters.
            </p>
          </div>
        )}

        {!itemsLoading && items.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {items.map((item) => {
              const statusBadge = getStatusBadge(item.status);
              const priorityBadge = getPriorityBadge(item.priority);
              const isClaimedByMe = currentUser && item.assigneeId === currentUser.id;
              const isUnassigned = item.assigneeId === null;

              return (
                <div
                  key={item.id}
                  id={`item-card-${item.id}`}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    {/* Header Badges */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: priorityBadge.bg,
                            color: priorityBadge.color,
                          }}
                        >
                          {item.priority}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {item.type}
                        </span>
                      </div>

                      {/* Optimistic Version Pill */}
                      <span
                        title="Optimistic Concurrency Version"
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--color-primary)',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                        }}
                      >
                        v{item.version}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '1rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </p>
                    )}

                    {/* Status & Assignee Info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.75rem',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: isUnassigned ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}
                      >
                        {isUnassigned ? (
                          <span style={{ fontStyle: 'italic' }}>Unassigned</span>
                        ) : (
                          <span
                            style={{
                              fontWeight: 600,
                              color: isClaimedByMe ? 'var(--color-success)' : 'inherit',
                            }}
                          >
                            👤 {item.assigneeName || 'Assigned'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {/* Atomic Claim Button */}
                      {isUnassigned && (
                        <button
                          id={`btn-claim-${item.id}`}
                          onClick={() => void handleClaim(item)}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: 'var(--color-success)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          ⚡ Claim Item
                        </button>
                      )}

                      {/* State Machine Transition Dropdown */}
                      <select
                        id={`select-transition-${item.id}`}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            void handleTransition(item.id, e.target.value as WorkItemStatus);
                            e.target.value = '';
                          }
                        }}
                        style={{
                          flex: 1,
                          fontSize: '0.8rem',
                          padding: '0.45rem',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <option value="" disabled>
                          Transition to...
                        </option>
                        {item.status !== 'IN_PROGRESS' && (
                          <option value="IN_PROGRESS">→ In Progress</option>
                        )}
                        {item.status !== 'IN_REVIEW' && (
                          <option value="IN_REVIEW">→ In Review</option>
                        )}
                        {item.status === 'IN_REVIEW' && (
                          <option value="COMPLETED">✓ Approve & Complete (Lead Only)</option>
                        )}
                        {item.status !== 'BLOCKED' && item.status !== 'COMPLETED' && (
                          <option value="BLOCKED">⚠ Mark Blocked</option>
                        )}
                        {item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
                          <option value="CANCELLED">✕ Cancel</option>
                        )}
                      </select>
                    </div>

                    {/* Timeline & Discussion Trigger */}
                    <button
                      id={`btn-drawer-${item.id}`}
                      onClick={() => void handleOpenDrawer(item)}
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      💬 Timeline & Discussion
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Slide-over Activity & Comments Drawer */}
      {activeDrawerItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setActiveDrawerItem(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-surface)',
              height: '100%',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  ITEM #{activeDrawerItem.id.slice(0, 8)} • v{activeDrawerItem.version}
                </span>
                <h2
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    marginTop: '0.2rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {activeDrawerItem.title}
                </h2>
              </div>
              <button
                id="btn-close-drawer"
                onClick={() => setActiveDrawerItem(null)}
                style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {drawerLoading && (
                <p style={{ color: 'var(--text-muted)' }}>Loading timeline & discussion...</p>
              )}

              {!drawerLoading && (
                <>
                  {/* Append-Only Activity Log Section */}
                  <h4
                    style={{
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                    }}
                  >
                    Immutable Activity Timeline
                  </h4>
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    {activityHistory.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          padding: '0.6rem 0.8rem',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                            {act.action}
                          </span>
                          <span style={{ fontSize: '0.75rem' }}>
                            {new Date(act.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: '0.2rem',
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                          }}
                        >
                          Actor: {act.actorName || 'System Worker'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comments Discussion Section */}
                  <h4
                    style={{
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                    }}
                  >
                    Team Discussion ({comments.length})
                  </h4>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    {comments.length === 0 && (
                      <p
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontStyle: 'italic',
                        }}
                      >
                        No comments yet on this operational item.
                      </p>
                    )}
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginBottom: '0.25rem',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.authorName}
                          </span>
                          <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Post Comment Input */}
            <form
              onSubmit={(e) => void handleAddComment(e)}
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '0.5rem',
              }}
            >
              <input
                id="input-comment"
                type="text"
                placeholder="Post a comment..."
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button
                id="btn-post-comment"
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Work Item Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: 'var(--text-primary)',
              }}
            >
              Create Mission-Critical Work Item
            </h3>

            <form
              onSubmit={(e) => void handleCreateSubmit(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Title *
                </label>
                <input
                  id="create-item-title"
                  type="text"
                  required
                  placeholder="e.g. Payment gateway 5xx spike"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Description
                </label>
                <textarea
                  id="create-item-desc"
                  rows={3}
                  placeholder="Operational context and impact..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Type
                  </label>
                  <select
                    id="create-item-type"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as WorkItemType)}
                    style={{ width: '100%' }}
                  >
                    <option value="INCIDENT">INCIDENT</option>
                    <option value="CUSTOMER_ISSUE">CUSTOMER_ISSUE</option>
                    <option value="PAYMENT">PAYMENT</option>
                    <option value="COMPLIANCE">COMPLIANCE</option>
                    <option value="TASK">TASK</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Priority
                  </label>
                  <select
                    id="create-item-priority"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    style={{ width: '100%' }}
                  >
                    <option value="CRITICAL">CRITICAL (P0)</option>
                    <option value="URGENT">URGENT (P1)</option>
                    <option value="HIGH">HIGH (P2)</option>
                    <option value="MEDIUM">MEDIUM (P3)</option>
                    <option value="LOW">LOW (P4)</option>
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
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-create"
                  type="submit"
                  disabled={createSubmitting}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                  }}
                >
                  {createSubmitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
