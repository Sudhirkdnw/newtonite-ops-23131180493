import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MetricCards } from '../components/MetricCards';
import { KanbanBoard } from '../components/KanbanBoard';
import { RightSidebar } from '../components/RightSidebar';
import { BottomWidgets } from '../components/BottomWidgets';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { ItemDrawer } from '../components/ItemDrawer';

export const App: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('tasks');

  // System status
  const [systemReady, setSystemReady] = useState<boolean | null>(null);
  const [dbLatency, setDbLatency] = useState<number | undefined>(undefined);

  // Work items state
  const [items, setItems] = useState<WorkItemSummaryDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast / Notification
  const [toast, setToast] = useState<{
    type: 'success' | 'conflict' | 'forbidden' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  // Drawer state (Item details, history, comments)
  const [activeDrawerItem, setActiveDrawerItem] = useState<WorkItemSummaryDTO | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityEventDTO[]>([]);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  // Create Task Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  // Auto-clear toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Persona switcher handler
  const handleLoginAs = useCallback(async (email: string) => {
    try {
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

  // Load items when token changes
  const loadItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchWorkItems(token);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load work items', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadItems();
    }
  }, [token, loadItems]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        (item.assigneeName && item.assigneeName.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Atomic Claim Work-Item with optimistic update & 409 conflict detection
  const handleClaim = async (item: WorkItemSummaryDTO) => {
    if (!token || !currentUser) return;

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
      if (activeDrawerItem?.id === item.id) {
        setActiveDrawerItem(updated);
      }
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

  // State Transition with Lead approval validation (403 check)
  const handleTransition = async (itemId: string, targetStatus: WorkItemStatus) => {
    if (!token) return;

    try {
      const updated = await transitionWorkItem(token, itemId, targetStatus);
      setItems((curr) => curr.map((i) => (i.id === itemId ? updated : i)));
      if (activeDrawerItem?.id === itemId) {
        setActiveDrawerItem(updated);
      }
      setToast({
        type: 'success',
        message: `Transitioned status to ${targetStatus.replace('_', ' ')}`,
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

  // Add Comment inside drawer
  const handleAddComment = async (body: string) => {
    if (!token || !activeDrawerItem) return;

    try {
      const created = await addComment(token, activeDrawerItem.id, body);
      setComments((curr) => [...curr, created]);
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

  // Create Task Submit
  const handleCreateTask = async (data: {
    title: string;
    description?: string;
    type: WorkItemType;
    priority: Priority;
  }) => {
    if (!token || !currentUser) return;

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
          title: data.title,
          description: data.description,
          type: data.type,
          priority: data.priority,
        },
        idempKey
      );

      setItems((curr) => [created, ...curr]);
      setIsCreateModalOpen(false);
      setToast({
        type: 'success',
        message: `Created task "${created.title}" (v1)`,
      });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj.status === 403) {
        setToast({
          type: 'forbidden',
          message: '403 Forbidden: Viewers cannot create tasks',
        });
      } else {
        setToast({
          type: 'error',
          message: errorObj.message || 'Failed to create task',
        });
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      {/* Toast Notification Box */}
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
            boxShadow: 'var(--shadow-popover)',
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
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {toast.type === 'conflict'
                  ? '⚡ Claim Conflict (HTTP 409)'
                  : toast.type === 'forbidden'
                    ? '🔒 Access Denied (HTTP 403)'
                    : toast.type === 'success'
                      ? '✓ Success'
                      : '⚠ Action Error'}
              </div>
              <div style={{ fontSize: '0.825rem', marginTop: '0.25rem', opacity: 0.95 }}>
                {toast.message}
              </div>
              {toast.details && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    marginTop: '0.35rem',
                    opacity: 0.85,
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
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Left Navigation Sidebar */}
      <Sidebar
        currentUser={currentUser}
        onSwitchPersona={(email) => void handleLoginAs(email)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowX: 'hidden',
        }}
      >
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          currentUser={currentUser}
          systemReady={systemReady}
          dbLatency={dbLatency}
        />

        {/* Dashboard Content Container */}
        <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 320px',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Center / Left: Metrics + Kanban + Bottom Widgets */}
            <div style={{ minWidth: 0 }}>
              {/* 4 Stat Cards */}
              <MetricCards items={items} />

              {/* Kanban 4-Column Board */}
              <KanbanBoard
                items={filteredItems}
                currentUser={currentUser}
                onClaim={(item) => void handleClaim(item)}
                onTransition={(itemId, status) => void handleTransition(itemId, status)}
                onOpenDrawer={(item) => void handleOpenDrawer(item)}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
              />

              {/* Task Timeline & Team Workload */}
              <BottomWidgets />
            </div>

            {/* Right Sidebar: Today's Tasks, Upcoming, Priority */}
            <div style={{ position: 'sticky', top: '1.5rem' }}>
              <RightSidebar items={items} onOpenCreateModal={() => setIsCreateModalOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        isSubmitting={createSubmitting}
      />

      {/* Slide-over Item Drawer */}
      <ItemDrawer
        item={activeDrawerItem}
        onClose={() => setActiveDrawerItem(null)}
        isLoading={drawerLoading}
        activityHistory={activityHistory}
        comments={comments}
        onAddComment={handleAddComment}
        onClaim={handleClaim}
        onTransition={handleTransition}
        currentUserId={currentUser?.id}
        isViewer={currentUser?.memberships[0]?.role === 'VIEWER'}
      />
    </div>
  );
};

export default App;
